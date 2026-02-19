// ============================================
// Galeria - Short Code Generation
// ============================================
// Generate memorable short codes for event sharing

import { randomBytes } from 'crypto';
import { getTenantDb } from './db';

/**
 * Generate a random short code
 * Format: 4-6 lowercase letters and numbers
 * Examples: "helo", "abc123", "party"
 */
export function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomBuffer = randomBytes(1);
    const randomIndex = randomBuffer[0] % chars.length;
    result += chars[randomIndex];
  }

  return result;
}

/**
 * Generate a custom short code based on event name
 * Converts name to short code, makes it URL-safe
 * Examples: "johns-birthday" → "johnbd", "company party" → "comparty"
 */
export function generateShortCodeFromName(name: string): string {
  // Remove special characters, lowercase
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  // Take first few characters or generate random
  if (cleaned.length >= 4) {
    // Take first 4-6 characters, removing spaces
    const code = cleaned.replace(/\s+/g, '').substring(0, 6);
    if (code.length >= 4) {
      return code;
    }
  }

  // Fallback to random generation
  return generateShortCode();
}

/**
 * Generate a unique short code that doesn't already exist
 * @param tenantId - Tenant ID
 * @param suggestedCode - Optional suggested code
 * @returns A unique short code
 */
export async function generateUniqueShortCode(
  tenantId: string,
  suggestedCode?: string
): Promise<string> {
  const db = getTenantDb(tenantId);

  // If suggested code is provided, check if it's available
  if (suggestedCode && suggestedCode.length >= 3 && suggestedCode.length <= 20) {
    // Check if this code is already taken
    const existing = await db.findOne('events', { short_code: suggestedCode });
    if (!existing) {
      // Sanitize the code (only lowercase letters and numbers)
      const sanitized = suggestedCode
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      if (sanitized.length >= 3 && sanitized.length <= 20) {
        return sanitized;
      }
    }
  }

  // Generate random codes until we find one that's not taken
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const code = generateShortCode(5);
    const existing = await db.findOne('events', { short_code: code });

    if (!existing) {
      return code;
    }

    attempts++;
  }

  // Fallback to longer random code with more entropy
  return generateShortCode(8);
}

/**
 * Resolve a short code to get the event
 * @param tenantId - Tenant ID
 * @param shortCode - The short code to resolve
 * @returns The event or null if not found
 */
export async function resolveShortCode(
  tenantId: string,
  shortCode: string
): Promise<{ id: string; name: string } | null> {
  const db = getTenantDb(tenantId);

  const event = await db.findOne('events', { short_code: shortCode });

  if (!event) {
    return null;
  }

  return {
    id: event.id,
    name: event.name,
  };
}
