// ============================================
// Galeria - Redis Client Singleton
// ============================================
// Multi-tenant Redis with automatic reconnection, connection pooling
// Used for: Session storage, rate limiting, WebSocket pub/sub

import Redis from 'ioredis';
import type { Redis as RedisType } from 'ioredis';

// ============================================
// CONFIGURATION
// ============================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);

// Check if a URL has a scheme (redis:// or rediss://)
function hasScheme(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
}

// Parse host:port strings for connection options
function parseHostPort(value: string): { host: string; port: number } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { host: 'localhost', port: 6379 };
  }

  const [hostPart, portPart] = trimmed.split(':');
  const parsedPort = parseInt(portPart || '6379', 10);
  return {
    host: hostPart || 'localhost',
    port: Number.isNaN(parsedPort) ? 6379 : parsedPort,
  };
}

// ============================================
// REDIS CLIENT SINGLETON
// ============================================

let redisClient: RedisType | null = null;
const logRedisEvents = !process.env.JEST_WORKER_ID;

/**
 * Get or create the Redis client singleton
 * Uses lazy connection pattern for better startup performance
 */
export function getRedisClient(): RedisType {
  if (!redisClient) {
    const redisOptions = {
      password: REDIS_PASSWORD || undefined,
      db: REDIS_DB,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 100, 3000);
        if (times > 10) {
          console.error('[REDIS] Max reconnection attempts reached');
          return null;
        }
        console.log(`[REDIS] Reconnecting... Attempt ${times}`);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
    };

    if (hasScheme(REDIS_URL)) {
      const parsed = new URL(REDIS_URL);
      if (parsed.protocol === 'rediss:') {
        (redisOptions as { tls?: Record<string, unknown> }).tls = {};
      }
      redisClient = new Redis(REDIS_URL, redisOptions);
    } else {
      const { host, port } = parseHostPort(REDIS_URL);
      redisClient = new Redis({
        host,
        port,
        ...redisOptions,
      });
    }

    // Event listeners for monitoring
    redisClient.on('connect', () => {
      if (logRedisEvents) {
        console.log('[REDIS] Connecting to Redis...');
      }
    });

    redisClient.on('ready', () => {
      if (logRedisEvents) {
        console.log('[REDIS] Redis connection ready');
      }
    });

    redisClient.on('error', (err) => {
      if (logRedisEvents) {
        console.error('[REDIS] Connection error:', err.message);
      }
    });

    redisClient.on('close', () => {
      if (logRedisEvents) {
        console.log('[REDIS] Connection closed');
      }
    });

    redisClient.on('reconnecting', () => {
      if (logRedisEvents) {
        console.log('[REDIS] Reconnecting...');
      }
    });
  }

  return redisClient;
}

/**
 * Alias for getRedisClient() for semantic clarity
 */
export { getRedisClient as getRedis };

// ============================================
// CONNECTION MANAGEMENT
// ============================================

/**
 * Initialize Redis connection
 * Call this during application startup
 */
export async function initRedis(): Promise<void> {
  const client = getRedisClient();
  if (client.status === 'ready') {
    return;
  }
  await client.connect();
}

/**
 * Gracefully close the Redis connection
 * Should be called on application shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[REDIS] Connection closed gracefully');
  }
}

// ============================================
// HEALTH CHECK
// ============================================

export interface RedisHealthResult {
  healthy: boolean;
  latency: number;
  status: string;
}

/**
 * Check if Redis is accessible
 */
export async function healthCheckRedis(): Promise<RedisHealthResult> {
  const client = getRedisClient();

  try {
    const start = Date.now();
    const pong = await client.ping();
    const latency = Date.now() - start;

    if (pong === 'PONG') {
      return {
        healthy: true,
        latency,
        status: client.status,
      };
    } else {
      return {
        healthy: false,
        latency: -1,
        status: client.status,
      };
    }
  } catch (error) {
    console.error('[REDIS] Health check failed:', error);
    return {
      healthy: false,
      latency: -1,
      status: 'error',
    };
  }
}

// ============================================
// REDIS UTILITIES
// ============================================

/**
 * Set a key with expiration
 */
export async function setKeyWithExpiry<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  try {
    const client = getRedisClient();
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    console.warn('[REDIS] setKeyWithExpiry failed:', error instanceof Error ? error.message : error);
    // Fail silently in development - session won't persist but auth won't crash
  }
}

/**
 * Get a key from Redis
 */
export async function getKey<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const data = await client.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  } catch (error) {
    console.warn('[REDIS] getKey failed:', error instanceof Error ? error.message : error);
    return null; // Return null when Redis unavailable - treated as "not found"
  }
}

/**
 * Get raw string value from Redis
 */
export async function getRawKey(key: string): Promise<string | null> {
  const client = getRedisClient();
  return await client.get(key);
}

/**
 * Set raw string value with expiration
 */
export async function setRawKey(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  const client = getRedisClient();
  if (ttlSeconds) {
    await client.set(key, value, 'EX', ttlSeconds);
  } else {
    await client.set(key, value);
  }
}

/**
 * Delete a key from Redis
 */
export async function deleteKey(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    return await client.del(key);
  } catch (error) {
    console.warn('[REDIS] deleteKey failed:', error instanceof Error ? error.message : error);
    return 0; // Return 0 (nothing deleted) when Redis unavailable
  }
}

/**
 * Delete multiple keys
 */
export async function deleteKeys(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const client = getRedisClient();
  return await client.del(...keys);
}

/**
 * Check if a key exists in Redis
 */
export async function keyExists(key: string): Promise<boolean> {
  const client = getRedisClient();
  const exists = await client.exists(key);
  return exists === 1;
}

/**
 * Set expiration time for a key
 */
export async function setExpiry(key: string, ttlSeconds: number): Promise<boolean> {
  const client = getRedisClient();
  const result = await client.expire(key, ttlSeconds);
  return result === 1;
}

/**
 * Get remaining TTL for a key (in seconds)
 */
export async function getTTL(key: string): Promise<number> {
  const client = getRedisClient();
  return await client.ttl(key);
}

// ============================================
// COUNTER UTILITIES (for rate limiting)
// ============================================

/**
 * Increment a counter (for rate limiting)
 * @returns The new value after incrementing
 */
export async function incrementCounter(
  key: string,
  incrBy: number = 1,
  ttlSeconds?: number
): Promise<number> {
  const client = getRedisClient();

  // For conditional TTL, we need to check the current value first
  if (ttlSeconds) {
    const currentValue = await client.get(key);
    if (!currentValue) {
      // First time setting this key - use a transaction
      const multi = client.multi();
      multi.incrby(key, incrBy);
      multi.expire(key, ttlSeconds);
      const results = await multi.exec();
      return results?.[0]?.[1] as number || 0;
    }
  }

  // Regular increment without TTL or key already exists
  const value = await client.incrby(key, incrBy);

  // Set TTL if specified (may refresh existing TTL)
  if (ttlSeconds) {
    await client.expire(key, ttlSeconds);
  }

  return value;
}

/**
 * Get current counter value
 */
export async function getCounter(key: string): Promise<number> {
  const client = getRedisClient();
  const value = await client.get(key);
  return value ? parseInt(value, 10) : 0;
}

/**
 * Reset a counter
 */
export async function resetCounter(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

// ============================================
// HASH UTILITIES
// ============================================

/**
 * Set field in hash
 */
export async function hSet(
  key: string,
  field: string,
  value: string
): Promise<number> {
  const client = getRedisClient();
  return await client.hset(key, field, value);
}

/**
 * Get field from hash
 */
export async function hGet(
  key: string,
  field: string
): Promise<string | null> {
  const client = getRedisClient();
  return await client.hget(key, field);
}

/**
 * Get all fields from hash
 */
export async function hGetAll(key: string): Promise<Record<string, string>> {
  const client = getRedisClient();
  return await client.hgetall(key);
}

/**
 * Delete field from hash
 */
export async function hDel(key: string, field: string): Promise<number> {
  const client = getRedisClient();
  return await client.hdel(key, field);
}

// ============================================
// LIST UTILITIES
// ============================================

/**
 * Push to list (left)
 */
export async function lPush(key: string, ...values: string[]): Promise<number> {
  const client = getRedisClient();
  return await client.lpush(key, ...values);
}

/**
 * Pop from list (right)
 */
export async function rPop(key: string): Promise<string | null> {
  const client = getRedisClient();
  return await client.rpop(key);
}

/**
 * Get list length
 */
export async function lLen(key: string): Promise<number> {
  const client = getRedisClient();
  return await client.llen(key);
}

/**
 * Get list range
 */
export async function lRange(
  key: string,
  start: number,
  stop: number
): Promise<string[]> {
  const client = getRedisClient();
  return await client.lrange(key, start, stop);
}

// ============================================
// EXPORT SINGLETON (Direct Access)
// ============================================

export default getRedisClient;
