// ============================================
// Galeria - Admin System Settings API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/middleware/auth';
import { getDefaultSystemSettings, getSystemSettings, updateSystemSettings } from '@/lib/system-settings';
import type { ISystemSettings } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    let settings: ISystemSettings;
    try {
      settings = await getSystemSettings();
    } catch (error) {
      console.warn('[ADMIN_SETTINGS] Falling back to defaults:', error);
      settings = getDefaultSystemSettings();
    }

    return NextResponse.json({ data: settings });
  } catch (error) {
    console.error('[ADMIN_SETTINGS] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system settings', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const updates = (await request.json()) as Partial<ISystemSettings>;
    const settings = await updateSystemSettings(updates, auth.user.id);

    return NextResponse.json({ data: settings, message: 'System settings updated' });
  } catch (error) {
    console.error('[ADMIN_SETTINGS] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update system settings', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}