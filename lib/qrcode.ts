// ============================================
// Galeria - QR Code Generation Utilities
// ============================================

/**
 * Generate a QR code URL for event check-in
 * @param eventId - The event ID
 * @param baseUrl - The base URL of the application (defaults to window.location.origin in browser)
 * @returns The check-in URL
 */
export function generateCheckInUrl(eventId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/attendances/${eventId}/checkin`;
}

/**
 * Generate QR code API URL for the check-in page
 * Uses a reliable QR code API (goqr.me or similar)
 * @param eventId - The event ID
 * @param baseUrl - The base URL of the application
 * @returns The QR code image URL
 */
export function generateCheckInQRCodeUrl(eventId: string, baseUrl?: string): string {
  const checkInUrl = generateCheckInUrl(eventId, baseUrl);
  // Using goqr.me API for QR code generation
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}`;
}

/**
 * Generate a QR code URL for manual entry (e.g., for guest list)
 * @param data - The data to encode in the QR code
 * @param size - Size of the QR code image (default: 300x300)
 * @returns The QR code image URL
 */
export function generateQRCodeUrl(data: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

/**
 * Generate a short check-in code (for manual entry)
 * @param eventId - The event ID
 * @returns A 6-character code for manual check-in
 */
export function generateCheckInCode(eventId: string): string {
  // Generate a simple code based on event ID hash
  const hash = eventId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const code = (hash % 1000000).toString(36).toUpperCase().padStart(6, '0');
  return code;
}

/**
 * Parse check-in code and return event ID
 * @param code - The 6-character check-in code
 * @returns The event ID or null if invalid
 */
export function parseCheckInCode(code: string): string | null {
  // This is a simplified version - in production you'd want proper encoding/decoding
  // For now, return null as this would need a proper encoding scheme
  return null;
}
