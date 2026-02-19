// ============================================
// Galeria - Create Superadmin User
// ============================================

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;

// Superadmin credentials from request
const EMAIL = 'galeria@admin.com';
const PASSWORD = 'galeria123@';

async function createSuperadmin() {
    const pool = new Pool({ connectionString });
    const client = await pool.connect();

    try {
        console.log('[CREATE_SUPERADMIN] Starting...');

        // 1. Find or Create Tenant
        // Try to find a master tenant first
        let tenantResult = await client.query(`
      SELECT id FROM tenants WHERE tenant_type = 'master' LIMIT 1
    `);

        // If no master, try ANY tenant
        if (tenantResult.rowCount === 0) {
            tenantResult = await client.query(`
        SELECT id FROM tenants LIMIT 1
      `);
        }

        let tenantId;

        if (tenantResult.rowCount === 0) {
            // Create a new master tenant if none exists
            console.log('[CREATE_SUPERADMIN] No tenant found. Creating default master tenant...');
            tenantId = '00000000-0000-0000-0000-000000000001'; // Default ID used in reset script

            await client.query(`
        INSERT INTO tenants (
          id, tenant_type, brand_name, company_name, contact_email, support_email,
          domain, subdomain, is_custom_domain, branding, subscription_tier,
          features_enabled, limits, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
                tenantId,
                'master',
                'Galeria',
                'Galeria',
                EMAIL,
                'support@galeria.com',
                null,
                'galeria-admin',
                false,
                JSON.stringify({ primary_color: '#8B5CF6' }),
                'enterprise',
                JSON.stringify({ white_label: true, api_access: true }),
                JSON.stringify({ max_events_per_month: 9999 }),
                'active',
            ]);
        } else {
            tenantId = tenantResult.rows[0].id;
            console.log(`[CREATE_SUPERADMIN] Attaching to existing tenant ID: ${tenantId}`);
        }

        // 2. Create/Update User
        const passwordHash = await bcrypt.hash(PASSWORD, 12);

        // Check if user exists
        const userResult = await client.query(`SELECT id FROM users WHERE email = $1`, [EMAIL]);

        if (userResult.rowCount && userResult.rowCount > 0) {
            // Update existing user
            console.log('[CREATE_SUPERADMIN] User exists. Updating role and password...');
            await client.query(`
            UPDATE users 
            SET password_hash = $1, role = 'super_admin', updated_at = NOW()
            WHERE email = $2
        `, [passwordHash, EMAIL]);
        } else {
            // Insert new user
            console.log('[CREATE_SUPERADMIN] Creating new user...');
            const userId = crypto.randomUUID();
            await client.query(`
            INSERT INTO users (
                id, tenant_id, email, password_hash, name, role, email_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
                userId,
                tenantId,
                EMAIL,
                passwordHash,
                'Super Admin',
                'super_admin',
                true
            ]);
        }

        console.log('');
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║           SUPERADMIN CREATED/UPDATED ✅                ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('📋 CREDENTIALS:');
        console.log('   Email:    ' + EMAIL);
        console.log('   Password: ' + PASSWORD);
        console.log('');
        console.log('   Login at: http://localhost:3000/auth/login');
        console.log('');

    } catch (error) {
        console.error('[CREATE_SUPERADMIN] Error:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

createSuperadmin()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
