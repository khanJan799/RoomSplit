import { AuthSession, Group, Member } from '../types';
import { isSessionValid } from '../utils/security';

/**
 * Security Boundary Contract & Architecture Readiness
 *
 * IMPORTANT: RoomSplit currently operates in client-local mode (`localStorage`)
 * without a connected live backend server or Supabase project.
 *
 * Client-side controls implemented in this app (salted PBKDF2 hashing, rate limiting,
 * input sanitization, role/membership checks, expiring local sessions, and amount validation)
 * protect honest sessions against XSS, accidental misuse, and casual tampering,
 * BUT any browser-only storage can still be inspected or edited by a local user with DevTools.
 *
 * True multi-user enforcement requires connecting a backend (see `/supabase/schema_and_rls.sql`):
 * 1. Real user authentication (Supabase Auth / JWT HttpOnly cookies).
 * 2. PostgreSQL Row Level Security (RLS) isolating Group A from Group B.
 * 3. Server-side RPCs (`approve_fund_request_atomic`, `create_expense_atomic`, etc.)
 *    so balances, permissions, and password verification cannot be bypassed in the browser.
 * 4. Server-side rate limiting & audit logging.
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
  passwordHashingAlgorithm: 'PBKDF2-SHA256';
  sessionTtlHours: number;
  supabaseSchemaPath: string;
}

export const SECURITY_ARCHITECTURE_STATUS: RoomSplitSecurityCapabilities = {
  executionMode: 'client_local_only',
  serverSideEnforcementActive: false,
  passwordHashingAlgorithm: 'PBKDF2-SHA256',
  sessionTtlHours: 24,
  supabaseSchemaPath: '/supabase/schema_and_rls.sql',
};

/**
 * Verifies that the acting user has an active, non-expired session for the target group
 * and strictly resolves their `Member` record by authenticated `accountId` (never falling back to index 0).
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
