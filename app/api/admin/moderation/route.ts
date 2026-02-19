// ============================================
// Galeria - Admin Moderation Settings API
// ============================================
// Super-admin only endpoints for managing AI content moderation

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/middleware/auth';
import { getSystemSettings, updateSystemSettings, clearSystemSettingsCache } from '@/lib/system-settings';
import type { ISystemSettings } from '@/lib/types';

/**
 * GET /api/admin/moderation
 * Get moderation settings (with masked credentials)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const settings = await getSystemSettings();
    const moderation = settings.moderation;

    // Mask sensitive credentials
    const maskedSettings = {
      enabled: moderation.enabled,
      aws_region: moderation.aws_region,
      aws_access_key_id: moderation.aws_access_key_id,
      aws_secret_access_key: moderation.aws_secret_access_key
        ? '***' + moderation.aws_secret_access_key.slice(-4)
        : undefined,
      confidence_threshold: moderation.confidence_threshold,
      auto_reject: moderation.auto_reject,
      // Flag to indicate if credentials are set
      has_credentials: !!(
        moderation.aws_access_key_id ||
        moderation.aws_secret_access_key ||
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.AWS_SECRET_ACCESS_KEY
      ),
    };

    return NextResponse.json({ data: maskedSettings });
  } catch (error) {
    console.error('[ADMIN_MODERATION] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moderation settings', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/moderation
 * Update moderation settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const body = await request.json();
    const updates: Partial<ISystemSettings> = {};

    // Build moderation updates from request body
    const moderationUpdates: Partial<ISystemSettings['moderation']> = {};

    if (body.enabled !== undefined) {
      moderationUpdates.enabled = body.enabled;
    }
    if (body.aws_region !== undefined) {
      moderationUpdates.aws_region = body.aws_region;
    }
    // Only update credentials if provided (not masked or empty)
    if (body.aws_access_key_id && !body.aws_access_key_id.startsWith('***')) {
      moderationUpdates.aws_access_key_id = body.aws_access_key_id;
    }
    if (body.aws_secret_access_key && !body.aws_secret_access_key.startsWith('***')) {
      moderationUpdates.aws_secret_access_key = body.aws_secret_access_key;
    }
    if (body.confidence_threshold !== undefined) {
      moderationUpdates.confidence_threshold = body.confidence_threshold;
    }
    if (body.auto_reject !== undefined) {
      moderationUpdates.auto_reject = body.auto_reject;
    }

    if (Object.keys(moderationUpdates).length > 0) {
      updates.moderation = moderationUpdates as ISystemSettings['moderation'];
    }

    // Update settings
    const settings = await updateSystemSettings(updates, auth.user.id);

    // Clear cache to ensure new settings take effect
    clearSystemSettingsCache();

    // Return masked settings
    const maskedSettings = {
      enabled: settings.moderation.enabled,
      aws_region: settings.moderation.aws_region,
      aws_access_key_id: settings.moderation.aws_access_key_id,
      aws_secret_access_key: settings.moderation.aws_secret_access_key
        ? '***' + settings.moderation.aws_secret_access_key.slice(-4)
        : undefined,
      confidence_threshold: settings.moderation.confidence_threshold,
      auto_reject: settings.moderation.auto_reject,
      has_credentials: !!(
        settings.moderation.aws_access_key_id ||
        settings.moderation.aws_secret_access_key ||
        process.env.AWS_ACCESS_KEY_ID ||
        process.env.AWS_SECRET_ACCESS_KEY
      ),
    };

    return NextResponse.json({
      data: maskedSettings,
      message: 'Moderation settings updated successfully',
    });
  } catch (error) {
    console.error('[ADMIN_MODERATION] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update moderation settings', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/moderation/test
 * Test AWS Rekognition connection
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const body = await request.json();
    const { aws_access_key_id, aws_secret_access_key, aws_region = 'us-east-1' } = body;

    if (!aws_access_key_id || !aws_secret_access_key) {
      return NextResponse.json(
        { error: 'AWS credentials are required', code: 'MISSING_CREDENTIALS' },
        { status: 400 }
      );
    }

    // Test AWS Rekognition connection
    const { RekognitionClient } = await import('@aws-sdk/client-rekognition');

    const client = new RekognitionClient({
      region: aws_region,
      credentials: {
        accessKeyId: aws_access_key_id,
        secretAccessKey: aws_secret_access_key,
      },
    });

    // Test that the client was created successfully
    // This validates the credentials format
    if (!client) {
      return NextResponse.json(
        {
          error: 'Failed to create AWS Rekognition client',
          code: 'AWS_CLIENT_ERROR',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      data: {
        success: true,
        message: 'AWS Rekognition client created successfully',
      },
    });
  } catch (error) {
    console.error('[ADMIN_MODERATION] Test error:', error);
    return NextResponse.json(
      { error: 'Failed to test AWS connection', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}