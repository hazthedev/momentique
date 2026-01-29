// ============================================
// Gatherly - Secure Image Processor
// ============================================
// Security-focused image processing with:
// - Complete EXIF/metadata stripping
// - Format normalization
// - Dimension enforcement
// - Corruption detection
// - Safe processing limits

import sharp, { Sharp, Metadata } from 'sharp';
import type { SubscriptionTier } from '../types';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ProcessedImageResult {
  original: ProcessedSize;
  thumbnail: ProcessedSize;
  medium: ProcessedSize;
  full: ProcessedSize;
  metadata: {
    originalFormat: string;
    originalWidth: number;
    originalHeight: number;
    originalSize: number;
    outputFormat: string;
    exifStripped: boolean;
  };
}

export interface ProcessedSize {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  format: string;
}

export interface ProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  outputFormat?: 'jpeg' | 'webp' | 'png';
  jpegQuality?: number;
  webpQuality?: number;
  pngCompressionLevel?: number;
  stripMetadata?: boolean;
  thumbnailSize?: number;
  mediumSize?: number;
  fullSize?: number;
  thumbnailFit?: 'cover' | 'fill' | 'inside' | 'outside';
  allowOversize?: boolean;
}

export interface ProcessingError {
  code: string;
  message: string;
  details?: string;
}

// ============================================
// PROCESSING CONFIGURATION
// ============================================

const DEFAULT_OPTIONS: Required<ProcessingOptions> = {
  maxWidth: 10000,
  maxHeight: 10000,
  outputFormat: 'jpeg',
  jpegQuality: 85,
  webpQuality: 85,
  pngCompressionLevel: 9,
  stripMetadata: true,
  thumbnailSize: 150,
  mediumSize: 800,
  fullSize: 1920,
  thumbnailFit: 'cover',
  allowOversize: false,
};

// Tier-based processing limits
const TIER_PROCESSING_LIMITS: Record<SubscriptionTier, ProcessingOptions> = {
  free: {
    maxWidth: 4000,
    maxHeight: 4000,
    outputFormat: 'jpeg',
    jpegQuality: 80,
    webpQuality: 80,
    stripMetadata: true,
  },
  pro: {
    maxWidth: 6000,
    maxHeight: 6000,
    outputFormat: 'jpeg',
    jpegQuality: 85,
    webpQuality: 85,
    stripMetadata: true,
  },
  premium: {
    maxWidth: 10000,
    maxHeight: 10000,
    outputFormat: 'webp', // Modern format for premium
    jpegQuality: 90,
    webpQuality: 90,
    stripMetadata: true,
  },
  enterprise: {
    maxWidth: 15000,
    maxHeight: 15000,
    outputFormat: 'webp',
    jpegQuality: 95,
    webpQuality: 95,
    stripMetadata: false, // Enterprise may keep metadata
  },
  tester: {
    maxWidth: 20000,
    maxHeight: 20000,
    outputFormat: 'webp',
    jpegQuality: 95,
    webpQuality: 95,
    stripMetadata: false,
  },
};

// Processing limits to prevent DoS
const MAX_PROCESSING_TIME = 30000; // 30 seconds max per image
const MAX_INPUT_PIXELS = 250_000_000; // 250 megapixels absolute limit

// ============================================
// ERROR HANDLING
// ============================================

class ImageProcessingError extends Error implements ProcessingError {
  code: string;
  details?: string;

  constructor(code: string, message: string, details?: string) {
    super(message);
    this.name = 'ImageProcessingError';
    this.code = code;
    this.details = details;
  }
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

/**
 * Securely process an uploaded image with security hardening
 *
 * @param inputBuffer - Raw image buffer from upload
 * @param options - Processing options (will be merged with tier defaults)
 * @returns ProcessedImageResult with all sizes and metadata
 * @throws ImageProcessingError for corrupted or invalid images
 */
export async function processSecureImage(
  inputBuffer: Buffer,
  options: ProcessingOptions = {}
): Promise<ProcessedImageResult> {
  const startTime = Date.now();

  // Merge with defaults
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ============================================
  // 1. VALIDATE INPUT
  // ============================================

  // Check input buffer is not empty
  if (inputBuffer.length === 0) {
    throw new ImageProcessingError(
      'EMPTY_INPUT',
      'Input buffer is empty'
    );
  }

  // Reasonable minimum size for an image (100 bytes)
  if (inputBuffer.length < 100) {
    throw new ImageProcessingError(
      'INPUT_TOO_SMALL',
      'Input buffer is too small to be a valid image'
    );
  }

  // ============================================
  // 2. CREATE SHARP INSTANCE WITH TIMEOUT
  // ============================================

  let image: Sharp;
  let metadata: Metadata;

  try {
    // Create Sharp instance with failOnError to catch corrupted images
    image = sharp(inputBuffer, {
      failOnError: true, // Reject corrupted images
      unlimited: false, // Enforce security limits
    });

    // Set timeout for processing
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Image processing timeout'));
      }, MAX_PROCESSING_TIME);
    });

    // Get metadata with timeout
    const metadataPromise = image.metadata();

    metadata = await Promise.race([metadataPromise, timeoutPromise]) as Metadata;

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Input buffer contains unsupported image format')) {
        throw new ImageProcessingError(
          'UNSUPPORTED_FORMAT',
          'Unsupported or corrupted image format',
          error.message
        );
      }
      if (error.message.includes('Input buffer is too small') || error.message.includes('Truncated file')) {
        throw new ImageProcessingError(
          'CORRUPTED_IMAGE',
          'Image file is corrupted or truncated',
          error.message
        );
      }
      if (error.message.includes('timeout')) {
        throw new ImageProcessingError(
          'PROCESSING_TIMEOUT',
          'Image processing took too long',
          `Exceeded ${MAX_PROCESSING_TIME}ms limit`
        );
      }
    }
    throw new ImageProcessingError(
      'PROCESSING_FAILED',
      'Failed to process image',
      error instanceof Error ? error.message : String(error)
    );
  }

  // ============================================
  // 3. VALIDATE METADATA
  // ============================================

  if (!metadata.width || !metadata.height) {
    throw new ImageProcessingError(
      'NO_DIMENSIONS',
      'Could not determine image dimensions'
    );
  }

  const originalWidth = metadata.width;
  const originalHeight = metadata.height;
  const totalPixels = originalWidth * originalHeight;

  // Check pixel limit (prevent decompression bomb attacks)
  if (totalPixels > MAX_INPUT_PIXELS) {
    throw new ImageProcessingError(
      'TOO_MANY_PIXELS',
      `Image has too many pixels (${totalPixels})`,
      `Maximum allowed: ${MAX_INPUT_PIXELS}`
    );
  }

  // Check dimension limits
  if (!opts.allowOversize && (originalWidth > opts.maxWidth || originalHeight > opts.maxHeight)) {
    throw new ImageProcessingError(
      'DIMENSIONS_EXCEED_LIMIT',
      `Image dimensions (${originalWidth}x${originalHeight}) exceed maximum allowed (${opts.maxWidth}x${opts.maxHeight})`,
      `Consider resizing before upload or upgrading tier`
    );
  }

  // Detect original format from metadata
  const originalFormat = metadata.format || 'unknown';

  // ============================================
  // 4. PREPARE PROCESSING PIPELINE
  // ============================================

  // Common operations that apply to all sizes
  const basePipeline = sharp(inputBuffer);

  // Auto-rotate based on EXIF orientation (do this before stripping)
  basePipeline.rotate();

  // ALWAYS strip metadata for security (unless enterprise opts out)
  // Note: Using rotate() then toBuffer() effectively strips EXIF
  // We don't call removeMetadata() directly as it's not always available

  // ============================================
  // 5. GENERATE SIZES
  // ============================================

  // Calculate dimensions for each size
  const thumbnailDims = calculateDimensions(
    originalWidth,
    originalHeight,
    opts.thumbnailSize,
    opts.thumbnailSize,
    'cover' // Thumbnails always use cover
  );

  const mediumDims = calculateDimensions(
    originalWidth,
    originalHeight,
    opts.mediumSize,
    opts.mediumSize,
    'inside'
  );

  const fullDims = calculateDimensions(
    originalWidth,
    originalHeight,
    opts.fullSize,
    opts.fullSize,
    'inside'
  );

  // Process all sizes in parallel for efficiency
  const [thumbnail, medium, full] = await Promise.all([
    processSize(basePipeline.clone(), thumbnailDims, 'thumbnail', opts),
    processSize(basePipeline.clone(), mediumDims, 'medium', opts),
    processSize(basePipeline.clone(), fullDims, 'full', opts),
  ]);

  // ============================================
  // 6. RETURN RESULTS
  // ============================================

  return {
    original: {
      buffer: inputBuffer, // Note: original buffer is returned but NOT stored
      width: originalWidth,
      height: originalHeight,
      size: inputBuffer.length,
      format: originalFormat,
    },
    thumbnail,
    medium,
    full,
    metadata: {
      originalFormat,
      originalWidth,
      originalHeight,
      originalSize: inputBuffer.length,
      outputFormat: opts.outputFormat,
      exifStripped: opts.stripMetadata,
    },
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate output dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
  fit: 'cover' | 'fill' | 'inside' | 'outside'
): { width: number; height: number } {
  if (fit === 'cover') {
    // Cover: both dimensions must fit within bounds, crop if needed
    const scale = Math.max(maxWidth / originalWidth, maxHeight / originalHeight);
    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  if (fit === 'inside') {
    // Inside: fit entirely within bounds
    const scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);
    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  // For 'fill' and 'outside', resize to exact dimensions
  return { width: maxWidth, height: maxHeight };
}

/**
 * Process a single size with the specified options
 */
async function processSize(
  pipeline: Sharp,
  dimensions: { width: number; height: number },
  sizeName: 'thumbnail' | 'medium' | 'full',
  options: Required<ProcessingOptions>
): Promise<ProcessedSize> {
  const resizeOptions: sharp.ResizeOptions = {
    fit: sizeName === 'thumbnail' ? 'cover' : 'inside',
    withoutEnlargement: true, // Never upscale
    position: 'center',
  };

  // Apply resize
  pipeline.resize(dimensions.width, dimensions.height, resizeOptions);

  // Apply format-specific options (these also strip EXIF metadata)
  switch (options.outputFormat) {
    case 'jpeg':
      pipeline.jpeg({
        quality: options.jpegQuality,
        mozjpeg: true, // Use mozjpeg for better compression
      });
      break;

    case 'webp':
      pipeline.webp({
        quality: options.webpQuality,
        effort: 6, // Balance between speed and compression
      });
      break;

    case 'png':
      pipeline.png({
        compressionLevel: options.pngCompressionLevel,
        adaptiveFiltering: true,
        palette: true, // Use palette for smaller size
      });
      break;
  }

  // Note: Converting to JPEG/WebP/PNG strips EXIF automatically
  // No need for explicit removeMetadata() call

  // Generate buffer with timeout
  const buffer = await Promise.race([
    pipeline.toBuffer(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Size processing timeout')), 10000)
    ),
  ]) as Buffer;

  // Verify output
  const metadata = await sharp(buffer).metadata();

  return {
    buffer,
    width: metadata.width || dimensions.width,
    height: metadata.height || dimensions.height,
    size: buffer.length,
    format: options.outputFormat,
  };
}

// ============================================
// TIER-SPECIFIC PROCESSING
// ============================================

/**
 * Get processing options for a specific subscription tier
 */
export function getTierProcessingOptions(tier: SubscriptionTier): ProcessingOptions {
  return TIER_PROCESSING_LIMITS[tier] || TIER_PROCESSING_LIMITS.free;
}

/**
 * Process image with tier-specific options
 */
export async function processByTier(
  inputBuffer: Buffer,
  tier: SubscriptionTier = 'free'
): Promise<ProcessedImageResult> {
  const options = getTierProcessingOptions(tier);
  return processSecureImage(inputBuffer, options);
}

// ============================================
// SECURITY UTILITY FUNCTIONS
// ============================================

/**
 * Check if an image buffer appears to be corrupted
 */
export async function detectCorruption(buffer: Buffer): Promise<{
  isCorrupted: boolean;
  reason?: string;
}> {
  try {
    const image = sharp(buffer, { failOnError: true });
    await image.metadata();
    return { isCorrupted: false };
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('truncated') || message.includes('unexpected end of file')) {
        return { isCorrupted: true, reason: 'Truncated file' };
      }
      if (message.includes('corrupt') || message.includes('invalid')) {
        return { isCorrupted: true, reason: 'Corrupted data' };
      }
      if (message.includes('unsupported')) {
        return { isCorrupted: true, reason: 'Unsupported format' };
      }
    }
    return { isCorrupted: true, reason: 'Unknown error' };
  }
}

/**
 * Verify that EXIF data has been stripped from an image
 */
export async function verifyExifStripped(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();

    // Check for EXIF data presence
    if (metadata.exif && metadata.exif.length > 0) {
      return false;
    }

    // Check for IPTC data
    if (metadata.iptc && metadata.iptc.length > 0) {
      return false;
    }

    // Check for XMP data
    if (metadata.xmp && metadata.xmp.length > 0) {
      return false;
    }

    // Check for GPS data specifically
    if ((metadata as any).gps && Object.keys((metadata as any).gps).length > 0) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get safe image info without processing
 */
export async function getSafeImageInfo(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
  hasExif: boolean;
  hasGps: boolean;
}> {
  try {
    const metadata = await sharp(buffer).metadata();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
      hasExif: !!metadata.exif && metadata.exif.length > 0,
      hasGps: !!(metadata as any).gps && Object.keys((metadata as any).gps).length > 0,
    };
  } catch {
    return {
      width: 0,
      height: 0,
      format: 'unknown',
      size: buffer.length,
      hasExif: false,
      hasGps: false,
    };
  }
}
