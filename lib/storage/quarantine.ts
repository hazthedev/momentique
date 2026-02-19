/**
 * Content Quarantine System
 *
 * Stores flagged/inappropriate content separately from public storage.
 * Prevents public access until content is reviewed and approved.
 * Auto-deletes unreviewed content after 7 days.
 */

import {
  PutObjectCommand,
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================
// TYPES & INTERFACES
// ============================================

export type QuarantineStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface QuarantineMetadata {
  photoId: string;
  eventId: string;
  originalPath: string;
  status: QuarantineStatus;
  flaggedAt: Date;
  expiresAt: Date;
  reason?: string;
  categories?: string[];
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface QuarantineItem {
  metadata: QuarantineMetadata;
  storagePath: string;
  hasPreview: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'galeria-dev';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Quarantine settings
const QUARANTINE_PREFIX = 'quarantine';
const EXPIRY_DAYS = 7; // Auto-delete after 7 days
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// ============================================
// CLIENT
// ============================================

let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2Client;
}

// ============================================
// QUARANTINE OPERATIONS
// ============================================

/**
 * Move a photo to quarantine
 *
 * @param eventId - Event ID
 * @param photoId - Photo ID
 * @param reason - Reason for quarantine (moderation flags)
 * @param categories - Detected categories (nudity, violence, etc.)
 */
export async function quarantinePhoto(
  eventId: string,
  photoId: string,
  reason?: string,
  categories?: string[]
): Promise<QuarantineMetadata> {
  const client = getR2Client();
  const originalPath = `${eventId}/${photoId}`;
  const quarantinePath = `${QUARANTINE_PREFIX}/${photoId}`;

  // Create metadata
  const metadata: QuarantineMetadata = {
    photoId,
    eventId,
    originalPath,
    status: 'pending',
    flaggedAt: new Date(),
    expiresAt: new Date(Date.now() + EXPIRY_MS),
    reason,
    categories,
  };

  try {
    // 1. Copy all photo assets to quarantine
    const assets = await listPhotoAssets(originalPath);

    for (const asset of assets) {
      const sourceKey = `${originalPath}/${asset.name}`;
      const destKey = `${quarantinePath}/${asset.name}`;

      await client.send(new CopyObjectCommand({
        Bucket: R2_BUCKET_NAME,
        CopySource: `${R2_BUCKET_NAME}/${sourceKey}`,
        Key: destKey,
        MetadataDirective: 'REPLACE',
        Metadata: {
          'quarantine-status': 'pending',
          'quarantine-reason': reason || '',
          'quarantine-categories': categories?.join(',') || '',
          'original-path': originalPath,
        },
      }));
    }

    // 2. Store quarantine metadata
    await storeQuarantineMetadata(photoId, metadata);

    // 3. Delete original public assets
    await deletePhotoAssets(originalPath);

    console.log(`[Quarantine] Photo ${photoId} moved to quarantine: ${reason}`);

    return metadata;
  } catch (error) {
    console.error(`[Quarantine] Error quarantining photo ${photoId}:`, error);
    throw error;
  }
}

/**
 * Approve a quarantined photo and restore to public storage
 *
 * @param photoId - Photo ID
 * @param reviewedBy - User ID of reviewer
 */
export async function approveQuarantinedPhoto(
  photoId: string,
  reviewedBy: string
): Promise<void> {
  const client = getR2Client();

  // Get metadata
  const metadata = await getQuarantineMetadata(photoId);
  if (!metadata) {
    throw new Error(`Quarantined photo ${photoId} not found`);
  }

  const quarantinePath = `${QUARANTINE_PREFIX}/${photoId}`;
  const originalPath = metadata.originalPath;

  try {
    // 1. Copy assets back to original location
    const assets = await listPhotoAssets(quarantinePath);

    for (const asset of assets) {
      const sourceKey = `${quarantinePath}/${asset.name}`;
      const destKey = `${originalPath}/${asset.name}`;

      await client.send(new CopyObjectCommand({
        Bucket: R2_BUCKET_NAME,
        CopySource: `${R2_BUCKET_NAME}/${sourceKey}`,
        Key: destKey,
      }));
    }

    // 2. Update metadata
    metadata.status = 'approved';
    metadata.reviewedBy = reviewedBy;
    metadata.reviewedAt = new Date();
    await storeQuarantineMetadata(photoId, metadata);

    // 3. Delete quarantine copies
    await deletePhotoAssets(quarantinePath);

    console.log(`[Quarantine] Photo ${photoId} approved and restored by ${reviewedBy}`);
  } catch (error) {
    console.error(`[Quarantine] Error approving photo ${photoId}:`, error);
    throw error;
  }
}

/**
 * Reject and permanently delete a quarantined photo
 *
 * @param photoId - Photo ID
 * @param reviewedBy - User ID of reviewer
 */
export async function rejectQuarantinedPhoto(
  photoId: string,
  reviewedBy: string
): Promise<void> {
  // Get metadata
  const metadata = await getQuarantineMetadata(photoId);
  if (!metadata) {
    throw new Error(`Quarantined photo ${photoId} not found`);
  }

  const quarantinePath = `${QUARANTINE_PREFIX}/${photoId}`;

  try {
    // 1. Delete quarantine assets
    await deletePhotoAssets(quarantinePath);

    // 2. Update metadata (keep record for audit)
    metadata.status = 'rejected';
    metadata.reviewedBy = reviewedBy;
    metadata.reviewedAt = new Date();
    await storeQuarantineMetadata(photoId, metadata);

    console.log(`[Quarantine] Photo ${photoId} rejected by ${reviewedBy}`);
  } catch (error) {
    console.error(`[Quarantine] Error rejecting photo ${photoId}:`, error);
    throw error;
  }
}

/**
 * Generate a time-limited preview URL for quarantined content
 * Only accessible by moderators/admins
 *
 * @param photoId - Photo ID
 * @param expiresIn - URL expiry in seconds (default: 1 hour)
 */
export async function getQuarantinePreviewUrl(
  photoId: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const client = getR2Client();

  try {
    // Check if photo exists in quarantine
    const quarantinePath = `${QUARANTINE_PREFIX}/${photoId}`;
    const assets = await listPhotoAssets(quarantinePath);

    if (assets.length === 0) {
      return null;
    }

    // Find thumbnail or first image
    const thumbnail = assets.find(a => a.name.includes('thumbnail')) || assets[0];
    const key = `${quarantinePath}/${thumbnail.name}`;

    // Generate presigned URL
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    return await getSignedUrl(client, command, { expiresIn });
  } catch (error) {
    console.error(`[Quarantine] Error generating preview for ${photoId}:`, error);
    return null;
  }
}

/**
 * Get all quarantined photos for an event
 *
 * @param eventId - Event ID
 */
export async function getQuarantinedPhotosByEvent(eventId: string): Promise<QuarantineItem[]> {
  const client = getR2Client();

  try {
    // List all quarantine metadata objects
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `${QUARANTINE_PREFIX}-metadata/`,
    }));

    const items: QuarantineItem[] = [];

    if (listed.Contents) {
      for (const object of listed.Contents) {
        const photoId = object.Key?.split('/').pop()?.replace('.json', '');
        if (!photoId) continue;

        const metadata = await getQuarantineMetadata(photoId);
        if (metadata && metadata.eventId === eventId) {
          items.push({
            metadata,
            storagePath: `${QUARANTINE_PREFIX}/${photoId}`,
            hasPreview: true,
          });
        }
      }
    }

    return items;
  } catch (error) {
    console.error(`[Quarantine] Error listing quarantined photos for event ${eventId}:`, error);
    return [];
  }
}

/**
 * Clean up expired quarantined content
 * Run this periodically (e.g., daily via cron)
 *
 * @returns Number of photos cleaned up
 */
export async function cleanupExpiredQuarantine(): Promise<number> {
  const client = getR2Client();
  const now = new Date();
  let cleanedCount = 0;

  try {
    // List all quarantine metadata
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `${QUARANTINE_PREFIX}-metadata/`,
    }));

    if (!listed.Contents) return 0;

    for (const object of listed.Contents) {
      const photoId = object.Key?.split('/').pop()?.replace('.json', '');
      if (!photoId) continue;

      const metadata = await getQuarantineMetadata(photoId);
      if (!metadata) continue;

      // Check if expired and still pending
      if (metadata.status === 'pending' && metadata.expiresAt < now) {
        await rejectQuarantinedPhoto(photoId, 'system-cleanup');
        metadata.status = 'expired';
        await storeQuarantineMetadata(photoId, metadata);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Quarantine] Cleaned up ${cleanedCount} expired photos`);
    }

    return cleanedCount;
  } catch (error) {
    console.error('[Quarantine] Error during cleanup:', error);
    return cleanedCount;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * List all assets for a photo in storage
 */
async function listPhotoAssets(prefix: string): Promise<Array<{ name: string; size: number }>> {
  const client = getR2Client();

  try {
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `${prefix}/`,
    }));

    return (listed.Contents || []).map(obj => ({
      name: obj.Key?.split('/').pop() || '',
      size: obj.Size || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Delete all assets for a photo
 */
async function deletePhotoAssets(prefix: string): Promise<void> {
  const client = getR2Client();

  const assets = await listPhotoAssets(prefix);
  if (assets.length === 0) return;

  const objects = assets.map(asset => ({ Key: `${prefix}/${asset.name}` }));

  await client.send(new DeleteObjectsCommand({
    Bucket: R2_BUCKET_NAME,
    Delete: {
      Objects: objects,
    },
  }));
}

/**
 * Store quarantine metadata as JSON in S3
 */
async function storeQuarantineMetadata(photoId: string, metadata: QuarantineMetadata): Promise<void> {
  const client = getR2Client();

  const key = `${QUARANTINE_PREFIX}-metadata/${photoId}.json`;

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(metadata),
    ContentType: 'application/json',
  }));
}

/**
 * Retrieve quarantine metadata from S3
 */
async function getQuarantineMetadata(photoId: string): Promise<QuarantineMetadata | null> {
  const client = getR2Client();

  try {
    const key = `${QUARANTINE_PREFIX}-metadata/${photoId}.json`;

    const response = await client.send(new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }));

    const body = await response.Body?.transformToString();
    if (!body) return null;

    return JSON.parse(body) as QuarantineMetadata;
  } catch (error) {
    return null;
  }
}

/**
 * Get quarantine statistics for monitoring
 */
export interface QuarantineStats {
  totalQuarantined: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  expiringIn24h: number;
}

export async function getQuarantineStats(): Promise<QuarantineStats> {
  const client = getR2Client();
  const stats: QuarantineStats = {
    totalQuarantined: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    expiringIn24h: 0,
  };

  try {
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `${QUARANTINE_PREFIX}-metadata/`,
    }));

    if (listed.Contents) {
      const now = Date.now();
      const dayFromNow = now + (24 * 60 * 60 * 1000);

      for (const object of listed.Contents) {
        const photoId = object.Key?.split('/').pop()?.replace('.json', '');
        if (!photoId) continue;

        const metadata = await getQuarantineMetadata(photoId);
        if (!metadata) continue;

        stats.totalQuarantined++;

        switch (metadata.status) {
          case 'pending':
            stats.pending++;
            if (metadata.expiresAt.getTime() < dayFromNow) {
              stats.expiringIn24h++;
            }
            break;
          case 'approved':
            stats.approved++;
            break;
          case 'rejected':
            stats.rejected++;
            break;
          case 'expired':
            stats.expired++;
            break;
        }
      }
    }

    return stats;
  } catch (error) {
    console.error('[Quarantine] Error getting stats:', error);
    return stats;
  }
}
