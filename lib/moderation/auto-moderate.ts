/**
 * AWS Rekognition Auto-Moderation System
 *
 * Detects inappropriate content in uploaded images including:
 * - Nudity and sexually explicit content
 * - Violence and weapons
 * - Drugs and tobacco
 * - Offensive/unsafe content
 *
 * Free tier: 5,000 images/month for 12 months
 * After: ~$0.001 per image
 */

import {
  RekognitionClient,
  DetectModerationLabelsCommand,
  DetectLabelsCommand,
  ModerationLabel,
  Label,
} from '@aws-sdk/client-rekognition';
import { getSystemSettings } from '../system-settings';

// ============================================
// TYPES & INTERFACES
// ============================================

export type ModerationCategory =
  | 'nudity'
  | 'violence'
  | 'drugs'
  | 'hate'
  | 'unsafe'
  | 'text';

export interface ModerationResult {
  safe: boolean;
  confidence: number;
  categories: ModerationCategory[];
  labels: DetectedLabel[];
  action: 'approve' | 'reject' | 'review';
  reason?: string;
  scannedAt: Date;
}

export interface DetectedLabel {
  name: string;
  confidence: number;
  category: ModerationCategory;
}

export interface ModerationConfig {
  /** Minimum confidence threshold (0-1). Default: 0.8 */
  confidenceThreshold: number;

  /** Whether to auto-reject or flag for review */
  autoReject: boolean;

  /** Categories to detect */
  detectCategories: ModerationCategory[];

  /** Enable text detection (OCR) */
  detectText: boolean;

  /** Tenant ID for multi-tenancy */
  tenantId?: string;
}

// ============================================
// AWS REKOGNITION LABEL MAPPINGS
// ============================================

// AWS Rekognition moderation labels mapped to our categories
const LABEL_MAPPINGS: Record<string, ModerationCategory> = {
  // Nudity & Sexual Content
  'Explicit Nudity': 'nudity',
  'Suggestive': 'nudity',
  'Partial Nudity': 'nudity',
  'Nudity': 'nudity',
  'Sexual Activity': 'nudity',

  // Violence & Weapons
  'Violence': 'violence',
  'Violent': 'violence',
  'Weapon': 'violence',
  'Weapons': 'violence',
  'Gun': 'violence',
  'Rifle': 'violence',
  'Pistol': 'violence',
  'Knife': 'violence',
  'Blood': 'violence',
  'Gore': 'violence',
  'Physical Violence': 'violence',

  // Drugs & Tobacco
  'Drugs': 'drugs',
  'Drug': 'drugs',
  'Tobacco': 'drugs',
  'Cigarette': 'drugs',
  'Smoking': 'drugs',
  'Alcohol': 'drugs',
  'Alcoholic Beverages': 'drugs',
  'Drugs Paraphernalia': 'drugs',
  'Marijuana': 'drugs',

  // Hate & Offensive
  'Hate Symbol': 'hate',
  'Swastika': 'hate',
  'Extremist': 'hate',

  // Unsafe Content
  'Unsafe': 'unsafe',
  'Medical': 'unsafe',
};

// Labels that should trigger immediate rejection regardless of threshold
const ZERO_TOLERANCE_LABELS = new Set([
  'Explicit Nudity',
  'Sexual Activity',
  'Violence',
  'Weapon',
  'Weapons',
  'Gun',
  'Drugs',
  'Hate Symbol',
]);

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG: ModerationConfig = {
  confidenceThreshold: 0.8, // 80% confidence
  autoReject: true,
  detectCategories: ['nudity', 'violence', 'drugs', 'hate', 'unsafe'],
  detectText: true,
};

/**
 * Get moderation config for a tenant
 */
function getModerationConfig(tenantId?: string): ModerationConfig {
  // TODO: Load tenant-specific config from database
  // For now, use defaults
  return DEFAULT_CONFIG;
}

// ============================================
// AWS REKOGNITION CLIENT
// ============================================

let rekognitionClient: RekognitionClient | null = null;

/**
 * Get or create AWS Rekognition client
 * Checks system settings first, then falls back to environment variables
 */
async function getRekognitionClient(): Promise<RekognitionClient | null> {
  if (rekognitionClient) {
    return rekognitionClient;
  }

  // Check system settings for AWS credentials
  const systemSettings = await getSystemSettings();

  // Check if moderation is enabled
  if (!systemSettings.moderation.enabled) {
    return null;
  }

  // Use system settings or fall back to environment variables
  const region =
    systemSettings.moderation.aws_region ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    'us-east-1';

  const accessKeyId =
    systemSettings.moderation.aws_access_key_id ||
    process.env.AWS_ACCESS_KEY_ID ||
    '';

  const secretAccessKey =
    systemSettings.moderation.aws_secret_access_key ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    '';

  if (!accessKeyId || !secretAccessKey) {
    console.warn('[MODERATION] AWS credentials not configured. Auto-moderation disabled.');
    return null;
  }

  try {
    rekognitionClient = new RekognitionClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    });

    return rekognitionClient;
  } catch (error) {
    console.error('[MODERATION] Failed to create Rekognition client:', error);
    return null;
  }
}

// ============================================
// MODERATION FUNCTIONS
// ============================================

/**
 * Scan an image for inappropriate content
 *
 * @param imageUrl - Public URL of the image to scan
 * @param config - Moderation configuration
 * @returns Moderation result
 */
export async function scanImageForModeration(
  imageUrl: string,
  config: Partial<ModerationConfig> = {}
): Promise<ModerationResult> {
  const finalConfig = { ...getModerationConfig(config.tenantId), ...config };
  const client = await getRekognitionClient();

  // If AWS not configured, return safe (manual moderation required)
  if (!client) {
    return {
      safe: true,
      confidence: 0,
      categories: [],
      labels: [],
      action: 'approve',
      reason: 'AWS not configured - manual moderation required',
      scannedAt: new Date(),
    };
  }

  try {
    // Detect moderation labels
    const moderationCommand = new DetectModerationLabelsCommand({
      Image: {
        S3Object: parseS3Object(imageUrl),
        Bytes: await fetchImageBytes(imageUrl),
      },
      MinConfidence: finalConfig.confidenceThreshold * 100,
    });

    const moderationResponse = await client.send(moderationCommand);
    const moderationLabels = moderationResponse.ModerationLabels || [];

    // Process detected labels
    const detectedLabels: DetectedLabel[] = [];
    const detectedCategories = new Set<ModerationCategory>();
    let maxConfidence = 0;
    let zeroToleranceTriggered = false;

    for (const label of moderationLabels) {
      const category = LABEL_MAPPINGS[label.Name || ''];
      if (!category) continue;

      const confidence = (label.Confidence || 0) / 100;
      maxConfidence = Math.max(maxConfidence, confidence);

      // Check for zero-tolerance labels
      if (ZERO_TOLERANCE_LABELS.has(label.Name || '')) {
        zeroToleranceTriggered = true;
      }

      detectedLabels.push({
        name: label.Name || '',
        confidence,
        category,
      });

      detectedCategories.add(category);
    }

    // Determine action based on detection
    const categories = Array.from(detectedCategories);

    let action: 'approve' | 'reject' | 'review';
    let reason: string | undefined;

    if (zeroToleranceTriggered || categories.length > 0) {
      if (finalConfig.autoReject) {
        action = 'reject';
        reason = `Detected: ${categories.join(', ')}`;
      } else {
        action = 'review';
        reason = `Flagged for review: ${categories.join(', ')}`;
      }
    } else {
      action = 'approve';
    }

    return {
      safe: categories.length === 0,
      confidence: maxConfidence,
      categories,
      labels: detectedLabels,
      action,
      reason,
      scannedAt: new Date(),
    };
  } catch (error) {
    console.error('[MODERATION] Error scanning image:', error);

    // On error, flag for review rather than auto-reject
    return {
      safe: false,
      confidence: 0,
      categories: [],
      labels: [],
      action: 'review',
      reason: `Scan error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      scannedAt: new Date(),
    };
  }
}

/**
 * Scan multiple images in batch
 *
 * @param imageUrls - Array of image URLs to scan
 * @param config - Moderation configuration
 * @returns Array of moderation results
 */
export async function scanImagesBatch(
  imageUrls: string[],
  config: Partial<ModerationConfig> = {}
): Promise<ModerationResult[]> {
  // Scan images in parallel with concurrency limit
  const CONCURRENCY = 5;
  const results: ModerationResult[] = [];

  for (let i = 0; i < imageUrls.length; i += CONCURRENCY) {
    const batch = imageUrls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((url) => scanImageForModeration(url, config))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Moderate a photo and return the suggested status
 *
 * @param imageUrl - Public URL of the photo
 * @param currentStatus - Current photo status
 * @returns Suggested status ('approved' | 'rejected' | 'pending')
 */
export async function moderatePhoto(
  imageUrl: string,
  currentStatus: 'pending' | 'approved' | 'rejected' = 'pending'
): Promise<{ status: 'approved' | 'rejected' | 'pending'; reason?: string }> {
  const result = await scanImageForModeration(imageUrl);

  switch (result.action) {
    case 'approve':
      return { status: 'approved' };
    case 'reject':
      return { status: 'rejected', reason: result.reason };
    case 'review':
      return { status: 'pending', reason: result.reason };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse S3 object from URL
 */
function parseS3Object(imageUrl: string): { Bucket: string; Name: string } | undefined {
  try {
    const url = new URL(imageUrl);

    // Check if it's an S3 URL
    if (url.hostname.endsWith('.amazonaws.com')) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return {
          Bucket: parts[0],
          Name: parts.slice(1).join('/'),
        };
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetch image bytes from URL
 */
async function fetchImageBytes(imageUrl: string): Promise<Uint8Array | undefined> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return undefined;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return undefined;
  }
}

/**
 * Check if moderation is enabled
 */
/**
 * Check if moderation is enabled
 */
export async function isModerationEnabled(): Promise<boolean> {
  try {
    const systemSettings = await getSystemSettings();

    // Check if enabled in settings AND credentials are configured
    return !!(
      systemSettings.moderation.enabled &&
      (systemSettings.moderation.aws_access_key_id || process.env.AWS_ACCESS_KEY_ID) &&
      (systemSettings.moderation.aws_secret_access_key || process.env.AWS_SECRET_ACCESS_KEY)
    );
  } catch {
    // Fallback to env vars if system settings unavailable
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY
    );
  }
}

/**
 * Get moderation statistics for monitoring
 */
export interface ModerationStats {
  totalScans: number;
  approved: number;
  rejected: number;
  flaggedForReview: number;
  errors: number;
}

const stats: ModerationStats = {
  totalScans: 0,
  approved: 0,
  rejected: 0,
  flaggedForReview: 0,
  errors: 0,
};

export function getModerationStats(): ModerationStats {
  return { ...stats };
}

function updateStats(action: 'approve' | 'reject' | 'review' | 'error'): void {
  stats.totalScans++;
  switch (action) {
    case 'approve':
      stats.approved++;
      break;
    case 'reject':
      stats.rejected++;
      break;
    case 'review':
      stats.flaggedForReview++;
      break;
    case 'error':
      stats.errors++;
      break;
  }
}
