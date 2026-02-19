// ============================================
// GALERIA - Supabase Realtime Server Publisher
// ============================================
// Server-side realtime broadcast utilities.

import { createClient } from '@supabase/supabase-js';
import type { SocketEvent } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let warnedMissingEnv = false;

function getServerRealtimeClient() {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      console.warn(
        '[REALTIME_SERVER] Missing Supabase env vars. Realtime broadcasts are disabled.',
        {
          hasUrl: Boolean(supabaseUrl),
          hasAnonKey: Boolean(supabaseAnonKey),
          hasServiceRole: Boolean(supabaseServiceRoleKey),
        }
      );
    }
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isRealtimeConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey);
}

export async function publishEventBroadcast(
  eventId: string,
  event: SocketEvent,
  payload: unknown
): Promise<void> {
  try {
    const supabase = getServerRealtimeClient();
    if (!supabase) return;

    const channelName = `event:${eventId}`;
    const channel = supabase.channel(channelName);
    const subscribeResult = await new Promise<string>((resolve) => {
      const timeout = setTimeout(() => resolve('TIMED_OUT'), 1500);

      channel.subscribe((status) => {
        if (
          status === 'SUBSCRIBED' ||
          status === 'TIMED_OUT' ||
          status === 'CHANNEL_ERROR' ||
          status === 'CLOSED'
        ) {
          clearTimeout(timeout);
          resolve(status);
        }
      });
    });

    if (subscribeResult !== 'SUBSCRIBED') {
      console.warn('[REALTIME_SERVER] Channel subscribe failed:', {
        channelName,
        event,
        subscribeResult,
      });
      await supabase.removeChannel(channel);
      return;
    }

    const sendResult = await channel.send({
      type: 'broadcast',
      event,
      payload,
    });

    if (sendResult !== 'ok') {
      console.warn('[REALTIME_SERVER] Broadcast send failed:', {
        channelName,
        event,
        sendResult,
      });
    }

    await supabase.removeChannel(channel);
  } catch (error) {
    console.warn('[REALTIME_SERVER] Broadcast failed (non-fatal):', {
      eventId,
      event,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
