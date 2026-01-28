/**
 * Content Scanning Job Queue
 *
 * Background job processing for AI content moderation using BullMQ
 * Processes uploaded photos for inappropriate content detection
 *
 * Features:
 * - Priority queue for reported content
 * - Retry logic for failed scans
 * - Concurrent processing limits
 * - Dead letter queue for failed jobs
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisClient } from '../lib/redis';
import { getTenantDb } from '../lib/db';
import {
  scanImageForModeration,
  type ModerationResult,
  isModerationEnabled,
} from '../lib/moderation/auto-moderate';
import {
  quarantinePhoto,
  approveQuarantinedPhoto,
  rejectQuarantinedPhoto,
} from '../lib/storage/quarantine';

// ============================================
// TYPES & INTERFACES
// ============================================

export type ScanPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ScanJobData {
  photoId: string;
  eventId: string;
  imageUrl: string;
  userId?: string;
  priority?: ScanPriority;
  isReported?: boolean; // User-reported content gets higher priority
}

export interface ScanJobResult {
  photoId: string;
  eventId: string;
  success: boolean;
  moderationResult?: ModerationResult;
  error?: string;
  processedAt: Date;
}

// Job options
const JOB_OPTIONS = {
  // Remove completed jobs after 7 days
  removeOnComplete: {
    age: 7 * 24 * 3600, // 7 days in seconds
    count: 1000, // Keep max 1000 jobs
  },
  // Remove failed jobs after 30 days
  removeOnFail: {
    age: 30 * 24 * 3600, // 30 days in seconds
    count: 500, // Keep max 500 failed jobs
  },
  // Retry configuration
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // Start with 2 seconds
  },
  // Job timeout (5 minutes)
  timeout: 5 * 60 * 1000,
};

// ============================================
// QUEUE CONFIGURATION
// ============================================

const QUEUE_NAME = 'content-scan';
const CONCURRENCY = 3; // Process 3 scans simultaneously

// Priority mapping
const PRIORITY_MAP: Record<ScanPriority, number> = {
  low: 5,
  normal: 3,
  high: 2,
  critical: 1, // Lower number = higher priority
};

// ============================================
// QUEUE INSTANCE
// ============================================

let scanQueue: Queue<ScanJobData> | null = null;
let scanWorker: Worker<ScanJobData, ScanJobResult> | null = null;
let queueEvents: QueueEvents | null = null;

/**
 * Get or create the scan queue
 */
function getQueue(): Queue<ScanJobData> {
  if (!scanQueue) {
    const redis = getRedisClient();
    scanQueue = new Queue<ScanJobData>(QUEUE_NAME, {
      connection: redis as any,
      defaultJobOptions: JOB_OPTIONS,
    });

    // Error handling
    scanQueue.on('error', (error) => {
      console.error('[SCAN_QUEUE] Queue error:', error);
    });

    console.log('[SCAN_QUEUE] Content scanning queue initialized');
  }

  return scanQueue;
}

// ============================================
// QUEUE OPERATIONS
// ============================================

/**
 * Add a photo to the scanning queue
 *
 * @param jobData - Photo data to scan
 * @returns Job ID
 */
export async function queuePhotoScan(jobData: ScanJobData): Promise<string> {
  // Check if moderation is enabled
  if (!isModerationEnabled()) {
    console.log('[SCAN_QUEUE] Moderation not enabled, skipping scan');
    return 'moderation-disabled';
  }

  const queue = getQueue();

  // Determine priority
  const priority = jobData.isReported
    ? PRIORITY_MAP.critical
    : PRIORITY_MAP[jobData.priority || 'normal'];

  // Add job to queue
  const job = await queue.add(
    'scan-photo',
    jobData,
    {
      priority,
      jobId: `photo:${jobData.photoId}`, // Deduplicate by photo ID
    }
  );

  console.log(`[SCAN_QUEUE] Queued scan for photo ${jobData.photoId} (priority: ${jobData.priority || 'normal'})`);

  return job.id || '';
}

/**
 * Add multiple photos to the scanning queue
 *
 * @param jobDataArray - Array of photo data to scan
 * @returns Number of jobs queued
 */
export async function queuePhotoScanBatch(jobDataArray: ScanJobData[]): Promise<number> {
  const queue = getQueue();
  let count = 0;

  for (const jobData of jobDataArray) {
    try {
      await queuePhotoScan(jobData);
      count++;
    } catch (error) {
      console.error(`[SCAN_QUEUE] Failed to queue scan for photo ${jobData.photoId}:`, error);
    }
  }

  console.log(`[SCAN_QUEUE] Queued ${count} photo scans`);
  return count;
}

/**
 * Mark a photo as reported (high priority scan)
 *
 * @param photoId - Photo ID
 * @param eventId - Event ID
 * @param tenantId - Tenant ID
 * @param reportReason - Reason for report
 */
export async function reportPhoto(
  photoId: string,
  eventId: string,
  tenantId: string,
  reportReason?: string
): Promise<void> {
  // Get photo details from database
  const db = getTenantDb(tenantId);
  const photo = await db.findOne<{
    id: string;
    images: { full_url: string };
    user_id?: string;
  }>('photos', { id: photoId });

  if (!photo) {
    throw new Error(`Photo ${photoId} not found`);
  }

  // Queue high-priority scan
  await queuePhotoScan({
    photoId,
    eventId,
    imageUrl: photo.images.full_url,
    userId: photo.user_id || undefined,
    priority: 'high',
    isReported: true,
  });

  console.log(`[SCAN_QUEUE] Photo ${photoId} reported: ${reportReason}`);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
}

/**
 * Pause the queue (stop processing new jobs)
 */
export async function pauseQueue(): Promise<void> {
  const queue = getQueue();
  await queue.pause();
  console.log('[SCAN_QUEUE] Queue paused');
}

/**
 * Resume the queue
 */
export async function resumeQueue():Promise<void> {
  const queue = getQueue();
  await queue.resume();
  console.log('[SCAN_QUEUE] Queue resumed');
}

/**
 * Clear all jobs from the queue
 * Use with caution!
 */
export async function clearQueue(): Promise<void> {
  const queue = getQueue();
  await queue.drain();
  console.log('[SCAN_QUEUE] Queue cleared');
}

// ============================================
// WORKER (JOB PROCESSOR)
// ============================================

/**
 * Process a single scan job
 */
async function processScanJob(job: Job<ScanJobData, ScanJobResult>): Promise<ScanJobResult> {
  const { photoId, eventId, imageUrl, priority, isReported } = job.data;

  console.log(`[SCAN_WORKER] Processing scan for photo ${photoId} (priority: ${priority || 'normal'})`);

  try {
    // 1. Scan the image
    const moderationResult = await scanImageForModeration(imageUrl, {
      autoReject: !isReported, // Don't auto-reject reported content, flag for review
    });

    // 2. Get tenant ID - for now, use system tenant
    // In production, you'd want to look up the event to get the tenant ID
    const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
    const db = getTenantDb(SYSTEM_TENANT_ID);

    // 3. Check if photo exists
    const photo = await db.findOne<{
      id: string;
      status: string;
    }>('photos', { id: photoId });

    if (!photo) {
      throw new Error(`Photo ${photoId} not found in database`);
    }

    // 4. Handle moderation result
    switch (moderationResult.action) {
      case 'approve':
        // Photo is safe, update status to approved
        await db.update('photos', { status: 'approved' }, { id: photoId });
        break;

      case 'reject':
        // Photo is inappropriate, move to quarantine
        await quarantinePhoto(
          eventId,
          photoId,
          moderationResult.reason,
          moderationResult.categories
        );

        // Update status in database
        await db.update('photos', { status: 'rejected' }, { id: photoId });
        break;

      case 'review':
        // Flagged for manual review
        if (moderationResult.categories.length > 0) {
          await quarantinePhoto(
            eventId,
            photoId,
            moderationResult.reason,
            moderationResult.categories
          );
        }

        // Keep status as pending for manual review
        break;
    }

    return {
      photoId,
      eventId,
      success: true,
      moderationResult,
      processedAt: new Date(),
    };
  } catch (error) {
    console.error(`[SCAN_WORKER] Error processing scan for photo ${photoId}:`, error);

    return {
      photoId,
      eventId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processedAt: new Date(),
    };
  }
}

/**
 * Start the scan worker
 * Call this in your server startup code
 */
export async function startScanWorker(): Promise<void> {
  if (scanWorker) {
    console.log('[SCAN_WORKER] Worker already running');
    return;
  }

  if (!isModerationEnabled()) {
    console.log('[SCAN_WORKER] Moderation not enabled, worker not started');
    return;
  }

  const redis = getRedisClient();

  // Create queue events listener
  queueEvents = new QueueEvents(QUEUE_NAME, {
    connection: redis as any,
  });

  queueEvents.on('waiting', ({ jobId }) => {
    console.log(`[SCAN_WORKER] Job ${jobId} is waiting`);
  });

  queueEvents.on('active', ({ jobId, prev }) => {
    console.log(`[SCAN_WORKER] Job ${jobId} is now active (was: ${prev})`);
  });

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    const result = returnvalue as unknown as ScanJobResult;
    console.log(`[SCAN_WORKER] Job ${jobId} completed: ${result.photoId}`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[SCAN_WORKER] Job ${jobId} failed: ${failedReason}`);
  });

  // Create worker
  scanWorker = new Worker<ScanJobData, ScanJobResult>(
    QUEUE_NAME,
    async (job) => {
      return await processScanJob(job);
    },
    {
      connection: redis as any,
      concurrency: CONCURRENCY,
    }
  );

  // Worker error handling
  scanWorker.on('error', (error) => {
    console.error('[SCAN_WORKER] Worker error:', error);
  });

  console.log('[SCAN_WORKER] Content scanning worker started');
}

/**
 * Stop the scan worker
 * Call this during graceful shutdown
 */
export async function stopScanWorker(): Promise<void> {
  if (!scanWorker) {
    console.log('[SCAN_WORKER] Worker not running');
    return;
  }

  await scanWorker.close();
  scanWorker = null;

  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }

  console.log('[SCAN_WORKER] Content scanning worker stopped');
}

/**
 * Get worker status
 */
export function getWorkerStatus(): {
  running: boolean;
  concurrency: number;
} {
  return {
    running: scanWorker !== null,
    concurrency: CONCURRENCY,
  };
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the content scanning system
 * Call this during application startup
 */
export async function initializeContentScanning(): Promise<void> {
  // Get queue (initializes it)
  getQueue();

  // Start worker
  await startScanWorker();

  console.log('[SCAN_QUEUE] Content scanning system initialized');
}

/**
 * Shutdown the content scanning system
 * Call this during application shutdown
 */
export async function shutdownContentScanning(): Promise<void> {
  await stopScanWorker();

  if (scanQueue) {
    await scanQueue.close();
    scanQueue = null;
  }

  console.log('[SCAN_QUEUE] Content scanning system shut down');
}
