/**
 * Content Moderation Initialization
 *
 * Call this during application startup to initialize the AI content
 * moderation system including the background worker for scanning photos.
 */

import { initializeContentScanning } from '../../jobs/scan-content';
import { cleanupExpiredQuarantine } from '../storage/quarantine';

let initialized = false;
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the content moderation system
 * Should be called during application startup
 */
export async function initializeContentModeration(): Promise<void> {
  if (initialized) {
    console.log('[MODERATION] Already initialized');
    return;
  }

  try {
    // Initialize the scanning queue and worker
    await initializeContentScanning();

    // Start periodic cleanup of expired quarantine items (daily)
    cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await cleanupExpiredQuarantine();
        if (cleaned > 0) {
          console.log(`[MODERATION] Cleaned up ${cleaned} expired quarantined photos`);
        }
      } catch (error) {
        console.error('[MODERATION] Cleanup job failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run daily

    initialized = true;
    console.log('[MODERATION] Content moderation system initialized');
  } catch (error) {
    console.error('[MODERATION] Failed to initialize:', error);
    throw error;
  }
}

/**
 * Shutdown the content moderation system
 * Should be called during graceful shutdown
 */
export async function shutdownContentModeration(): Promise<void> {
  if (!initialized) {
    return;
  }

  try {
    const { shutdownContentScanning } = await import('../../jobs/scan-content');
    await shutdownContentScanning();

    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }

    initialized = false;
    console.log('[MODERATION] Content moderation system shut down');
  } catch (error) {
    console.error('[MODERATION] Shutdown error:', error);
  }
}

/**
 * Check if content moderation is initialized
 */
export function isModerationInitialized(): boolean {
  return initialized;
}
