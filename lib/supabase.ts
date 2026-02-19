// ============================================
// GALERIA - Supabase Client
// ============================================
// Client initialization for Supabase services

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if Supabase is properly configured
const isSupabaseConfigured =
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'your_project_url' &&
    supabaseAnonKey !== 'your_anon_key' &&
    supabaseUrl.startsWith('https://');

if (!isSupabaseConfigured) {
    console.warn(
        '[Supabase] ⚠️ Supabase is not configured properly.\n' +
        'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.\n' +
        'Get these values from: https://supabase.com/dashboard/project/_/settings/api'
    );
}

// Create a dummy client if not configured (to prevent crashes during development)
export const supabase: SupabaseClient = isSupabaseConfigured
    ? createClient(supabaseUrl!, supabaseAnonKey!)
    : createClient('https://placeholder.supabase.co', 'placeholder-key');

export const isRealtimeEnabled = isSupabaseConfigured;

export default supabase;
