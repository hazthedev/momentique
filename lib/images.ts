// ============================================
// GATHERLY - Image Processing & Storage
// ============================================

import {
  PutObjectCommand,
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import type { IPhotoImage } from './types';
import {
  processSecureImage,
  getTierProcessingOptions,
  verifyExifStripped,
  detectCorruption,
} from './upload/image-processor';
import type { SubscriptionTier } from './types';

// ============================================
// CONFIGURATION
// ============================================

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'gatherly-dev';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-xxxxxxxxx.r2.dev';

// Image processing constants
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 85;
const THUMBNAIL_SIZE = 150;
const MEDIUM_SIZE = 800;

// ============================================
// R2/S3 CLIENT
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
// STORAGE OPERATIONS
// ============================================

/**
 * Compress and upload image to R2/S3 storage with security hardening
 * Uses secure image processor with EXIF stripping and corruption detection
 *
 * @param eventId - Event ID for storage path
 * @param photoId - Photo ID for storage path
 * @param imageBuffer - Raw image buffer
 * @param originalFilename - Original filename (for format detection)
 * @param tier - Subscription tier for processing options (default: 'free')
 */
export async function uploadImageToStorage(
  eventId: string,
  photoId: string,
  imageBuffer: Buffer,
  originalFilename: string,
  tier: SubscriptionTier = 'free'
): Promise<IPhotoImage> {
  const client = getR2Client();
  const path = `${eventId}/${photoId}`;

  // ============================================
  // 1. CHECK FOR CORRUPTION BEFORE PROCESSING
  // ============================================
  const corruptionCheck = await detectCorruption(imageBuffer);
  if (corruptionCheck.isCorrupted) {
    throw new Error(`Image is corrupted: ${corruptionCheck.reason}`);
  }

  // ============================================
  // 2. PROCESS IMAGE WITH SECURITY
  // ============================================
  const processingOptions = {
    ...getTierProcessingOptions(tier),
    allowOversize: true,
  };
  const processed = await processSecureImage(imageBuffer, processingOptions);

  // Verify EXIF was stripped
  const exifCheckFull = await verifyExifStripped(processed.full.buffer);
  const exifCheckMedium = await verifyExifStripped(processed.medium.buffer);
  const exifCheckThumbnail = await verifyExifStripped(processed.thumbnail.buffer);

  if (!exifCheckFull || !exifCheckMedium || !exifCheckThumbnail) {
    console.warn('[SECURITY] EXIF data detected in processed image - this should not happen');
  }

  // ============================================
  // 3. DETERMINE FILE EXTENSION
  // ============================================
  const ext = processingOptions.outputFormat === 'webp' ? 'webp' : 'jpg';

  // ============================================
  // 4. UPLOAD ALL SIZES TO R2
  // ============================================
  const contentType = processingOptions.outputFormat === 'webp'
    ? 'image/webp'
    : 'image/jpeg';

  await Promise.all([
    client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${path}/full.${ext}`,
      Body: processed.full.buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })),
    client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${path}/medium.${ext}`,
      Body: processed.medium.buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })),
    client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${path}/thumbnail.${ext}`,
      Body: processed.thumbnail.buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })),
  ]);

  // ============================================
  // 5. RETURN RESULTS
  // ============================================
  return {
    original_url: `${R2_PUBLIC_URL}/${path}/full.${ext}`,
    thumbnail_url: `${R2_PUBLIC_URL}/${path}/thumbnail.${ext}`,
    medium_url: `${R2_PUBLIC_URL}/${path}/medium.${ext}`,
    full_url: `${R2_PUBLIC_URL}/${path}/full.${ext}`,
    width: processed.full.width,
    height: processed.full.height,
    file_size: processed.full.size,
    format: ext,
  };
}

// ============================================
// DIRECT UPLOAD (PRESIGNED URL)
// ============================================

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

/**
 * Generate a presigned PUT URL for direct-to-R2 upload
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds: number = 600
): Promise<PresignedUploadResult> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  return {
    uploadUrl,
    key,
    publicUrl,
  };
}

/**
 * Delete all photos for an event from storage
 */
export async function deleteEventPhotos(eventId: string): Promise<void> {
  const client = getR2Client();

  try {
    // List all objects with the event prefix
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: `${eventId}/`,
    }));

    // Delete all objects
    if (listed.Contents && listed.Contents.length > 0) {
      const objects = listed.Contents.map((obj) => ({ Key: obj.Key || '' }));

      await client.send(new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: objects,
        },
      }));
    }

    console.log(`[Storage] Deleted ${listed.Contents?.length || 0} photos for event ${eventId}`);
  } catch (error) {
    console.error(`[Storage] Error deleting photos for event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Delete all photo assets for a specific photo
 */
export async function deletePhotoAssets(eventId: string, photoId: string): Promise<void> {
  const client = getR2Client();
  const prefix = `${eventId}/${photoId}/`;

  try {
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: prefix,
    }));

    if (listed.Contents && listed.Contents.length > 0) {
      const objects = listed.Contents.map((obj) => ({ Key: obj.Key || '' }));

      await client.send(new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: {
          Objects: objects,
        },
      }));
    }

    console.log(`[Storage] Deleted ${listed.Contents?.length || 0} objects for photo ${photoId}`);
  } catch (error) {
    console.error(`[Storage] Error deleting photo assets for ${photoId}:`, error);
    throw error;
  }
}

/**
 * Generate signed URL for private access
 */
export function generateSignedUrl(key: string, _expiresIn: number = 3600): string {
  // TODO: Implement signed URL generation
  // For now, return public URL
  return `${R2_PUBLIC_URL}/${key}`;
}

// ============================================
// IMAGE PROCESSING
// ============================================

/**
 * Get image dimensions from buffer
 */
export async function getImageDimensionsFromBuffer(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

/**
 * Generate thumbnail from image (square, cover fit)
 */
export async function generateThumbnail(
  imageBuffer: Buffer,
  size: number = THUMBNAIL_SIZE
): Promise<Buffer> {
  return await sharp(imageBuffer)
    .resize(size, size, { fit: 'cover', position: 'center' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

/**
 * Generate medium-sized image (max width/height)
 */
export async function generateMediumImage(
  imageBuffer: Buffer,
  maxSize: number = MEDIUM_SIZE
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || maxSize;
  const height = metadata.height || maxSize;

  const scale = Math.min(maxSize / width, maxSize / height, 1);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  return await sharp(imageBuffer)
    .resize(newWidth, newHeight, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

// ============================================
// IMAGE VALIDATION
// ============================================

// Re-export the comprehensive validator functions
export { validateUploadedImage, validateByTier, getTierValidationOptions } from './upload/validator';

/**
 * @deprecated Use validateUploadedImage from './upload/validator' instead
 * This is kept for backward compatibility with existing code
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Allowed: JPEG, PNG, HEIC, WebP' };
  }

  return { valid: true };
}

// ============================================
// CONTENT MODERATION (AI)
// ============================================

/**
 * Check image for NSFW content
 */
export async function checkNSFW(_imageBuffer: Buffer): Promise<{
  isNSFW: boolean;
  confidence: number;
  labels: Array<{ name: string; confidence: number }>;
}> {
  // TODO: Implement using AWS Rekognition or similar
  // For now, return safe result
  return {
    isNSFW: false,
    confidence: 0,
    labels: [],
  };
}

/**
 * Check image for suspicious content
 */
export async function checkSuspiciousContent(_imageBuffer: Buffer): Promise<{
  isSuspicious: boolean;
  reasons: string[];
}> {
  // TODO: Implement AI-based content analysis
  // Check for: weapons, alcohol, drugs, text in image, etc.
  return {
    isSuspicious: false,
    reasons: [],
  };
}

// ============================================
// EXPORT HELPERS
// ============================================

/**
 * Generate ZIP file for photo export
 */
export async function generateEventZip(_eventId: string): Promise<Buffer> {
  // TODO: Implement using archiver package
  // Fetch all photos from storage
  // Add to ZIP with metadata CSV
  return Buffer.from('');
}

/**
 * Get storage usage for event
 */
export async function getEventStorageUsage(_eventId: string): Promise<{
  totalSize: number;
  photoCount: number;
}> {
  // TODO: Calculate actual storage usage
  return {
    totalSize: 0,
    photoCount: 0,
  };
}
