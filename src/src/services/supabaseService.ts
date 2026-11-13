import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSafeSupabaseError, supabase as defaultSupabase } from '../lib/supabase';
import type {
  ActivityItem,
  Contribution,
  Expense,
  FundRequest,
  Group,
  GroupSettingsUpdateInput,
  LoanRepayment,
  Member,
  MemberRole,
  PaymentSourceType,
  PersonalLoan,
  SettlementTransfer,
  UserAccount,
} from '../types';

export interface DbProfileRow {
  id: string;
  name: string;
  phone: string;
  room_number: string;
  created_at: string;
  updated_at?: string;
}

export interface DbGroupRow {
  id: string;
  name: string;
  code: string;
  initial_fund: number | string;
  description: string | null;
  currency: 'IQD' | 'USD' | 'EUR';
  main_admin_id: string;
  expected_contribution_per_member: number | string;
  is_archived: boolean;
  created_at: string;
}

export interface DbGroupMemberRow {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string;
  phone: string;
  room_number: string;
  role: MemberRole;
  joined_at: string;
}

export interface DbContributionRow {
  id: string;
  group_id: string;
  member_id: string;
  member_name: string;
  expected_amount: number | string;
  confirmed_amount: number | string;
  status: 'pending' | 'partially_paid' | 'fully_paid';
  confirmed_by_admin_id: string | null;
  confirmed_by_admin_name: string | null;
  confirmed_at: string | null;
  notes: string | null;
}

export interface DbFundRequestRow {
  id: string;
  group_id: string;
  member_id: string;
  member_name: string;
  amount: number | string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  request_date: string;
  reviewed_by_admin_id: string | null;
  reviewed_by_admin_name: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface DbExpenseRow {
  id: string;
  group_id: string;
  amount: number | string;
  description: string;
  expense_date: string;
  shared_member_ids: string[];
  payment_source: PaymentSourceType;
  paid_from_group_fund: number | string;
  personal_payer_id: string | null;
  personal_payer_name: string | null;
  paid_personally: number | string;
  created_by_member_id: string;
  created_by_name: string;
  created_at: string;
}

export interface DbLoanRow {
  id: string;
  group_id: string;
  borrower_id: string;
  borrower_name: string;
  lender_id: string;
  lender_name: string;
  original_amount: number | string;
  remaining_amount: number | string;
  description: string;
  loan_date: string;
  status: 'active' | 'partially_repaid' | 'settled';
  created_at: string;
}

export interface DbLoanRepaymentRow {
  id: string;
  loan_id: string;
  group_id: string;
  amount: number | string;
  repayment_date: string;
  note: string | null;
  remaining_after: number | string;
  confirmed_by_id: string;
  created_at: string;
}

export interface DbSettlementTransferRow {
  id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number | string;
  transfer_date: string;
  recorded_by_id: string;
  created_at: string;
}

export interface DbActivityRow {
  id: string;
  group_id: string;
  type: ActivityItem['type'];
  title: string;
  description: string;
  amount: number | string;
  actor_name: string;
  target_name: string | null;
  activity_date: string;
  created_at: string;
}

export interface HydratedGroupBundle {
  groups: Group[];
  contributions: Contribution[];
  fundRequests: FundRequest[];
  expenses: Expense[];
  loans: PersonalLoan[];
  settlementTransfers: SettlementTransfer[];
  activities: ActivityItem[];
}

function toNum(val: number | string | null | undefined, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toEpochMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function mapProfileRow(row: DbProfileRow): UserAccount {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    roomNumber: row.room_number,
    createdAt: row.created_at,
  };
}

export function mapDatabaseRowsToDomainState(raw: {
  groups: DbGroupRow[];
  members: DbGroupMemberRow[];
  contributions: DbContributionRow[];
  fundRequests: DbFundRequestRow[];
  expenses: DbExpenseRow[];
  loans: DbLoanRow[];
  repayments: DbLoanRepaymentRow[];
  settlements: DbSettlementTransferRow[];
  activities: DbActivityRow[];
}): HydratedGroupBundle {
  const membersByGroup = new Map<string, Member[]>();
  const coAdminsByGroup = new Map<string, string[]>();

  for (const m of raw.members) {
    const list = membersByGroup.get(m.group_id) || [];
    list.push({
      id: m.user_id,
      name: m.display_name,
      phone: m.phone,
      roomNumber: m.room_number,
      role: m.role,
    });
    membersByGroup.set(m.group_id, list);

    if (m.role === 'co_admin') {
      const co = coAdminsByGroup.get(m.group_id) || [];
      co.push(m.user_id);
      coAdminsByGroup.set(m.group_id, co);
    }
  }

  const groups: Group[] = raw.groups.map((g) => ({
    id: g.id,
    name: g.name,
    code: g.code,
    initialFund: toNum(g.initial_fund, 0),
    description: g.description || undefined,
    currency: g.currency,
    mainAdminId: g.main_admin_id,
    coAdminIds: coAdminsByGroup.get(g.id) || [],
    members: membersByGroup.get(g.id) || [],
    expectedContributionPerMember: toNum(g.expected_contribution_per_member, 10000),
    isArchived: g.is_archived,
  }));

  const contributions: Contribution[] = raw.contributions.map((c) => ({
    id: c.id,
    groupId: c.group_id,
    memberId: c.member_id,
    memberName: c.member_name,
    expectedAmount: toNum(c.expected_amount, 10000),
    confirmedAmount: toNum(c.confirmed_amount, 0),
    status: c.status,
    confirmedByAdminId: c.confirmed_by_admin_id || undefined,
    confirmedByAdminName: c.confirmed_by_admin_name || undefined,
    confirmedAt: c.confirmed_at || undefined,
    notes: c.notes || undefined,
  }));

  const fundRequests: FundRequest[] = raw.fundRequests.map((r) => ({
    id: r.id,
    groupId: r.group_id,
    memberId: r.member_id,
    memberName: r.member_name,
    amount: toNum(r.amount, 0),
    notes: r.notes || undefined,
    status: r.status,
    date: r.request_date,
    createdAt: r.created_at,
    reviewedByAdminId: r.reviewed_by_admin_id || undefined,
    reviewedByAdminName: r.reviewed_by_admin_name || undefined,
    reviewedAt: r.reviewed_at || undefined,
  }));

  const expenses: Expense[] = raw.expenses.map((e) => ({
    id: e.id,
    groupId: e.group_id,
    amount: toNum(e.amount, 0),
    description: e.description,
    date: e.expense_date,
    sharedMemberIds: Array.isArray(e.shared_member_ids) ? e.shared_member_ids : [],
    paymentSource: e.payment_source,
    paidFromGroupFund: toNum(e.paid_from_group_fund, 0),
    personalPayerId: e.personal_payer_id || undefined,
    personalPayerName: e.personal_payer_name || undefined,
    paidPersonally: toNum(e.paid_personally, 0),
    createdByMemberId: e.created_by_member_id,
    createdByName: e.created_by_name,
    createdAt: e.created_at,
  }));

  const repaymentsByLoan = new Map<string, LoanRepayment[]>();
  for (const rep of raw.repayments) {
    const arr = repaymentsByLoan.get(rep.loan_id) || [];
    arr.push({
      id: rep.id,
      loanId: rep.loan_id,
      amount: toNum(rep.amount, 0),
      date: rep.repayment_date,
      note: rep.note || undefined,
      remainingAfter: toNum(rep.remaining_after, 0),
      createdAt: toEpochMs(rep.created_at),
    });
    repaymentsByLoan.set(rep.loan_id, arr);
  }

  const loans: PersonalLoan[] = raw.loans.map((l) => ({
    id: l.id,
    groupId: l.group_id,
    borrowerId: l.borrower_id,
    borrowerName: l.borrower_name,
    lenderId: l.lender_id,
    lenderName: l.lender_name,
    originalAmount: toNum(l.original_amount, 0),
    remainingAmount: toNum(l.remaining_amount, 0),
    description: l.description,
    date: l.loan_date,
    status: l.status,
    repayments: repaymentsByLoan.get(l.id) || [],
    createdAt: toEpochMs(l.created_at),
  }));

  const settlementTransfers: SettlementTransfer[] = raw.settlements.map((s) => ({
    id: s.id,
    groupId: s.group_id,
    fromMemberId: s.from_member_id,
    toMemberId: s.to_member_id,
    amount: toNum(s.amount, 0),
    date: s.transfer_date,
    timestamp: toEpochMs(s.created_at),
  }));

  const activities: ActivityItem[] = raw.activities.map((a) => ({
    id: a.id,
    groupId: a.group_id,
    type: a.type,
    title: a.title,
    description: a.description,
    amount: toNum(a.amount, 0),
    actorName: a.actor_name,
    targetName: a.target_name || undefined,
    date: a.activity_date,
    timestamp: toEpochMs(a.created_at),
  }));

  return {
    groups,
    contributions,
    fundRequests,
    expenses,
    loans,
    settlementTransfers,
    activities,
  };
}

function getClientOrThrow(client: SupabaseClient | null): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.'
    );
  }
  return client;
}

export async function getCurrentSessionAndProfile(
  client: SupabaseClient | null = defaultSupabase
): Promise<{ userId: string | null; profile: UserAccount | null }> {
  if (!client) return { userId: null, profile: null };

  const { data: sessionData, error: sessionErr } = await client.auth.getSession();
  if (sessionErr || !sessionData.session?.user) {
    return { userId: null, profile: null };
  }

  const userId = sessionData.session.user.id;
  const { data: profileRow, error: profileErr } = await client
    .from('profiles')
    .select('id, name, phone, room_number, created_at, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profileRow) {
    return { userId, profile: null };
  }

  return {
    userId,
    profile: mapProfileRow(profileRow as DbProfileRow),
  };
}

export async function ensureAnonymousAuthAndSaveProfile(
  name: string,
  phone: string,
  roomNumber: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; account?: UserAccount; message?: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data: sessionData } = await sb.auth.getSession();

    if (!sessionData.session?.user) {
      const { error: authErr } = await sb.auth.signInAnonymously();
      if (authErr) {
        return { success: false, message: getSafeSupabaseError(authErr) };
      }
    }

    const { data, error } = await sb.rpc('update_roomsplit_profile', {
      p_name: name,
      p_phone: phone,
      p_room_number: roomNumber,
    });

    if (error || !data) {
      return { success: false, message: getSafeSupabaseError(error, 'Could not save account profile.') };
    }

    return {
      success: true,
      account: mapProfileRow(data as DbProfileRow),
    };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err, 'Could not save account profile.') };
  }
}

export async function signOutSupabase(
  client: SupabaseClient | null = defaultSupabase
): Promise<void> {
  if (!client) return;
  try {
    await client.auth.signOut();
  } catch {
    // Ignore network sign-out errors
  }
}

export async function fetchUserGroupsAndData(
  userId: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<HydratedGroupBundle> {
  const empty: HydratedGroupBundle = {
    groups: [],
    contributions: [],
    fundRequests: [],
    expenses: [],
    loans: [],
    settlementTransfers: [],
    activities: [],
  };
  if (!client || !userId) return empty;

  const [
    groupsRes,
    membersRes,
    contribRes,
    fundReqRes,
    expensesRes,
    loansRes,
    repaymentsRes,
    settlementsRes,
    activitiesRes,
  ] = await Promise.all([
    client.from('groups').select('*').order('created_at', { ascending: false }),
    client.from('group_members').select('*').order('joined_at', { ascending: true }),
    client.from('contributions').select('*'),
    client.from('fund_requests').select('*').order('created_at', { ascending: false }),
    client.from('expenses').select('*').order('created_at', { ascending: false }),
    client.from('personal_loans').select('*').order('created_at', { ascending: false }),
    client.from('loan_repayments').select('*').order('created_at', { ascending: false }),
    client.from('settlement_transfers').select('*').order('created_at', { ascending: false }),
    client.from('activities').select('*').order('created_at', { ascending: false }),
  ]);

  if (groupsRes.error) {
    throw new Error(getSafeSupabaseError(groupsRes.error));
  }

  return mapDatabaseRowsToDomainState({
    groups: (groupsRes.data || []) as DbGroupRow[],
    members: (membersRes.data || []) as DbGroupMemberRow[],
    contributions: (contribRes.data || []) as DbContributionRow[],
    fundRequests: (fundReqRes.data || []) as DbFundRequestRow[],
    expenses: (expensesRes.data || []) as DbExpenseRow[],
    loans: (loansRes.data || []) as DbLoanRow[],
    repayments: (repaymentsRes.data || []) as DbLoanRepaymentRow[],
    settlements: (settlementsRes.data || []) as DbSettlementTransferRow[],
    activities: (activitiesRes.data || []) as DbActivityRow[],
  });
}

export async function createGroupRpc(
  name: string,
  password: string,
  initialFund: number,
  currency: 'IQD' | 'USD' | 'EUR',
  description: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; groupId?: string; message?: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('create_roomsplit_group', {
      p_name: name,
      p_password: password,
      p_initial_fund: initialFund,
      p_currency: currency,
      p_description: description,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error, 'Unable to create group.') };
    }
    const res = data as { success?: boolean; group_id?: string; message?: string } | null;
    if (!res?.success || !res.group_id) {
      return { success: false, message: res?.message || 'Unable to create group.' };
    }
    return { success: true, groupId: res.group_id };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err, 'Unable to create group.') };
  }
}

export async function joinGroupRpc(
  code: string,
  password: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<{
  success: boolean;
  groupId?: string;
  message?: string;
  retryAfterSeconds?: number;
}> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('join_roomsplit_group', {
      p_code: code,
      p_password: password,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error, 'Invalid room code or password.') };
    }
    const res = data as {
      success?: boolean;
      group_id?: string;
      message?: string;
      retry_after_seconds?: number;
    } | null;

    if (!res?.success || !res.group_id) {
      return {
        success: false,
        message: res?.message || 'Invalid room code or password.',
        retryAfterSeconds: res?.retry_after_seconds,
      };
    }

    return { success: true, groupId: res.group_id };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err, 'Unable to join group.') };
  }
}

export async function updateGroupSettingsRpc(
  groupId: string,
  input: GroupSettingsUpdateInput,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message?: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('update_roomsplit_group_settings', {
      p_group_id: groupId,
      p_name: input.name ?? null,
      p_description: input.description ?? null,
      p_new_password: input.newPassword ?? null,
      p_expected_contribution: input.expectedContributionPerMember ?? null,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error) };
    }
    const res = data as { success?: boolean; message?: string } | null;
    return { success: Boolean(res?.success), message: res?.message };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export async function setMemberRoleRpc(
  groupId: string,
  targetUserId: string,
  role: 'co_admin' | 'member',
  client: SupabaseClient | null = defaultSupabase
): Promise<boolean> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('set_roomsplit_member_role', {
      p_group_id: groupId,
      p_target_user_id: targetUserId,
      p_role: role,
    });
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

export async function confirmContributionRpc(
  groupId: string,
  memberId: string,
  amount: number,
  notes?: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('confirm_roomsplit_contribution', {
      p_group_id: groupId,
      p_member_id: memberId,
      p_amount: amount,
      p_notes: notes ?? null,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error) };
    }
    const res = data as { success?: boolean; message?: string } | null;
    return {
      success: Boolean(res?.success),
      message: res?.message || 'Unable to confirm contribution.',
    };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export async function submitFundRequestDirect(
  groupId: string,
  memberId: string,
  memberName: string,
  amount: number,
  notes?: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message: string }> {
  try {
    const sb = getClientOrThrow(client);
    const today = new Date().toISOString().split('T')[0];
    const { error } = await sb.from('fund_requests').insert({
      group_id: groupId,
      member_id: memberId,
      member_name: memberName,
      amount,
      notes: notes || null,
      status: 'pending',
      request_date: today,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error, 'Could not submit fund request.') };
    }
    return { success: true, message: 'Submitted fund request for Admin approval.' };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export async function updateFundRequestDirect(
  groupId: string,
  requestId: string,
  amount: number,
  notes?: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb
      .from('fund_requests')
      .update({ amount, notes: notes || null })
      .eq('id', requestId)
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        message: getSafeSupabaseError(error, 'Only your own pending requests can be edited.'),
      };
    }
    return { success: true, message: 'Updated pending fund request.' };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export async function cancelFundRequestDirect(
  groupId: string,
  requestId: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { error } = await sb
      .from('fund_requests')
      .delete()
      .eq('id', requestId)
      .eq('group_id', groupId)
      .eq('status', 'pending');

    if (error) {
      return {
        success: false,
        message: getSafeSupabaseError(error, 'Unable to cancel pending request.'),
      };
    }
    return { success: true, message: 'Cancelled pending fund request.' };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export async function reviewFundRequestRpc(
  requestId: string,
  decision: 'approved' | 'rejected',
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('approve_fund_request_atomic', {
      p_request_id: requestId,
      p_decision: decision,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error) };
    }
    const res = data as { success?: boolean; message?: string } | null;
    return {
      success: Boolean(res?.success),
      message: res?.message || 'Unable to process fund request.',
    };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export async function createExpenseRpc(
  groupId: string,
  expense: Omit<Expense, 'id' | 'groupId' | 'createdByMemberId' | 'createdByName' | 'createdAt'>,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('create_roomsplit_expense', {
      p_group_id: groupId,
      p_amount: expense.amount,
      p_description: expense.description,
      p_expense_date: expense.date,
      p_shared_member_ids: expense.sharedMemberIds,
      p_payment_source: expense.paymentSource,
      p_paid_from_group_fund: expense.paidFromGroupFund,
      p_personal_payer_id: expense.personalPayerId ?? null,
      p_paid_personally: expense.paidPersonally,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error) };
    }
    const res = data as { success?: boolean; message?: string } | null;
    return {
      success: Boolean(res?.success),
      message: res?.message || 'Unable to save expense.',
    };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export async function createLoanRpc(
  groupId: string,
  borrowerId: string,
  lenderId: string,
  amount: number,
  description: string,
  date: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('create_roomsplit_loan', {
      p_group_id: groupId,
      p_borrower_id: borrowerId,
      p_lender_id: lenderId,
      p_amount: amount,
      p_description: description,
      p_loan_date: date,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error) };
    }
    const res = data as { success?: boolean; message?: string } | null;
    return {
      success: Boolean(res?.success),
      message: res?.message || 'Unable to record loan.',
    };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export async function recordLoanRepaymentRpc(
  loanId: string,
  amount: number,
  date: string,
  note?: string,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('record_roomsplit_loan_repayment', {
      p_loan_id: loanId,
      p_amount: amount,
      p_repayment_date: date,
      p_note: note ?? null,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error) };
    }
    const res = data as { success?: boolean; message?: string } | null;
    return {
      success: Boolean(res?.success),
      message: res?.message || 'Unable to record repayment.',
    };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export async function recordSettlementRpc(
  groupId: string,
  fromMemberId: string,
  toMemberId: string,
  amount: number,
  client: SupabaseClient | null = defaultSupabase
): Promise<{ success: boolean; message: string }> {
  try {
    const sb = getClientOrThrow(client);
    const { data, error } = await sb.rpc('record_roomsplit_settlement', {
      p_group_id: groupId,
      p_from_member_id: fromMemberId,
      p_to_member_id: toMemberId,
      p_amount: amount,
    });
    if (error) {
      return { success: false, message: getSafeSupabaseError(error) };
    }
    const res = data as { success?: boolean; message?: string } | null;
    return {
      success: Boolean(res?.success),
      message: res?.message || 'Unable to record settlement.',
    };
  } catch (err) {
    return { success: false, message: getSafeSupabaseError(err) };
  }
}

export function subscribeToGroupChanges(
  userId: string | null,
  onSyncNeeded: () => void,
  client: SupabaseClient | null = defaultSupabase
): () => void {
  if (!client || !userId) return () => {};

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const trigger = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onSyncNeeded();
    }, 250);
  };

  const tables = [
    'groups',
    'group_members',
    'contributions',
    'fund_requests',
    'expenses',
    'personal_loans',
    'loan_repayments',
    'settlement_transfers',
    'activities',
  ];

  let channel: RealtimeChannel = client.channel(`roomsplit-user-${userId}`);
  for (const table of tables) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      trigger
    );
  }
  channel.subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    client.removeChannel(channel);
  };
}
