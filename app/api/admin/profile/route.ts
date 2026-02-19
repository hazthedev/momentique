// ============================================
// Galeria - Super Admin Profile API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/middleware/auth';
import { getTenantDb } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function PATCH(request: NextRequest) {
    try {
        const auth = await requireSuperAdmin(request);
        if (auth instanceof NextResponse) {
            return auth;
        }

        const body = (await request.json()) as { name?: string; password?: string };
        const { name, password } = body;

        // Validation
        if (!name && !password) {
            return NextResponse.json(
                { error: 'No changes provided', code: 'VALIDATION_ERROR' },
                { status: 400 }
            );
        }

        const db = getTenantDb(auth.user.tenant_id);
        const updates: string[] = [];
        const values: string[] = [];
        let paramIndex = 1;

        if (name) {
            updates.push(`name = $${paramIndex}`);
            values.push(name);
            paramIndex++;
        }

        if (password) {
            const passwordHash = await bcrypt.hash(password, 12);
            updates.push(`password_hash = $${paramIndex}`);
            values.push(passwordHash);
            paramIndex++;
        }

        // Add user ID as the last parameter
        values.push(auth.user.id);

        if (updates.length > 0) {
            await db.query(
                `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
                values
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[SUPERADMIN_PROFILE_PATCH] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update profile', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    }
}