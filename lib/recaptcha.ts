// ============================================
// MOMENTIQUE - reCAPTCHA v3 Validation
// ============================================
// Google reCAPTCHA v3 for bot protection on anonymous uploads
// Score: 0.0 (bot) to 1.0 (human)
// Threshold: 0.5 (configurable per tenant)

import { getRedisClient } from './redis';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface RecaptchaVerifyResult {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export interface RecaptchaValidationResult {
  valid: boolean;
  score?: number;
  error?: string;
  code?: string;
}

export interface RecaptchaConfig {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
  threshold: number;
  minScoreForAnonymous?: number;
  requireForUploads?: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

// Default configuration (can be overridden by tenant settings)
const DEFAULT_RECAPTCHA_CONFIG: RecaptchaConfig = {
  enabled: true,
  siteKey: process.env.RECAPTCHA_SITE_KEY || '',
  secretKey: process.env.RECAPTCHA_SECRET_KEY || '',
  threshold: 0.5,
  minScoreForAnonymous: 0.3, // More lenient for anonymous uploads
  requireForUploads: true,
};

// ============================================
// VERIFICATION
// ============================================

/**
 * Verify a reCAPTCHA v3 token with Google
 *
 * @param token - The reCAPTCHA token from the client
 * @param secretKey - The secret key for verification
 * @returns Verification result from Google
 */
export async function verifyRecaptchaToken(
  token: string,
  secretKey: string = DEFAULT_RECAPTCHA_CONFIG.secretKey
): Promise<RecaptchaVerifyResult> {
  if (!secretKey) {
    return {
      success: false,
      'error-codes': ['missing-secret-key'],
    };
  }

  if (!token) {
    return {
      success: false,
      'error-codes': ['missing-token'],
    };
  }

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const result = (await response.json()) as RecaptchaVerifyResult;

    // Cache verification result for 5 minutes (token can be verified multiple times)
    if (result.success && result.score !== undefined) {
      await cacheVerificationResult(token, result);
    }

    return result;
  } catch (error) {
    console.error('[RECAPTCHA] Verification failed:', error);
    return {
      success: false,
      'error-codes': ['network-error'],
    };
  }
}

/**
 * Check if a verification result is cached in Redis
 */
async function getCachedVerification(
  token: string
): Promise<RecaptchaVerifyResult | null> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get(`recaptcha:verify:${token}`);

    if (cached) {
      return JSON.parse(cached) as RecaptchaVerifyResult;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Cache verification result to avoid repeated API calls
 */
async function cacheVerificationResult(
  token: string,
  result: RecaptchaVerifyResult
): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.setex(
      `recaptcha:verify:${token}`,
      300, // 5 minutes
      JSON.stringify(result)
    );
  } catch (error) {
    console.warn('[RECAPTCHA] Failed to cache verification:', error);
  }
}

/**
 * Validate reCAPTCHA for an upload request
 *
 * @param token - The reCAPTCHA token from the client
 * @param config - Optional custom configuration
 * @returns Validation result with score and decision
 */
export async function validateRecaptchaForUpload(
  token: string,
  config: Partial<RecaptchaConfig> = {}
): Promise<RecaptchaValidationResult> {
  const fullConfig = { ...DEFAULT_RECAPTCHA_CONFIG, ...config };

  // If reCAPTCHA is disabled, allow all requests
  if (!fullConfig.enabled) {
    return {
      valid: true,
      score: 1.0,
    };
  }

  // Check cache first
  const cached = await getCachedVerification(token);
  const verifyResult = cached || await verifyRecaptchaToken(token, fullConfig.secretKey);

  if (!verifyResult.success) {
    return {
      valid: false,
      error: 'CAPTCHA verification failed',
      code: verifyResult['error-codes']?.join(',') || 'verification_failed',
    };
  }

  if (verifyResult.score === undefined) {
    return {
      valid: false,
      error: 'CAPTCHA score not available',
      code: 'no_score',
    };
  }

  // Check score against threshold
  const threshold = fullConfig.minScoreForAnonymous ?? fullConfig.threshold;
  const passed = verifyResult.score >= threshold;

  return {
    valid: passed,
    score: verifyResult.score,
    error: passed ? undefined : `Score ${verifyResult.score.toFixed(2)} below threshold ${threshold}`,
    code: passed ? undefined : 'low_score',
  };
}

// ============================================
// TENANT-SPECIFIC CONFIGURATION
// ============================================

/**
 * Get reCAPTCHA configuration for a specific tenant
 * In production, this would be fetched from the tenant's settings
 */
export function getTenantRecaptchaConfig(tenantId?: string): RecaptchaConfig {
  // TODO: Fetch from tenant settings in database
  // For now, return default config

  if (!tenantId) {
    return DEFAULT_RECAPTCHA_CONFIG;
  }

  // Tenant-specific overrides could be loaded here
  // Example: Higher threshold for trusted tenants, custom keys for enterprise
  return DEFAULT_RECAPTCHA_CONFIG;
}

/**
 * Check if reCAPTCHA is required for uploads for a tenant
 */
export function isRecaptchaRequiredForUploads(
  tenantId?: string,
  isAuthenticated: boolean = false
): boolean {
  const config = getTenantRecaptchaConfig(tenantId);

  // Authenticated users may skip reCAPTCHA based on config
  if (isAuthenticated && !config.requireForUploads) {
    return false;
  }

  return config.enabled;
}

// ============================================
// CLIENT-SIDE HELPERS
// ============================================

/**
 * Get the reCAPTCHA site key for client-side rendering
 */
export function getRecaptchaSiteKey(tenantId?: string): string {
  const config = getTenantRecaptchaConfig(tenantId);
  return config.siteKey;
}

/**
 * Check if reCAPTCHA should be rendered (for conditional UI)
 */
export function shouldRenderRecaptcha(tenantId?: string): boolean {
  const config = getTenantRecaptchaConfig(tenantId);
  return config.enabled && !!config.siteKey;
}

// ============================================
// CHALLENGE FALLBACK
// ============================================

/**
 * Generate a simple math challenge as fallback when reCAPTCHA fails
 */
export function generateMathChallenge(): {
  question: string;
  answer: number;
  sessionId: string;
} {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;

  return {
    question: `${a} + ${b} = ?`,
    answer: a + b,
    sessionId: `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
  };
}

/**
 * Store challenge answer in Redis for verification
 */
export async function storeChallenge(
  sessionId: string,
  answer: number,
  ttlSeconds: number = 300 // 5 minutes
): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.setex(
      `recaptcha:challenge:${sessionId}`,
      ttlSeconds,
      answer.toString()
    );
  } catch (error) {
    console.error('[RECAPTCHA] Failed to store challenge:', error);
  }
}

/**
 * Verify challenge answer
 */
export async function verifyChallenge(
  sessionId: string,
  userAnswer: number
): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const stored = await redis.get(`recaptcha:challenge:${sessionId}`);

    if (!stored) {
      return false;
    }

    const correctAnswer = parseInt(stored, 10);
    return correctAnswer === userAnswer;
  } catch {
    return false;
  }
}

/**
 * Clean up expired challenge session
 */
export async function cleanupChallenge(sessionId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(`recaptcha:challenge:${sessionId}`);
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Get reCAPTCHA statistics for admin dashboard
 */
export async function getRecaptchaStats(tenantId?: string): Promise<{
  totalVerifications: number;
  averageScore: number;
  passRate: number;
  lowScoreCount: number;
}> {
  // TODO: Implement stats collection
  // For now, return placeholder data
  return {
    totalVerifications: 0,
    averageScore: 0,
    passRate: 0,
    lowScoreCount: 0,
  };
}
