// ============================================
// Galeria - Event Photo Service
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getTenantDb } from '@/lib/db';
import { uploadImageToStorage, validateImageFile, validateUploadedImage, getTierValidationOptions } from '@/lib/images';
import { generatePhotoId } from '@/lib/utils';
import { createEntryFromPhoto } from '@/lib/lucky-draw';
import { updateGuestProgress } from '@/lib/photo-challenge';
import { verifyAccessToken } from '@/lib/auth';
import { extractSessionId, validateSession } from '@/lib/session';
import { checkPhotoLimit } from '@/lib/limit-check';
import { checkUploadRateLimit } from '@/lib/rate-limit';
import { validateRecaptchaForUpload, isRecaptchaRequiredForUploads } from '@/lib/recaptcha';
import { isModerationEnabled } from '@/lib/moderation/auto-moderate';
import { queuePhotoScan } from '@/jobs/scan-content';
import type { DeviceType, IPhoto, SubscriptionTier } from '@/lib/types';
import { resolveUserTier } from '@/lib/subscription';
import { applyCacheHeaders, CACHE_PROFILES } from '@/lib/cache/strategy';
import { publishEventBroadcast } from '@/lib/realtime/server';
import { resolveOptionalAuth, resolveRequiredTenantId, resolveTenantId } from '@/lib/api-request-context';

// ============================================
// POST /api/events/:eventId/photos - Upload photo (service)
// ============================================

export async function handleEventPhotoUpload(request: NextRequest, eventId: string) {
  try {
    const headers = request.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveRequiredTenantId(headers, auth);

    const db = getTenantDb(tenantId);
    const subscriptionTier = await resolveUserTier(headers, tenantId, 'free');
    const tenantTierHeader = headers.get('x-tenant-tier');
    const allowedTiers = new Set(['free', 'pro', 'premium', 'enterprise', 'tester']);
    const effectiveTenantTier = tenantTierHeader && allowedTiers.has(tenantTierHeader)
      ? (tenantTierHeader as SubscriptionTier)
      : null;
    let effectiveTenantTierFallback: SubscriptionTier | null = null;
    if (!effectiveTenantTier) {
      const tenant = await db.findOne<{ subscription_tier: SubscriptionTier }>('tenants', { id: tenantId });
      effectiveTenantTierFallback = tenant?.subscription_tier || null;
    }

    // Verify event exists and is active
    const event = await db.findOne<{
      id: string;
      status: string;
      settings: {
        features: {
          photo_upload_enabled: boolean;
          lucky_draw_enabled: boolean;
          moderation_required: boolean;
          anonymous_allowed: boolean;
          reactions_enabled: boolean;
          guest_download_enabled: boolean;
          photo_challenge_enabled: boolean;
          attendance_enabled: boolean;
        };
        limits: {
          max_photos_per_user: number;
          max_total_photos: number;
        };
        security?: {
          upload_rate_limits?: {
            per_ip_hourly?: number;
            per_fingerprint_hourly?: number;
            burst_per_ip_minute?: number;
            per_event_daily?: number;
          };
        };
      };
    }>('events', { id: eventId });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found', code: 'EVENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Ensure settings exists (for backwards compatibility with old events)
    if (!event.settings) {
      event.settings = {
        features: {
          photo_upload_enabled: true,
          lucky_draw_enabled: false,
          moderation_required: false,
          anonymous_allowed: true,
          reactions_enabled: true,
          guest_download_enabled: true,
          photo_challenge_enabled: false,
          attendance_enabled: false,
        },
        limits: {
          max_photos_per_user: 100,
          max_total_photos: 1000,
        },
      };
    }
    if (!event.settings.features) {
      event.settings.features = {
        photo_upload_enabled: true,
        lucky_draw_enabled: false,
        moderation_required: false,
        anonymous_allowed: true,
        reactions_enabled: true,
        guest_download_enabled: true,
        photo_challenge_enabled: false,
        attendance_enabled: false,
      };
    }
    if (!event.settings.limits) {
      event.settings.limits = {
        max_photos_per_user: 100,
        max_total_photos: 1000,
      };
    }

    // Ensure individual feature properties have defaults (for partial feature objects)
    event.settings.features.photo_upload_enabled ??= true;
    event.settings.features.lucky_draw_enabled ??= false;
    event.settings.features.moderation_required ??= false;
    event.settings.features.anonymous_allowed ??= true;

    // Check if photo uploads are enabled
    if (!event.settings.features.photo_upload_enabled) {
      return NextResponse.json(
        { error: 'Photo uploads are disabled for this event', code: 'UPLOADS_DISABLED' },
        { status: 400 }
      );
    }

    // Check if event is active
    if (event.status !== 'active') {
      return NextResponse.json(
        { error: 'Event is not active', code: 'EVENT_NOT_ACTIVE' },
        { status: 400 }
      );
    }

    // ============================================
    // RATE LIMITING CHECK
    // ============================================
    // Get identifiers for rate limiting (will be reused below for auth)
    const uploadIpAddress = headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown';
    const uploadFingerprint = headers.get('x-fingerprint');

    // Determine user ID for rate limiting
    const uploadUserId = auth?.userId;
    const uploadUserRole = auth?.role || 'guest';

    const isAdminUploadHeader = headers.get('x-admin-upload') === 'true';
    let tenantTierFromDb: SubscriptionTier | null = null;
    if (!uploadUserId) {
      const tenant = await db.findOne<{ subscription_tier: SubscriptionTier }>('tenants', { id: tenantId });
      tenantTierFromDb = tenant?.subscription_tier || null;
    }

    const effectiveSubscriptionTier: SubscriptionTier = uploadUserId
      ? subscriptionTier
      : (tenantTierFromDb || effectiveTenantTier || effectiveTenantTierFallback || subscriptionTier);
    if (isAdminUploadHeader) {
      console.log('[RATE_LIMIT] Skipping for admin upload');
    } else {

    // Check rate limits (IP, fingerprint, event, burst protection)
    const uploadRateLimitOverrides = event.settings?.security?.upload_rate_limits;
    const rateLimitResult = await checkUploadRateLimit(
      uploadIpAddress,
      uploadFingerprint || null,
      eventId,
      uploadUserId,
      uploadRateLimitOverrides
    );

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          error: rateLimitResult.reason || 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitResult.retryAfter,
          limitType: rateLimitResult.limitType,
        },
        { status: 429 }
      );

      // Add rate limit headers
      if (rateLimitResult.resetAt) {
        response.headers.set('Retry-After', String(rateLimitResult.retryAfter || 60));
        response.headers.set('X-RateLimit-Reset', Math.floor(rateLimitResult.resetAt.getTime() / 1000).toString());
      }

      return response;
    }
    }

    // ============================================
    // RECAPTCHA VERIFICATION (Anonymous Uploads)
    // ============================================
    // Check if user is authenticated
    const isAuthenticated = !!uploadUserId;
    const requiresRecaptcha = isRecaptchaRequiredForUploads(undefined, isAuthenticated);
    const contentType = headers.get('content-type') || '';

    let jsonBody: Record<string, unknown> | null = null;
    let formData: FormData | null = null;

    // Parse body once (request body can only be consumed once)
    if (contentType.includes('application/json')) {
      jsonBody = (await request.json()) as Record<string, unknown>;
    } else {
      try {
        formData = await request.formData();
      } catch (parseError) {
        console.error('[PHOTO_UPLOAD] Failed to parse FormData:', parseError);
        return NextResponse.json(
          { error: 'Failed to parse form data', code: 'PARSE_ERROR', details: parseError instanceof Error ? parseError.message : 'Unknown' },
          { status: 400 }
        );
      }
    }

    if (!isAuthenticated && requiresRecaptcha) {
      const isAdminUpload = headers.get('x-admin-upload') === 'true';
      const contributorName =
        getStringValue(jsonBody?.['contributor_name']) ??
        getStringValue(jsonBody?.['contributorName']) ??
        getStringValue(formData?.get('contributor_name')) ??
        getStringValue(formData?.get('contributorName'));
      const isAnonymousRaw =
        jsonBody?.['is_anonymous'] ??
        jsonBody?.['isAnonymous'] ??
        formData?.get('is_anonymous') ??
        formData?.get('isAnonymous');
      const isAnonymous =
        isAnonymousRaw === true || isAnonymousRaw === 'true';
      const hasName =
        typeof contributorName === 'string' && contributorName.trim().length > 0;
      const isNamedGuest = !isAnonymous && hasName;

      if (isAdminUpload) {
        console.log('[RECAPTCHA] Skipping for admin upload');
      } else if (isNamedGuest) {
        console.log('[RECAPTCHA] Skipping for named guest upload');
      } else {
      // Check for reCAPTCHA token in request body
      let recaptchaToken: string | undefined;

      // Extract token from either JSON or form data
      if (jsonBody) {
        recaptchaToken = getStringValue(jsonBody?.['recaptchaToken']);
      } else if (formData) {
        recaptchaToken = formData.get('recaptchaToken') as string | undefined;
      }

      if (!recaptchaToken) {
        return NextResponse.json(
          {
            error: 'CAPTCHA token is required for anonymous uploads',
            code: 'MISSING_CAPTCHA',
            requiresCaptcha: true,
          },
          { status: 400 }
        );
      }

      // Verify the token
      const recaptchaResult = await validateRecaptchaForUpload(recaptchaToken);

      if (!recaptchaResult.valid) {
        return NextResponse.json(
          {
            error: recaptchaResult.error || 'CAPTCHA verification failed',
            code: recaptchaResult.code || 'CAPTCHA_FAILED',
            score: recaptchaResult.score,
          },
          { status: 400 }
        );
      }

      // Log the score for monitoring
      console.log('[RECAPTCHA] Anonymous upload verification:', {
        score: recaptchaResult.score,
        eventId,
        ip: uploadIpAddress,
        fingerprint: uploadFingerprint,
      });
      }
    }

    // Per-user and per-event total limits removed; use tier + rate limits only.

    // ============================================
    // DIRECT UPLOAD METADATA (JSON)
    // ============================================
    if (contentType.includes('application/json')) {
      const body = jsonBody || {};
      const photoId = getStringValue(body['photoId']);
      const key = getStringValue(body['key']);
      const width = getNumberValue(body['width']);
      const height = getNumberValue(body['height']);
      const fileSize = getNumberValue(body['fileSize']);
      const caption = getStringValue(body['caption']);
      const contributorName =
        getStringValue(body['contributorName']) ??
        getStringValue(body['contributor_name']);
      const isAnonymous =
        getBooleanValue(body['isAnonymous']) ??
        getBooleanValue(body['is_anonymous']) ??
        false;
      const joinLuckyDraw =
        getBooleanValue(body['joinLuckyDraw']) ??
        getBooleanValue(body['join_lucky_draw']) ??
        false;

      if (!photoId || !key || width === undefined || height === undefined || fileSize === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }

      const expectedPrefix = `${eventId}/${photoId}/`;
      if (typeof key !== 'string' || !key.startsWith(expectedPrefix)) {
        return NextResponse.json(
          { error: 'Invalid storage key', code: 'INVALID_KEY' },
          { status: 400 }
        );
      }

      // Get user info (authenticated or guest)
      const fingerprint = headers.get('x-fingerprint');
      const userId = uploadUserId || `guest_${fingerprint || 'anonymous'}`;
      const userRole = uploadUserRole;

      // Check if anonymous uploads are allowed
      if (isAnonymous && !event.settings.features.anonymous_allowed) {
        return NextResponse.json(
          { error: 'Anonymous uploads are not allowed for this event', code: 'ANONYMOUS_NOT_ALLOWED' },
          { status: 400 }
        );
      }

      // Check photo limits (skip for admins or admin uploads)
      if (userRole !== 'super_admin' && !isAdminUploadHeader) {
        const tierLimitResult = await checkPhotoLimit(eventId, tenantId, effectiveSubscriptionTier);
        if (!tierLimitResult.allowed) {
          return NextResponse.json(
            {
              error: tierLimitResult.message || 'Photo limit reached',
              code: 'TIER_LIMIT_REACHED',
              upgradeRequired: true,
              currentCount: tierLimitResult.currentCount,
              limit: tierLimitResult.limit,
            },
            { status: 403 }
          );
        }

        // Tier limit already enforced by checkPhotoLimit above.
      }

      const publicBase = process.env.R2_PUBLIC_URL || 'https://pub-xxxxxxxxx.r2.dev';
      const publicUrl = `${publicBase}/${key}`;
      const ext = key.split('.').pop() || 'jpg';

      const userAgent = headers.get('user-agent') || '';
      let deviceType: DeviceType = 'desktop';
      if (/Mobile|Android|iPhone/i.test(userAgent)) {
        deviceType = 'mobile';
      } else if (/Tablet|iPad/i.test(userAgent)) {
        deviceType = 'tablet';
      }

      const photo = await db.insert('photos', {
        id: photoId,
        event_id: eventId,
        user_fingerprint: userId,
        images: {
          original_url: publicUrl,
          thumbnail_url: publicUrl,
          medium_url: publicUrl,
          full_url: publicUrl,
          width,
          height,
          file_size: fileSize,
          format: ext,
        },
        caption: caption || undefined,
        contributor_name: contributorName || undefined,
        is_anonymous: isAnonymous || false,
        status: event.settings.features.moderation_required ? 'pending' : 'approved',
        metadata: {
          ip_address: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
          user_agent: userAgent,
          upload_timestamp: new Date(),
          device_type: deviceType,
        },
        created_at: new Date(),
        approved_at: event.settings.features.moderation_required ? undefined : new Date(),
      });

      let luckyDrawEntryId: string | null = null;
      if (event.settings.features.lucky_draw_enabled && joinLuckyDraw) {
        try {
          const entryName = isAnonymous ? undefined : contributorName || undefined;
          const entry = await createEntryFromPhoto(tenantId, eventId, photo.id, userId, entryName);
          luckyDrawEntryId = entry?.id || null;
        } catch (entryError) {
          console.warn('[API] Lucky draw entry skipped:', entryError);
        }
      }

      // ============================================
      // PHOTO CHALLENGE PROGRESS TRACKING
      // ============================================
      let challengeGoalReached = false;
      if (event.settings.features.photo_challenge_enabled && !isAnonymous && userId) {
        try {
          const { goalJustReached } = await updateGuestProgress(
            db,
            eventId,
            userId,
            !event.settings.features.moderation_required // Photo is approved if moderation is not required
          );
          challengeGoalReached = goalJustReached;
          console.log('[PHOTO_CHALLENGE] Progress updated:', userId, goalJustReached ? 'Goal reached!' : '');
        } catch (challengeError) {
          console.warn('[API] Photo challenge progress update skipped:', challengeError);
        }
      }

      // ============================================
      // AI CONTENT MODERATION
      // ============================================
      // Queue photo for AI scanning if moderation is enabled
      if (event.settings.features.moderation_required && await isModerationEnabled()) {
        try {
          await queuePhotoScan({
            photoId: photo.id,
            eventId: eventId,
            tenantId,
            imageUrl: photo.images.full_url,
            userId: userRole === 'guest' ? undefined : userId,
            priority: 'normal',
          });
          console.log('[MODERATION] Photo queued for AI scanning:', photo.id);
        } catch (scanError) {
          console.error('[MODERATION] Failed to queue photo for scanning:', scanError);
          // Don't fail the upload if scanning fails
        }
      }

      const createdPhoto = {
        id: photo.id,
        event_id: photo.event_id,
        images: photo.images,
        caption: photo.caption,
        contributor_name: photo.contributor_name,
        is_anonymous: photo.is_anonymous,
        status: photo.status,
        created_at: photo.created_at,
        lucky_draw_entry_id: luckyDrawEntryId,
      };

      await publishEventBroadcast(eventId, 'new_photo', createdPhoto);

      return NextResponse.json({
        data: [createdPhoto],
        message: 'Photo uploaded successfully',
      }, { status: 201 });
    }

    // Parse multipart form data (already parsed above)
    if (!formData) {
      return NextResponse.json(
        { error: 'Failed to parse form data', code: 'PARSE_ERROR' },
        { status: 400 }
      );
    }
    const files = formData.getAll('files');
    const singleFile = formData.get('file');
    const caption = formData.get('caption') as string | null;
    const contributorName = formData.get('contributor_name') as string | null;
    const isAnonymous = formData.get('is_anonymous') === 'true';
    const joinLuckyDraw = formData.get('join_lucky_draw') === 'true';

    const uploadFiles: File[] = [];
    for (const file of files) {
      if (file instanceof File) {
        uploadFiles.push(file);
      }
    }
    if (uploadFiles.length === 0 && singleFile instanceof File) {
      uploadFiles.push(singleFile);
    }

    // Validate files
    if (uploadFiles.length === 0) {
      return NextResponse.json(
        { error: 'No file provided', code: 'NO_FILE' },
        { status: 400 }
      );
    }

    for (const file of uploadFiles) {
      // Get tier-based validation options
      const validationOptions = {
        ...getTierValidationOptions(effectiveSubscriptionTier),
        allowOversize: !uploadUserId,
      };

      // Use comprehensive validation with magic byte check
      const validation = await validateUploadedImage(file, validationOptions);
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: validation.error,
            code: validation.code || 'INVALID_FILE',
            details: validation.metadata ? {
              allowedTypes: validationOptions.allowedMimeTypes,
              maxSizeMB: Math.round((validationOptions.maxSizeBytes || 0) / (1024 * 1024)),
              maxDimensions: `${validationOptions.maxWidth}x${validationOptions.maxHeight}`,
            } : undefined,
          },
          { status: 400 }
        );
      }
    }

    // Check if anonymous uploads are allowed
    if (isAnonymous && !event.settings.features.anonymous_allowed) {
      return NextResponse.json(
        { error: 'Anonymous uploads are not allowed for this event', code: 'ANONYMOUS_NOT_ALLOWED' },
        { status: 400 }
      );
    }

    // Get user info (authenticated or guest)
    const fingerprint = headers.get('x-fingerprint');
    const userId = uploadUserId || `guest_${fingerprint || 'anonymous'}`;
    const userRole = uploadUserRole;

    // Check photo limits (skip for admins or admin uploads)
    if (userRole !== 'super_admin' && !isAdminUploadHeader) {
      // First check tenant tier limit
      const tierLimitResult = await checkPhotoLimit(eventId, tenantId, effectiveSubscriptionTier);
      if (!tierLimitResult.allowed) {
        return NextResponse.json(
          {
            error: tierLimitResult.message || 'Photo limit reached',
            code: 'TIER_LIMIT_REACHED',
            upgradeRequired: true,
            currentCount: tierLimitResult.currentCount,
            limit: tierLimitResult.limit,
          },
          { status: 403 }
        );
      }

      // Tier limit already enforced by checkPhotoLimit above.
    }

    const userAgent = headers.get('user-agent') || '';
    let deviceType: DeviceType = 'desktop';
    if (/Mobile|Android|iPhone/i.test(userAgent)) {
      deviceType = 'mobile';
    } else if (/Tablet|iPad/i.test(userAgent)) {
      deviceType = 'tablet';
    }

    const createdPhotos = [];

    for (const file of uploadFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const photoId = generatePhotoId();

      // Get tier for processing options
      const images = await uploadImageToStorage(
        eventId,
        photoId,
        buffer,
        file.name,
        effectiveSubscriptionTier
      );

      const photo = await db.insert('photos', {
        id: photoId,
        event_id: eventId,
        user_fingerprint: userId,
        images,
        caption: caption || undefined,
        contributor_name: contributorName || undefined,
        is_anonymous: isAnonymous || false,
        status: event.settings.features.moderation_required ? 'pending' : 'approved',
        metadata: {
          ip_address: headers.get('x-forwarded-for') || headers.get('x-real-ip') || 'unknown',
          user_agent: userAgent,
          upload_timestamp: new Date(),
          device_type: deviceType,
        },
        created_at: new Date(),
        approved_at: event.settings.features.moderation_required ? undefined : new Date(),
      });

      // Create lucky draw entry only if user opted in
      let luckyDrawEntryId: string | null = null;
      if (event.settings.features.lucky_draw_enabled && joinLuckyDraw) {
        try {
          const entryName = isAnonymous ? undefined : contributorName || undefined;
          const entry = await createEntryFromPhoto(tenantId, eventId, photo.id, userId, entryName);
          luckyDrawEntryId = entry?.id || null;
        } catch (entryError) {
          console.warn('[API] Lucky draw entry skipped:', entryError);
        }
      }

      // ============================================
      // AI CONTENT MODERATION
      // ============================================
      // Queue photo for AI scanning if moderation is enabled
      if (event.settings.features.moderation_required && await isModerationEnabled()) {
        try {
          await queuePhotoScan({
            photoId: photo.id,
            eventId: eventId,
            tenantId,
            imageUrl: photo.images.full_url,
            userId: userRole === 'guest' ? undefined : userId,
            priority: 'normal',
          });
          console.log('[MODERATION] Photo queued for AI scanning:', photo.id);
        } catch (scanError) {
          console.error('[MODERATION] Failed to queue photo for scanning:', scanError);
          // Don't fail the upload if scanning fails
        }
      }

      const createdPhoto = {
        id: photo.id,
        event_id: photo.event_id,
        images: photo.images,
        caption: photo.caption,
        contributor_name: photo.contributor_name,
        is_anonymous: photo.is_anonymous,
        status: photo.status,
        created_at: photo.created_at,
        lucky_draw_entry_id: luckyDrawEntryId,
      };

      createdPhotos.push(createdPhoto);
      await publishEventBroadcast(eventId, 'new_photo', createdPhoto);
    }

    return NextResponse.json({
      data: createdPhotos,
      message: createdPhotos.length === 1 ? 'Photo uploaded successfully' : 'Photos uploaded successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Photo upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo', code: 'UPLOAD_ERROR' },
      { status: 500 }
    );
  }
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function getBooleanValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
}

// ============================================
// GET /api/events/:eventId/photos - List photos
// ============================================

export async function handleEventPhotoList(request: NextRequest, eventId: string) {
  try {
    const headers = request.headers;
    const auth = await resolveOptionalAuth(headers);
    const tenantId = resolveTenantId(headers, auth);

    const db = getTenantDb(tenantId);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'pending' | 'approved' | 'rejected' | null;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Determine if requester can access non-approved content
    const authHeader = headers.get('authorization');
    const cookieHeader = headers.get('cookie');
    let isModerator = false;
    let verifiedRole: string | null = null;

    console.log('[PHOTOS_API] Auth check:', {
      hasAuth: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20),
    });

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = verifyAccessToken(token);
        verifiedRole = payload.role;
        isModerator = payload.role === 'super_admin' || payload.role === 'organizer';
      } catch (verifyError) {
        console.error('[PHOTOS_API] Token verification failed:', verifyError);
        isModerator = false;
      }
    }

    if (!isModerator) {
      const sessionResult = extractSessionId(cookieHeader, authHeader);
      if (sessionResult.sessionId) {
        const session = await validateSession(sessionResult.sessionId, false);
        if (session.valid && session.user) {
          verifiedRole = session.user.role;
          isModerator = session.user.role === 'super_admin' || session.user.role === 'organizer';
        }
      }
    }

    console.log('[PHOTOS_API] Moderator check:', {
      isModerator,
      verifiedRole,
      status,
    });

    const guestFingerprint = headers.get('x-fingerprint');
    const guestUserId = guestFingerprint ? `guest_${guestFingerprint}` : null;

    if (status && status !== 'approved' && !isModerator) {
      if (!guestUserId) {
        return NextResponse.json(
          { error: 'Insufficient permissions', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }
    }

    // Build query filter
    // IMPORTANT: If status is provided, always filter by it (for debugging)
    const filter: Record<string, unknown> = { event_id: eventId };
    if (status) {
      filter.status = status;
      if (!isModerator && status !== 'approved') {
        filter.user_fingerprint = guestUserId;
      }
    } else if (!isModerator) {
      // Non-moderators only see approved photos when no status filter
      filter.status = 'approved';
    }

    console.log('[PHOTOS_API] Query filter:', filter);

    const total = await db.count('photos', filter);

    // Get photos
    const photos = await db.findMany<IPhoto>('photos', filter, {
      limit,
      offset,
      orderBy: 'created_at',
      orderDirection: 'DESC',
    });

    console.log('[PHOTOS_API] Query result:', {
      photoCount: photos.length,
      photoStatuses: photos.map((p) => ({ id: p.id, status: p.status })),
    });

    const response = NextResponse.json({
      data: photos,
      pagination: {
        limit,
        offset,
        total,
      },
    });

    if (!isModerator && filter.status === 'approved') {
      applyCacheHeaders(response, CACHE_PROFILES.photosPublic);
    } else {
      applyCacheHeaders(response, CACHE_PROFILES.apiPrivate);
    }

    return response;
  } catch (error) {
    console.error('[API] Photo list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos', code: 'FETCH_ERROR' },
      { status: 500 }
    );
  }
}
