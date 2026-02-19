// ============================================
// Galeria - Utility Functions
// ============================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import QRCode from 'qrcode';
import crypto from 'crypto';

// ============================================
// CLASSNAME MERGER (Tailwind)
// ============================================

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// SLUG GENERATION
// ============================================

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a unique slug with random suffix
 */
export function generateUniqueSlug(base: string): string {
  const slug = generateSlug(base);
  const suffix = randomString(6);
  return `${slug}-${suffix}`;
}

// ============================================
// RANDOM ID GENERATION
// ============================================

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return `evt_${crypto.randomBytes(16).toString('hex').substring(0, 24)}`;
}

/**
 * Generate a unique photo ID
 */
export function generatePhotoId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique entry ID
 */
export function generateEntryId(): string {
  return `entry_${crypto.randomBytes(16).toString('hex').substring(0, 24)}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique user ID
 */
export function generateUserId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a unique tenant ID
 */
export function generateTenantId(): string {
  return crypto.randomUUID();
}

// ============================================
// QR CODE GENERATION
// ============================================

interface QRCodeOptions {
  size?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  logo?: Buffer; // Logo image buffer
}

/**
 * Generate QR code for event URL
 */
export async function generateQRCode(
  url: string,
  options: QRCodeOptions = {}
): Promise<Buffer> {
  const {
    size = 1024,
    margin = 2,
    color = {
      dark: '#000000',
      light: '#FFFFFF',
    },
  } = options;

  const qrOptions = {
    width: size,
    margin,
    color: {
      dark: color.dark,
      light: color.light,
    },
    errorCorrectionLevel: 'H' as const, // High error correction for logo embedding
  };

  try {
    const qrDataUrl = await QRCode.toDataURL(url, qrOptions);

    // Convert data URL to buffer
    const base64Data = qrDataUrl.split(',')[1];
    return Buffer.from(base64Data, 'base64');
  } catch (error) {
    console.error('[Utils] Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate event URL
 */
export function generateEventUrl(
  baseUrl: string,
  eventId: string,
  slug?: string
): string {
  if (slug) {
    return `${baseUrl}/e/${slug}`;
  }
  return `${baseUrl}/e/${eventId}`;
}

// ============================================
// BROWSER FINGERPRINTING
// ============================================

/**
 * Generate a browser fingerprint hash
 * This should be called client-side
 */
export function generateFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    // Fallback to basic fingerprint
    return hashString(`${navigator.userAgent}-${navigator.language}-${screen.width}x${screen.height}`);
  }

  // Canvas fingerprint
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('Hello, world!', 2, 15);

  const canvasData = canvas.toDataURL();

  // Additional fingerprint components
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvasData,
  ];

  return hashString(components.join('|'));
}

/**
 * Simple hash function for fingerprinting
 */
function hashString(input: string): string {
  return crypto
    .createHash('sha256')
    .update(input)
    .digest('hex')
    .substring(0, 32);
}

// ============================================
// IMAGE PROCESSING
// ============================================

/**
 * Get image dimensions from file
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

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

/**
 * Compress image on client-side
 */
export async function compressImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<Blob> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions
      let { width, height } = { width: img.width, height: img.height };

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create canvas and resize
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

// ============================================
// FILE UPLOAD HELPERS
// ============================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

// ============================================
// DATE/TIME HELPERS
// ============================================

/**
 * Format date for display
 */
export function formatDate(date: Date | string, locale = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date and time for display
 */
export function formatDateTime(
  date: Date | string,
  locale = 'en-US',
  timeZone?: string
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

/**
 * Get relative time (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return formatDate(d);
}

// ============================================
// STRING HELPERS
// ============================================

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate random string
 */
export function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charArray = chars.split('');
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charArray[secureRandom(0, charArray.length)];
  }
  return result;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate hex color
 */
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

// ============================================
// NUMBER FORMATTING
// ============================================

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// ============================================
// URL HELPERS
// ============================================

/**
 * Get public URL for a file
 */
export function getPublicUrl(
  path: string,
  baseUrl?: string
): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || '';
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

// ============================================
// ERROR HELPERS
// ============================================

/**
 * Get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Create API error response
 */
export function createApiError(
  message: string,
  code?: string,
  details?: Record<string, unknown>
) {
  return {
    error: message,
    code,
    details,
  };
}

// ============================================
// ARRAY HELPERS
// ============================================

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Shuffle array
 */
export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandom(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get random element from array
 */
export function randomElement<T>(array: T[]): T {
  return secureRandomChoice(array);
}

// ============================================
// ASYNC HELPERS
// ============================================

/**
 * Delay execution
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        const waitTime = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        await delay(waitTime);
      }
    }
  }

  throw lastError;
}

// ============================================
// CRYPTOGRAPHIC RANDOM
// ============================================

/**
 * Generate cryptographically secure random number
 */
export function secureRandom(min: number, max: number): number {
  const range = max - min;
  if (range <= 0) {
    return min;
  }
  const randomUint32 = getRandomUint32();
  return min + (randomUint32 % range);
}

/**
 * Generate cryptographically secure random choice from array
 */
export function secureRandomChoice<T>(array: T[]): T {
  const index = secureRandom(0, array.length);
  return array[index];
}

function getRandomUint32(): number {
  if (typeof globalThis.crypto !== 'undefined' && 'getRandomValues' in globalThis.crypto) {
    const bytes = new Uint32Array(1);
    globalThis.crypto.getRandomValues(bytes);
    return bytes[0] ?? 0;
  }

  const bytes = crypto.randomBytes(4);
  return bytes.readUInt32BE(0);
}
