// ============================================
// GALERIA - Client Fingerprint Helper
// ============================================

const STORAGE_KEY = 'galeria_fingerprint';

export function getClientFingerprint(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const fallback = createFallbackId();
  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : fallback;

  window.localStorage.setItem(STORAGE_KEY, generated);
  return generated;
}

function createFallbackId(): string {
  const now = Date.now().toString(36);
  const perf = typeof performance !== 'undefined' ? Math.floor(performance.now()).toString(36) : '0';

  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const randomHex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${now}-${perf}-${randomHex}`;
  }

  return `${now}-${perf}`;
}
