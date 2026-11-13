import { AuthSession, Group, Member } from '../types';
import { isSessionValid } from '../utils/security';
import { isSupabaseConfigured } from '../lib/supabase';

/**
 * Security Boundary Contract & Architecture Status
 *
 * RoomSplit integrates with Supabase (`@supabase/supabase-js`) using ONLY the public
 * `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables:
 * 1. User identity bound to `auth.uid()` via Supabase Auth (Anonymous Sign-In preserving
 *    frictionless name/phone/room onboarding with zero emails/secrets stored in localStorage).
 * 2. PostgreSQL Row Level Security (RLS) across all tables isolating Group A from Group B
 *    (`is_group_member`, `is_group_admin_or_co_admin`, `is_group_main_admin`).
 * 3. `group_secrets` is locked (`USING (FALSE)`) from direct client queries;
 *    group password hashing uses pgcrypto bcrypt on the server inside `SECURITY DEFINER` RPCs.
 * 4. Atomic PostgreSQL RPCs enforce role permissions, amount validation, remaining-fund locks,
 *    and loan/settlement consistency on the backend (`supabase/migrations/001_roomsplit_supabase.sql`).
 */

export interface GroupSettingsUpdateInput {
  name?: string;
  description?: string;
  newPassword?: string;
  expectedContributionPerMember?: number;
}

export interface RoomSplitSecurityCapabilities {
  executionMode: 'client_local_only' | 'supabase_rls_ready';
  serverSideEnforcementActive: boolean;
  passwordHashingAlgorithm: 'bcrypt-pgcrypto' | 'PBKDF2-SHA256';
  sessionTtlHours: number;
  supabaseSchemaPath: string;
}

export const SECURITY_ARCHITECTURE_STATUS: RoomSplitSecurityCapabilities = {
  executionMode: 'supabase_rls_ready',
  serverSideEnforcementActive: isSupabaseConfigured,
  passwordHashingAlgorithm: 'bcrypt-pgcrypto',
  sessionTtlHours: 24,
  supabaseSchemaPath: '/supabase/migrations/001_roomsplit_supabase.sql',
};

/**
 * Verifies that the acting user belongs to the target group with a valid session
 * (helper retained for pure unit checks & fallback compatibility; never falls back to index 0).
 */
export function authorizeGroupMember(
  group: Group | null | undefined,
  accountId: string | null | undefined,
  sessions: Record<string, AuthSession>
): Member | null {
  if (!group || !accountId) return null;
  const session = sessions[group.id];
  if (!isSessionValid(session, accountId)) {
    return null;
  }
  const member = group.members.find((m) => m.id === accountId);
  return member || null;
}

/**
 * Verifies that every referenced member ID exists within the target group
 * to block cross-group IDOR (Insecure Direct Object Reference).
 */
export function areAllMembersInGroup(group: Group, memberIds: string[]): boolean {
  if (memberIds.length === 0) return false;
  const validIds = new Set(group.members.map((m) => m.id));
  return memberIds.every((id) => validIds.has(id));
}
