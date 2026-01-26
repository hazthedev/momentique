// ============================================
// MOMENTIQUE - Rate Limiting
// ============================================
// Redis-based rate limiting for API endpoints and authentication
// Implements sliding window and token bucket algorithms

import { getRedisClient } from './redis';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Rate limit configuration for different endpoints/actions
 */
export interface IRateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix: string;
}

// Predefined rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  // Login: 5 attempts per 15 minutes per email
  loginEmail: {
    maxRequests: 999999,
    windowSeconds: 900, // 15 minutes
    keyPrefix: 'ratelimit:login:email',
  },

  // Login: 10 attempts per 15 minutes per IP
  loginIp: {
    maxRequests: 999999,
    windowSeconds: 900, // 15 minutes
    keyPrefix: 'ratelimit:login:ip',
  },

  // Register: 1 registration per hour per email
  registerEmail: {
    maxRequests: 999999,
    windowSeconds: 3600, // 1 hour
    keyPrefix: 'ratelimit:register:email',
  },

  // Register: 3 registrations per hour per IP
  registerIp: {
    maxRequests: 999999,
    windowSeconds: 3600, // 1 hour
    keyPrefix: 'ratelimit:register:ip',
  },

  // Password reset: 3 attempts per hour per email
  passwordResetEmail: {
    maxRequests: 999999,
    windowSeconds: 3600, // 1 hour
    keyPrefix: 'ratelimit:passwordreset:email',
  },

  // API: 100 requests per minute per user
  apiUser: {
    maxRequests: 999999,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:api:user',
  },

  // API: 1000 requests per minute per IP (for anonymous)
  apiIp: {
    maxRequests: 999999,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:api:ip',
  },

  // Photo upload: 10 uploads per minute per user
  photoUploadUser: {
    maxRequests: 999999,
    windowSeconds: 60, // 1 minute
    keyPrefix: 'ratelimit:upload:user',
  },

  // Generic: 100 requests per minute
  generic: {
    maxRequests: 999999,
    windowSeconds: 60,
    keyPrefix: 'ratelimit:generic',
  },
} as const;

// ============================================
// TYPES
// ============================================

/**
 * Rate limit check result
 */
export interface IRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
  windowSeconds: number;
}

/**
 * Rate limit error details
 */
export interface IRateLimitError {
  retryAfter: number; // seconds until retry
  limit: number;
  windowSeconds: number;
}

// ============================================
// SLIDING WINDOW RATE LIMITING
// ============================================

/**
 * Check rate limit using sliding window algorithm
 * More accurate than fixed window, prevents burst attacks at window boundaries
 *
 * @param identifier - Unique identifier (email, IP, user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  identifier: string,
  config: IRateLimitConfig
): Promise<IRateLimitResult> {
  try {
    const redis = getRedisClient();
    const key = `${config.keyPrefix}:${identifier}`;
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    const windowStart = now - config.windowSeconds;

    // Remove expired entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count requests in the current window
    const count = await redis.zcard(key);

    // Check if limit exceeded
    const allowed = count < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count - 1);

    // If allowed, add current request
    if (allowed) {
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      // Set expiry on the key (cleanup old entries)
      await redis.expire(key, config.windowSeconds);
    }

    // Calculate reset time (oldest entry + window)
    const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
    let resetAt = new Date((now + config.windowSeconds) * 1000);

    if (oldestEntry.length > 0) {
      const oldestScore = parseFloat(oldestEntry[1] as string);
      resetAt = new Date((oldestScore + config.windowSeconds) * 1000);
    }

    return {
      allowed,
      remaining,
      resetAt,
      limit: config.maxRequests,
      windowSeconds: config.windowSeconds,
    };
  } catch (error) {
    // Redis unavailable - allow request to proceed (fail open for development)
    // In production, you may want to fail closed instead
    console.warn('[RATE_LIMIT] Redis unavailable, skipping rate limit check:', error instanceof Error ? error.message : error);
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      limit: config.maxRequests,
      windowSeconds: config.windowSeconds,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 *
 * @param identifier - Unique identifier
 * @param config - Rate limit configuration
 * @returns Rate limit status
 */
export async function getRateLimitStatus(
  identifier: string,
  config: IRateLimitConfig
): Promise<{ count: number; resetAt: Date; limit: number }> {
  const redis = getRedisClient();
  const key = `${config.keyPrefix}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  // Remove expired entries
  await redis.zremrangebyscore(key, 0, windowStart);

  // Count requests in the current window
  const count = await redis.zcard(key);

  // Get oldest entry for reset time
  const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
  let resetAt = new Date((now + config.windowSeconds) * 1000);

  if (oldestEntry.length > 0) {
    const oldestScore = parseFloat(oldestEntry[1] as string);
    resetAt = new Date((oldestScore + config.windowSeconds) * 1000);
  }

  return {
    count,
    resetAt,
    limit: config.maxRequests,
  };
}

/**
 * Reset rate limit for an identifier
 * Useful for admin actions or testing
 *
 * @param identifier - Unique identifier
 * @param config - Rate limit configuration
 */
export async function resetRateLimit(
  identifier: string,
  config: IRateLimitConfig
): Promise<void> {
  const redis = getRedisClient();
  const key = `${config.keyPrefix}:${identifier}`;
  await redis.del(key);
}

// ============================================
// TOKEN BUCKET RATE LIMITING
// ============================================

/**
 * Token bucket rate limiting
 * Allows bursts up to bucket capacity, then refills at a steady rate
 *
 * @param identifier - Unique identifier
 * @param capacity - Maximum tokens in bucket
 * @param refillRate - Tokens to add per second
 * @param tokensRequired - Tokens needed for this request
 * @returns Rate limit check result
 */
export async function checkTokenBucket(
  identifier: string,
  capacity: number,
  refillRate: number, // tokens per second
  tokensRequired: number = 1
): Promise<IRateLimitResult> {
  const redis = getRedisClient();
  const key = `tokenbucket:${identifier}`;
  const now = Date.now();
  const refillIntervalMs = 1000; // 1 second

  // Lua script for atomic token bucket check and refill
  const luaScript = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local capacity = tonumber(ARGV[2])
    local refill_rate = tonumber(ARGV[3])
    local tokens_required = tonumber(ARGV[4])
    local refill_interval_ms = tonumber(ARGV[5])

    -- Get current bucket state
    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1]) or capacity
    local last_refill = tonumber(bucket[2]) or now

    -- Calculate tokens to add
    local time_passed = now - last_refill
    local tokens_to_add = math.floor(time_passed / refill_interval_ms) * refill_rate

    -- Refill tokens (but don't exceed capacity)
    tokens = math.min(capacity, tokens + tokens_to_add)

    -- Check if request is allowed
    local allowed = tokens >= tokens_required

    -- Deduct tokens if allowed
    if allowed then
      tokens = tokens - tokens_required
    end

    -- Update bucket state
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 60)

    -- Return result
    return {allowed, tokens, capacity}
  `;

  try {
    const result = await redis.eval(
      luaScript,
      1,
      key,
      now.toString(),
      capacity.toString(),
      refillRate.toString(),
      tokensRequired.toString(),
      refillIntervalMs.toString()
    ) as [boolean, string, number];

    const [allowed, remainingTokens] = result;

    // Calculate reset time (time to refill to capacity)
    const currentTokens = parseFloat(remainingTokens as string);
    const tokensNeeded = capacity - currentTokens;
    const secondsToRefill = Math.ceil(tokensNeeded / refillRate);
    const resetAt = new Date(now + (secondsToRefill * 1000));

    return {
      allowed,
      remaining: Math.floor(currentTokens),
      resetAt,
      limit: capacity,
      windowSeconds: Math.ceil(capacity / refillRate),
    };
  } catch (error) {
    console.error('[RATE_LIMIT] Token bucket check failed:', error);
    // SECURITY: Fail closed (deny on error) to prevent bypass attempts
    // Attackers could intentionally cause Redis errors to bypass rate limiting
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60000),
      limit: capacity,
      windowSeconds: Math.ceil(capacity / refillRate),
    };
  }
}

// ============================================
// COMBINED RATE LIMITING (Multiple Limits)
// ============================================

/**
 * Check multiple rate limits and return the most restrictive result
 * Useful for applying both per-user and per-IP limits
 *
 * @param identifier - Unique identifier
 * @param configs - Array of rate limit configurations
 * @returns Most restrictive rate limit result
 */
export async function checkMultipleRateLimits(
  identifier: string,
  configs: IRateLimitConfig[]
): Promise<IRateLimitResult> {
  const results = await Promise.all(
    configs.map(config => checkRateLimit(identifier, config))
  );

  // Find the most restrictive result (lowest remaining)
  const mostRestrictive = results.reduce((prev, curr) => {
    return curr.remaining < prev.remaining ? curr : prev;
  });

  return mostRestrictive;
}

// ============================================
// AUTHENTICATION RATE LIMITING
// ============================================

/**
 * Check login rate limits (both email and IP)
 * Request is allowed only if BOTH limits allow it
 *
 * @param email - User's email
 * @param ipAddress - User's IP address
 * @returns Combined rate limit result
 */
export async function checkLoginRateLimit(
  email: string,
  ipAddress: string
): Promise<IRateLimitResult> {
  const normalizedEmail = email.toLowerCase().trim();

  const [emailResult, ipResult] = await Promise.all([
    checkRateLimit(normalizedEmail, RATE_LIMIT_CONFIGS.loginEmail),
    checkRateLimit(ipAddress, RATE_LIMIT_CONFIGS.loginIp),
  ]);

  // Both must be allowed
  const allowed = emailResult.allowed && ipResult.allowed;
  const remaining = Math.min(emailResult.remaining, ipResult.remaining);

  // Return the earliest reset time
  const resetAt = emailResult.resetAt < ipResult.resetAt
    ? emailResult.resetAt
    : ipResult.resetAt;

  return {
    allowed,
    remaining,
    resetAt,
    limit: Math.min(emailResult.limit, ipResult.limit),
    windowSeconds: Math.max(emailResult.windowSeconds, ipResult.windowSeconds),
  };
}

/**
 * Check registration rate limits (both email and IP)
 * Request is allowed only if BOTH limits allow it
 *
 * @param email - User's email
 * @param ipAddress - User's IP address
 * @returns Combined rate limit result
 */
export async function checkRegistrationRateLimit(
  email: string,
  ipAddress: string
): Promise<IRateLimitResult> {
  const normalizedEmail = email.toLowerCase().trim();

  const [emailResult, ipResult] = await Promise.all([
    checkRateLimit(normalizedEmail, RATE_LIMIT_CONFIGS.registerEmail),
    checkRateLimit(ipAddress, RATE_LIMIT_CONFIGS.registerIp),
  ]);

  // Both must be allowed
  const allowed = emailResult.allowed && ipResult.allowed;
  const remaining = Math.min(emailResult.remaining, ipResult.remaining);

  // Return the earliest reset time
  const resetAt = emailResult.resetAt < ipResult.resetAt
    ? emailResult.resetAt
    : ipResult.resetAt;

  return {
    allowed,
    remaining,
    resetAt,
    limit: Math.min(emailResult.limit, ipResult.limit),
    windowSeconds: Math.max(emailResult.windowSeconds, ipResult.windowSeconds),
  };
}

// ============================================
// MIDDLEWARE HELPERS
// ============================================

/**
 * Set rate limit headers on a Response object
 */
export function setRateLimitHeaders(
  response: Response,
  result: IRateLimitResult
): void {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000).toString());

  // Copy to response (this is for documentation; actual implementation depends on context)
  // In Next.js route handlers, you would return these headers in the Response
}

/**
 * Get retry-after value in seconds
 */
export function getRetryAfter(result: IRateLimitResult): number {
  const now = Math.floor(Date.now() / 1000);
  const resetAt = Math.floor(result.resetAt.getTime() / 1000);
  return Math.max(0, resetAt - now);
}

/**
 * Create a rate limit error response
 */
export interface IRateLimitErrorResponse {
  error: string;
  message: string;
  retryAfter: number;
  limit: number;
  windowSeconds: number;
}

export function createRateLimitErrorResponse(
  result: IRateLimitResult
): IRateLimitErrorResponse {
  return {
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please try again later.',
    retryAfter: getRetryAfter(result),
    limit: result.limit,
    windowSeconds: result.windowSeconds,
  };
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Get all rate limit keys matching a pattern
 * Useful for admin dashboards
 */
export async function getRateLimitKeys(pattern: string): Promise<string[]> {
  const redis = getRedisClient();
  const keys: string[] = [];

  let cursor = '0';
  do {
    const [newCursor, scannedKeys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      '100'
    );
    cursor = newCursor;
    keys.push(...scannedKeys);
  } while (cursor !== '0');

  return keys;
}

/**
 * Clear all rate limit keys matching a pattern
 * Use with caution!
 */
export async function clearRateLimitPattern(pattern: string): Promise<number> {
  const keys = await getRateLimitKeys(pattern);
  if (keys.length === 0) return 0;

  const redis = getRedisClient();
  return await redis.del(...keys);
}
