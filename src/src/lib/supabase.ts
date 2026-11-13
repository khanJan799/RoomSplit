import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env?.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const rawAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

function isValidSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export const SUPABASE_URL = isValidSupabaseUrl(rawUrl) ? rawUrl : '';
export const SUPABASE_ANON_KEY = rawAnonKey;
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Browser Supabase client using ONLY the public publishable / anon key (`VITE_SUPABASE_ANON_KEY`).
 * Never import or embed `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or secret keys here.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Maps Supabase Auth / PostgREST / PostgreSQL error objects into safe,
 * user-friendly messages without exposing internal table names, SQL queries, or stack traces.
 */
export function getSafeSupabaseError(error: unknown, fallback = 'Operation could not be completed.'): string {
  if (!error) return fallback;
  const rawMessage =
    typeof error === 'string'
      ? error
      : typeof (error as { message?: unknown }).message === 'string'
      ? ((error as { message: string }).message)
      : '';

  const msg = rawMessage.trim();
  if (!msg) return fallback;

  const lower = msg.toLowerCase();

  if (lower.includes('anonymous sign-ins are disabled')) {
    return 'Supabase Anonymous Sign-Ins are disabled. Enable Anonymous Sign-Ins in Supabase Authentication -> Providers.';
  }
  if (lower.includes('jwt') || lower.includes('not authenticated') || lower.includes('authentication required')) {
    return 'Your session expired. Please refresh or sign in again.';
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Permission denied for this group action.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('too many failed attempts')) {
    return msg;
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network')) {
    return 'Network error communicating with Supabase. Please check your connection.';
  }
  // Never expose raw PostgreSQL / schema internals
  if (
    lower.includes('relation "') ||
    lower.includes('column "') ||
    lower.includes('syntax error') ||
    lower.includes('pg_') ||
    lower.includes('violates check constraint') ||
    lower.includes('violates foreign key constraint')
  ) {
    return fallback;
  }

  return msg.slice(0, 200);
}
