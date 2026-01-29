// ============================================
// Gatherly - File Upload Validator
// ============================================
// Security-focused file validation with:
// - Magic byte verification (not just extension)
// - MIME type whitelist enforcement
// - Dimension limits (prevent pixel flood attacks)
// - Configurable size limits per tier

import sharp from 'sharp';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
  metadata?: {
    mimeType: string;
    extension: string;
    width: number;
    height: number;
    fileSize: number;
    format: string;
  };
}

export interface ValidationOptions {
  maxSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowedMimeTypes?: string[];
  allowAnimated?: boolean;
  allowOversize?: boolean;
}

// ============================================
// MAGIC BYTE SIGNATURES
// ============================================

// File signatures (magic bytes) for common image formats
const FILE_SIGNATURES: Record<string, {
  magic: (buffer: Buffer) => boolean;
  mime: string;
  extension: string;
  maxDimensions?: { width: number; height: number };
}> = {
  // JPEG - FF D8 FF
  jpeg: {
    magic: (buf) => buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF,
    mime: 'image/jpeg',
    extension: 'jpg',
  },
  // PNG - 89 50 4E 47 0D 0A 1A 0A
  png: {
    magic: (buf) => buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A,
    mime: 'image/png',
    extension: 'png',
  },
  // WebP - RIFF....WEBP
  webp: {
    magic: (buf) => buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50,
    mime: 'image/webp',
    extension: 'webp',
  },
  // HEIC - ftypheic / ftypheim / ftypheis / ftyphevc
  heic: {
    magic: (buf) => {
      if (buf.length < 12) return false;
      // Check for ftyp brand
      if (buf[4] !== 0x66 || buf[5] !== 0x74 || buf[6] !== 0x79 || buf[7] !== 0x70) return false;
      // Check for HEIC brand variants
      const brand = buf.toString('ascii', 8, 12);
      return ['heic', 'heim', 'heis', 'hevc', 'avif'].includes(brand.toLowerCase());
    },
    mime: 'image/heic',
    extension: 'heic',
    maxDimensions: { width: 8192, height: 8192 }, // HEIC has lower practical limits
  },
  // GIF - GIF87a or GIF89a
  gif: {
    magic: (buf) => buf.length >= 6 &&
      buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 &&
      buf[3] === 0x38 && ((buf[4] === 0x37 && buf[5] === 0x61) || (buf[4] === 0x39 && buf[5] === 0x61)),
    mime: 'image/gif',
    extension: 'gif',
  },
  // BMP - BM
  bmp: {
    magic: (buf) => buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4D,
    mime: 'image/bmp',
    extension: 'bmp',
  },
  // TIFF - II (little-endian) or MM (big-endian)
  tiff: {
    magic: (buf) => buf.length >= 4 &&
      ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2A && buf[3] === 0x00) ||
       (buf[0] === 0x4D && buf[1] === 0x4D && buf[2] === 0x00 && buf[3] === 0x2A)),
    mime: 'image/tiff',
    extension: 'tiff',
  },
};

// Default allowed MIME types for uploads
const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];

// ============================================
// VALIDATION OPTIONS
// ============================================

const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  maxWidth: 10000,
  maxHeight: 10000,
  allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
  allowAnimated: false,
  allowOversize: false,
};

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Validates an uploaded file with comprehensive security checks
 *
 * @param file - The File object to validate
 * @param options - Optional validation configuration
 * @returns ValidationResult with metadata if valid, error details if invalid
 */
export async function validateUploadedImage(
  file: File | Buffer,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Convert File to Buffer if needed
  let buffer: Buffer;
  let filename: string;

  if (file instanceof File) {
    buffer = Buffer.from(await file.arrayBuffer());
    filename = file.name;
  } else {
    buffer = file;
    filename = 'upload';
  }

  // ============================================
  // 1. FILE SIZE CHECK
  // ============================================
  if (buffer.length > opts.maxSizeBytes) {
    const maxSizeMB = Math.round(opts.maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
      code: 'FILE_TOO_LARGE',
    };
  }

  // Minimum file size check (prevent empty files)
  if (buffer.length < 100) {
    return {
      valid: false,
      error: 'File is too small to be a valid image',
      code: 'FILE_TOO_SMALL',
    };
  }

  // ============================================
  // 2. MAGIC BYTE VERIFICATION
  // ============================================
  let detectedFormat: keyof typeof FILE_SIGNATURES | null = null;

  for (const [format, info] of Object.entries(FILE_SIGNATURES)) {
    if (info.magic(buffer)) {
      detectedFormat = format as keyof typeof FILE_SIGNATURES;
      break;
    }
  }

  if (!detectedFormat) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPEG, PNG, WebP, and HEIC are allowed.',
      code: 'INVALID_MAGIC_BYTES',
    };
  }

  const formatInfo = FILE_SIGNATURES[detectedFormat];

  // Check if detected MIME is in allowed list
  if (!opts.allowedMimeTypes.includes(formatInfo.mime)) {
    return {
      valid: false,
      error: `File type ${formatInfo.mime} is not allowed`,
      code: 'MIME_TYPE_NOT_ALLOWED',
    };
  }

  // ============================================
  // 3. ANIMATED IMAGE CHECK (if disabled)
  // ============================================
  if (!opts.allowAnimated && (detectedFormat === 'gif')) {
    return {
      valid: false,
      error: 'Animated images are not allowed',
      code: 'ANIMATED_NOT_ALLOWED',
    };
  }

  // ============================================
  // 4. DIMENSION VALIDATION
  // ============================================
  let dimensions: { width: number; height: number };

  try {
    const metadata = await sharp(buffer, { failOnError: false }).metadata();

    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        error: 'Unable to read image dimensions',
        code: 'INVALID_DIMENSIONS',
      };
    }

    dimensions = {
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    // If sharp fails to parse, it might be corrupted or invalid
    return {
      valid: false,
      error: 'File appears to be corrupted or invalid',
      code: 'CORRUPTED_FILE',
    };
  }

  // Check format-specific dimension limits
  const formatMaxDimensions = formatInfo.maxDimensions || null;
  const maxWidth = formatMaxDimensions?.width ?? opts.maxWidth;
  const maxHeight = formatMaxDimensions?.height ?? opts.maxHeight;
  const exceedsMax = dimensions.width > maxWidth || dimensions.height > maxHeight;

  if (exceedsMax) {
    // Always enforce format-specific hard caps (ex: HEIC)
    if (formatMaxDimensions || !opts.allowOversize) {
      return {
        valid: false,
        error: `Image dimensions exceed maximum allowed size (${maxWidth}x${maxHeight})`,
        code: 'DIMENSIONS_TOO_LARGE',
      };
    }
  }

  // Minimum dimension check (prevent tiny images)
  if (dimensions.width < 10 || dimensions.height < 10) {
    return {
      valid: false,
      error: 'Image dimensions are too small (minimum 10x10 pixels)',
      code: 'DIMENSIONS_TOO_SMALL',
    };
  }

  // Aspect ratio check (prevent extreme ratios that could cause issues)
  const aspectRatio = Math.max(dimensions.width, dimensions.height) / Math.min(dimensions.width, dimensions.height);
  if (aspectRatio > 20) {
    return {
      valid: false,
      error: 'Image aspect ratio is too extreme (maximum 20:1)',
      code: 'EXTREME_ASPECT_RATIO',
    };
  }

  // ============================================
  // 5. PIXEL FLOOD CHECK
  // ============================================
  // Calculate total pixels to prevent decompression bomb attacks
  const totalPixels = dimensions.width * dimensions.height;
  const maxPixels = 100_000_000; // 100 megapixels

  if (totalPixels > maxPixels) {
    return {
      valid: false,
      error: 'Image has too many pixels and may cause processing issues',
      code: 'PIXEL_FLOOD_DETECTED',
    };
  }

  // ============================================
  // VALIDATION PASSED - RETURN METADATA
  // ============================================
  return {
    valid: true,
    metadata: {
      mimeType: formatInfo.mime,
      extension: formatInfo.extension,
      width: dimensions.width,
      height: dimensions.height,
      fileSize: buffer.length,
      format: detectedFormat,
    },
  };
}

// ============================================
// TIER-SPECIFIC VALIDATION
// ============================================

export type SubscriptionTier = 'free' | 'pro' | 'premium' | 'enterprise' | 'tester';

const TIER_LIMITS: Record<SubscriptionTier, ValidationOptions> = {
  free: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    maxWidth: 4000,
    maxHeight: 4000,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    allowAnimated: false,
  },
  pro: {
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
    maxWidth: 6000,
    maxHeight: 6000,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    allowAnimated: false,
  },
  premium: {
    maxSizeBytes: 50 * 1024 * 1024, // 50MB
    maxWidth: 10000,
    maxHeight: 10000,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
    allowAnimated: true,
  },
  enterprise: {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    maxWidth: 15000,
    maxHeight: 15000,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'image/tiff'],
    allowAnimated: true,
  },
  tester: {
    maxSizeBytes: 200 * 1024 * 1024, // 200MB
    maxWidth: 20000,
    maxHeight: 20000,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'image/tiff'],
    allowAnimated: true,
  },
};

/**
 * Get validation options for a specific subscription tier
 */
export function getTierValidationOptions(tier: SubscriptionTier): ValidationOptions {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

/**
 * Validate file with tier-specific limits
 */
export async function validateByTier(
  file: File | Buffer,
  tier: SubscriptionTier = 'free'
): Promise<ValidationResult> {
  return validateUploadedImage(file, getTierValidationOptions(tier));
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const format = Object.values(FILE_SIGNATURES).find(f => f.mime === mimeType);
  return format?.extension || 'jpg';
}

/**
 * Detect format from buffer without full validation
 */
export function detectFormatFromBuffer(buffer: Buffer): string | null {
  for (const [format, info] of Object.entries(FILE_SIGNATURES)) {
    if (info.magic(buffer)) {
      return format;
    }
  }
  return null;
}

/**
 * Check if file might be animated (GIF, animated WebP)
 */
export async function isAnimatedImage(buffer: Buffer): Promise<boolean> {
  const format = detectFormatFromBuffer(buffer);
  if (format === 'gif') return true;

  if (format === 'webp') {
    try {
      const metadata = await sharp(buffer, { failOnError: false }).metadata();
      // WebP animation is indicated by extended format
      return metadata.format === 'webp' && (metadata as any).pages !== undefined && (metadata as any).pages > 1;
    } catch {
      return false;
    }
  }

  return false;
}
