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
 * Compress and upload image to R2/S3 storage
 * Generates multiple sizes: thumbnail (150px), medium (800px), full (1920px)
 */
export async function uploadImageToStorage(
  eventId: string,
  photoId: string,
  imageBuffer: Buffer,
  originalFilename: string
): Promise<IPhotoImage> {
  const client = getR2Client();
  const path = `${eventId}/${photoId}`;

  // Get image metadata
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const originalWidth = metadata.width || MAX_DIMENSION;
  const originalHeight = metadata.height || MAX_DIMENSION;

  // Generate full-size image (max 1920px)
  const fullScale = Math.min(MAX_DIMENSION / originalWidth, MAX_DIMENSION / originalHeight, 1);
  const fullWidth = Math.round(originalWidth * fullScale);
  const fullHeight = Math.round(originalHeight * fullScale);

  const fullBuffer = await image
    .clone()
    .resize(fullWidth, fullHeight, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  // Generate medium image (max 800px)
  const mediumScale = Math.min(MEDIUM_SIZE / originalWidth, MEDIUM_SIZE / originalHeight, 1);
  const mediumWidth = Math.round(originalWidth * mediumScale);
  const mediumHeight = Math.round(originalHeight * mediumScale);

  const mediumBuffer = await image
    .clone()
    .resize(mediumWidth, mediumHeight, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  // Generate thumbnail (150px square, with cover fit)
  const thumbnailBuffer = await image
    .clone()
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', position: 'center' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  // Upload all three sizes to R2 in parallel
  await Promise.all([
    client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${path}/full.jpg`,
      Body: fullBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    })),
    client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${path}/medium.jpg`,
      Body: mediumBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    })),
    client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: `${path}/thumbnail.jpg`,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    })),
  ]);

  return {
    original_url: `${R2_PUBLIC_URL}/${path}/full.jpg`,
    thumbnail_url: `${R2_PUBLIC_URL}/${path}/thumbnail.jpg`,
    medium_url: `${R2_PUBLIC_URL}/${path}/medium.jpg`,
    full_url: `${R2_PUBLIC_URL}/${path}/full.jpg`,
    width: fullWidth,
    height: fullHeight,
    file_size: fullBuffer.length,
    format: 'jpg',
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

/**
 * Validate image file
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
