import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityItem,
  Contribution,
  Expense,
  FundRequest,
  Group,
  GroupFinancialSummary,
  GroupLoanSummary,
  GroupSettingsUpdateInput,
  Member,
  PersonalLoan,
  SettlementTransfer,
  UserAccount,
} from '../types';
import {
  calculateGroupFinancialSummary,
  calculateGroupLoanSummary,
  EMPTY_FINANCIAL_SUMMARY,
  EMPTY_LOAN_SUMMARY,
} from '../utils/calculations';
import { canApproveFundRequests } from '../utils/permissions';
import {
  claimActionLock,
  sanitizePhone,
  sanitizeText,
  validateFinancialAmount,
  validatePasswordStrength,
} from '../utils/security';
import {
  applyGroupSettingsUpdate,
  validateCoAdminChange,
  validateContributionPayload,
  validateExpensePayload,
  validateFundRequestReview,
  validateLoanPayload,
  validateLoanRepaymentPayload,
  validateSettlementPayload,
} from './storeLogic';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  confirmContributionRpc,
  createExpenseRpc,
  createGroupRpc,
  createLoanRpc,
  cancelFundRequestDirect,
  ensureAnonymousAuthAndSaveProfile,
  fetchUserGroupsAndData,
  getCurrentSessionAndProfile,
  joinGroupRpc,
  recordLoanRepaymentRpc,
  recordSettlementRpc,
  reviewFundRequestRpc,
  setMemberRoleRpc,
  signOutSupabase,
  submitFundRequestDirect,
  subscribeToGroupChanges,
  updateFundRequestDirect,
  updateGroupSettingsRpc,
} from '../services/supabaseService';

interface RoomSplitContextType {
  supabaseConfigured: boolean;
  isAuthLoading: boolean;
  groups: Group[];
  authorizedGroups: Group[];
  activeGroup: Group | null;
  currentMember: Member | null;
  userAccount: UserAccount | null;
  saveUserAccount: (
    name: string,
    phone: string,
    roomNumber: string
  ) => Promise<{ success: boolean; account?: UserAccount; message?: string }>;
  clearUserAccount: () => Promise<void>;
  contributions: Contribution[];
  fundRequests: FundRequest[];
  expenses: Expense[];
  loans: PersonalLoan[];
  activities: ActivityItem[];
  financialSummary: GroupFinancialSummary;
  loanSummary: GroupLoanSummary;
  switchGroup: (groupId: string) => boolean;
  leaveGroup: () => void;
  createGroup: (
    name: string,
    password: string,
    initialFund: number,
    currency: 'IQD' | 'USD' | 'EUR',
    adminProfile: { name: string; phone: string; roomNumber: string },
    description?: string
  ) => Promise<{ success: boolean; group?: Group; message?: string }>;
  verifyGroupCredentials: (
    code: string,
    password: string
  ) => Promise<{
    valid: boolean;
    group?: Group;
    member?: Member;
    needsProfile?: boolean;
    error?: string;
    retryAfterSeconds?: number;
  }>;
  joinGroup: (
    code: string,
    password: string,
    memberProfile?: { name: string; phone: string; roomNumber: string }
  ) => Promise<{
    success: boolean;
    message?: string;
    group?: Group;
    retryAfterSeconds?: number;
  }>;
  updateGroupSettings: (
    data: GroupSettingsUpdateInput
  ) => Promise<{ success: boolean; message?: string }>;
  updateMemberProfile: (
    name: string,
    phone: string,
    roomNumber: string
  ) => Promise<{ success: boolean; message?: string }>;
  addCoAdmin: (memberId: string) => Promise<boolean>;
  removeCoAdmin: (memberId: string) => Promise<boolean>;
  confirmContribution: (
    memberId: string,
    amountReceived: number,
    notes?: string
  ) => Promise<{ success: boolean; message: string }>;
  requestFundContribution: (
    amount: number,
    notes?: string
  ) => Promise<{ success: boolean; message: string }>;
  updateFundRequest: (
    requestId: string,
    amount: number,
    notes?: string
  ) => Promise<{ success: boolean; message: string }>;
  cancelFundRequest: (requestId: string) => Promise<{ success: boolean; message: string }>;
  reviewFundRequest: (
    requestId: string,
    decision: 'approved' | 'rejected'
  ) => Promise<{ success: boolean; message: string }>;
  addExpense: (
    expense: Omit<Expense, 'id' | 'groupId' | 'createdByMemberId' | 'createdByName' | 'createdAt'>
  ) => Promise<{ success: boolean; message: string }>;
  recordLoan: (
    borrowerId: string,
    lenderId: string,
    amount: number,
    description: string,
    date: string
  ) => Promise<{ success: boolean; message: string }>;
  recordLoanRepayment: (
    loanId: string,
    amount: number,
    date: string,
    note?: string
  ) => Promise<{ success: boolean; message: string }>;
  recordSettlementTransfer: (
    fromMemberId: string,
    toMemberId: string,
    amount: number
  ) => Promise<{ success: boolean; message: string }>;
  resetToDefaultData: () => Promise<void>;
}

const RoomSplitContext = createContext<RoomSplitContextType | undefined>(undefined);

/**
 * Only harmless UI preferences are stored in localStorage:
 * - `roomsplit_language_v4` (managed in i18n/index.tsx)
 * - `roomsplit_ui_last_group` (remembers last active room tab UUID; server RLS still enforces membership)
 */
const UI_PREF_LAST_GROUP_KEY = 'roomsplit_ui_last_group';

const LEGACY_SHARED_STORAGE_KEYS = [
  'roomsplit_groups_v4',
  'roomsplit_active_group_id_v4',
  'roomsplit_current_user_id_v4',
  'roomsplit_user_account_v4',
  'roomsplit_sessions_v4',
  'roomsplit_contributions_v4',
  'roomsplit_fund_requests_v4',
  'roomsplit_expenses_v4',
  'roomsplit_loans_v4',
  'roomsplit_settlements_v4',
  'roomsplit_activities_v4',
];

function purgeSharedLocalStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToRemove: string[] = [...LEGACY_SHARED_STORAGE_KEYS];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        key.startsWith('roomsplit_') &&
        key !== 'roomsplit_language_v4' &&
        key !== UI_PREF_LAST_GROUP_KEY
      ) {
        keysToRemove.push(key);
      }
    }
    Array.from(new Set(keysToRemove)).forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignore storage access errors
  }
}

function readUiLastGroupId(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const val = window.localStorage.getItem(UI_PREF_LAST_GROUP_KEY);
    return val && typeof val === 'string' ? val : null;
  } catch {
    return null;
  }
}

function writeUiLastGroupId(groupId: string | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (groupId) {
      window.localStorage.setItem(UI_PREF_LAST_GROUP_KEY, groupId);
    } else {
      window.localStorage.removeItem(UI_PREF_LAST_GROUP_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

export const RoomSplitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  purgeSharedLocalStorage();

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => readUiLastGroupId());
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<PersonalLoan[]>([]);
  const [settlementTransfers, setSettlementTransfers] = useState<SettlementTransfer[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const clearDomainState = useCallback(() => {
    setGroups([]);
    setContributions([]);
    setFundRequests([]);
    setExpenses([]);
    setLoans([]);
    setSettlementTransfers([]);
    setActivities([]);
  }, []);

  const hydrateForUser = useCallback(
    async (userId: string) => {
      try {
        const bundle = await fetchUserGroupsAndData(userId);
        setGroups(bundle.groups);
        setContributions(bundle.contributions);
        setFundRequests(bundle.fundRequests);
        setExpenses(bundle.expenses);
        setLoans(bundle.loans);
        setSettlementTransfers(bundle.settlementTransfers);
        setActivities(bundle.activities);
        return bundle;
      } catch {
        return null;
      }
    },
    []
  );

  // Sync harmless UI preference for last active room
  useEffect(() => {
    writeUiLastGroupId(activeGroupId);
  }, [activeGroupId]);

  // Bootstrap Supabase session + profile + member-isolated data
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsAuthLoading(false);
      return;
    }

    let mounted = true;

    const syncFromAuth = async () => {
      try {
        const { userId, profile } = await getCurrentSessionAndProfile();
        if (!mounted) return;
        if (userId && profile) {
          setUserAccount(profile);
          await hydrateForUser(userId);
        } else {
          setUserAccount(null);
          clearDomainState();
        }
      } finally {
        if (mounted) setIsAuthLoading(false);
      }
    };

    syncFromAuth();

    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUserAccount(null);
        setActiveGroupId(null);
        clearDomainState();
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        syncFromAuth();
      }
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, [hydrateForUser, clearDomainState]);

  // Live Supabase Realtime sync across roommates in authorized groups
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userAccount?.id || null;

  useEffect(() => {
    if (!isSupabaseConfigured || !userAccount?.id) return;
    return subscribeToGroupChanges(userAccount.id, () => {
      if (userIdRef.current) {
        hydrateForUser(userIdRef.current);
      }
    });
  }, [userAccount?.id, hydrateForUser]);

  // Strict authorization: activeGroup & currentMember only resolve when authenticated user is a verified member
  const candidateActiveGroup = groups.find((g) => g.id === activeGroupId) || null;
  const currentMember =
    candidateActiveGroup && userAccount
      ? candidateActiveGroup.members.find((m) => m.id === userAccount.id) || null
      : null;
  const activeGroup = currentMember ? candidateActiveGroup : null;

  const authorizedGroups = useMemo(() => {
    if (!userAccount) return [];
    return groups.filter((g) => g.members.some((m) => m.id === userAccount.id));
  }, [groups, userAccount]);

  const financialSummary = activeGroup
    ? calculateGroupFinancialSummary(activeGroup, contributions, expenses, loans, settlementTransfers)
    : EMPTY_FINANCIAL_SUMMARY;

  const loanSummary = activeGroup
    ? calculateGroupLoanSummary(activeGroup, loans)
    : EMPTY_LOAN_SUMMARY;

  const saveUserAccount = async (
    name: string,
    phone: string,
    roomNumber: string
  ): Promise<{ success: boolean; account?: UserAccount; message?: string }> => {
    const cleanName = sanitizeText(name, 80);
    const cleanPhone = sanitizePhone(phone);
    const cleanRoom = sanitizeText(roomNumber, 40);

    if (!cleanName || !cleanPhone || !cleanRoom) {
      return { success: false, message: 'Name, phone number, and room number are required.' };
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        message:
          'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
      };
    }

    const res = await ensureAnonymousAuthAndSaveProfile(cleanName, cleanPhone, cleanRoom);
    if (!res.success || !res.account) {
      return { success: false, message: res.message || 'Could not save account profile.' };
    }

    setUserAccount(res.account);
    await hydrateForUser(res.account.id);
    return { success: true, account: res.account };
  };

  const clearUserAccount = async (): Promise<void> => {
    await signOutSupabase();
    setUserAccount(null);
    setActiveGroupId(null);
    writeUiLastGroupId(null);
    clearDomainState();
  };

  const switchGroup = (groupId: string): boolean => {
    if (!userAccount) return false;
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return false;

    const isMember = targetGroup.members.some((m) => m.id === userAccount.id);
    if (!isMember) return false;

    setActiveGroupId(groupId);
    return true;
  };

  const leaveGroup = () => {
    setActiveGroupId(null);
  };

  const createGroup = async (
    name: string,
    password: string,
    initialFund: number,
    currency: 'IQD' | 'USD' | 'EUR' = 'IQD',
    adminProfile: { name: string; phone: string; roomNumber: string },
    description: string = ''
  ): Promise<{ success: boolean; group?: Group; message?: string }> => {
    if (!claimActionLock('createGroup', 1000)) {
      return { success: false, message: 'Please wait a moment before submitting again.' };
    }

    const cleanName = sanitizeText(name, 80);
    if (!cleanName) {
      return { success: false, message: 'Please enter a valid group name.' };
    }

    const passCheck = validatePasswordStrength(password);
    if (!passCheck.valid) {
      return {
        success: false,
        message:
          passCheck.reason === 'too_long'
            ? 'Password is too long.'
            : 'Password must be at least 4 characters long.',
      };
    }

    const fundCheck = validateFinancialAmount(initialFund || 0, { allowZero: true });
    if (!fundCheck.valid) {
      return { success: false, message: 'Initial fund must be a valid non-negative number.' };
    }

    let account = userAccount;
    if (!account) {
      const saved = await saveUserAccount(
        adminProfile.name,
        adminProfile.phone,
        adminProfile.roomNumber
      );
      if (!saved.success || !saved.account) {
        return { success: false, message: saved.message || 'Please create your account first.' };
      }
      account = saved.account;
    }

    const res = await createGroupRpc(
      cleanName,
      password.trim(),
      fundCheck.value,
      currency,
      sanitizeText(description, 200)
    );

    if (!res.success || !res.groupId) {
      return { success: false, message: res.message || 'Unable to create group.' };
    }

    const bundle = await hydrateForUser(account.id);
    const createdGroup = bundle?.groups.find((g) => g.id === res.groupId);
    setActiveGroupId(res.groupId);
    return { success: true, group: createdGroup };
  };

  const verifyGroupCredentials = async (
    code: string,
    password: string
  ): Promise<{
    valid: boolean;
    group?: Group;
    member?: Member;
    needsProfile?: boolean;
    error?: string;
    retryAfterSeconds?: number;
  }> => {
    const res = await joinGroup(code, password);
    if (!res.success || !res.group) {
      return {
        valid: false,
        error: res.message,
        retryAfterSeconds: res.retryAfterSeconds,
      };
    }
    const member = res.group.members.find((m) => m.id === userAccount?.id);
    return { valid: true, group: res.group, member, needsProfile: false };
  };

  const joinGroup = async (
    code: string,
    password: string,
    profile?: { name: string; phone: string; roomNumber: string }
  ): Promise<{
    success: boolean;
    message?: string;
    group?: Group;
    retryAfterSeconds?: number;
  }> => {
    const cleanCode = sanitizeText(code, 20).toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Please enter a room code (e.g. RS-6582).' };
    }

    if (!claimActionLock(`join:${cleanCode}`, 700)) {
      return { success: false, message: 'Please wait a moment before trying again.' };
    }

    let account = userAccount;
    if (!account && profile) {
      const saved = await saveUserAccount(profile.name, profile.phone, profile.roomNumber);
      if (!saved.success || !saved.account) {
        return { success: false, message: saved.message || 'Please create an account first.' };
      }
      account = saved.account;
    }

    if (!account) {
      return { success: false, message: 'Please create an account first to join the room.' };
    }

    const rpcRes = await joinGroupRpc(cleanCode, password);
    if (!rpcRes.success || !rpcRes.groupId) {
      return {
        success: false,
        message: rpcRes.message || 'Invalid room code or password.',
        retryAfterSeconds: rpcRes.retryAfterSeconds,
      };
    }

    const bundle = await hydrateForUser(account.id);
    const joinedGroup = bundle?.groups.find((g) => g.id === rpcRes.groupId);
    setActiveGroupId(rpcRes.groupId);

    return { success: true, group: joinedGroup };
  };

  const updateGroupSettings = async (
    data: GroupSettingsUpdateInput
  ): Promise<{ success: boolean; message?: string }> => {
    if (!activeGroup || !currentMember || !userAccount) {
      return { success: false, message: 'No active authorized group session.' };
    }

    if (data.newPassword && data.newPassword.trim().length > 0) {
      const passCheck = validatePasswordStrength(data.newPassword);
      if (!passCheck.valid) {
        return {
          success: false,
          message:
            passCheck.reason === 'too_long'
              ? 'Password is too long.'
              : 'Password must be at least 4 characters long.',
        };
      }
    }

    const check = applyGroupSettingsUpdate(activeGroup, currentMember, data);
    if (!check.valid) {
      return { success: false, message: check.message };
    }

    const res = await updateGroupSettingsRpc(activeGroup.id, {
      name: data.name !== undefined ? check.data.name : undefined,
      description: data.description !== undefined ? check.data.description : undefined,
      newPassword: data.newPassword?.trim() || undefined,
      expectedContributionPerMember: data.expectedContributionPerMember,
    });

    if (!res.success) {
      return { success: false, message: res.message || 'Unable to update group settings.' };
    }

    await hydrateForUser(userAccount.id);
    return { success: true };
  };

  const updateMemberProfile = async (
    name: string,
    phone: string,
    roomNumber: string
  ): Promise<{ success: boolean; message?: string }> => {
    const res = await saveUserAccount(name, phone, roomNumber);
    return { success: res.success, message: res.message };
  };

  const addCoAdmin = async (memberId: string): Promise<boolean> => {
    const check = validateCoAdminChange(activeGroup, currentMember, memberId);
    if (!check.valid || !activeGroup || !userAccount) return false;

    const ok = await setMemberRoleRpc(activeGroup.id, memberId, 'co_admin');
    if (ok) {
      await hydrateForUser(userAccount.id);
    }
    return ok;
  };

  const removeCoAdmin = async (memberId: string): Promise<boolean> => {
    const check = validateCoAdminChange(activeGroup, currentMember, memberId);
    if (!check.valid || !activeGroup || !userAccount) return false;

    const ok = await setMemberRoleRpc(activeGroup.id, memberId, 'member');
    if (ok) {
      await hydrateForUser(userAccount.id);
    }
    return ok;
  };

  const confirmContribution = async (
    memberId: string,
    amountReceived: number,
    notes?: string
  ): Promise<{ success: boolean; message: string }> => {
    const check = validateContributionPayload(
      activeGroup,
      currentMember,
      memberId,
      amountReceived,
      notes
    );
    if (!check.valid || !activeGroup || !currentMember || !userAccount) {
      return { success: false, message: check.valid ? 'Unauthorized.' : check.message };
    }

    if (!claimActionLock(`contrib:${activeGroup.id}:${memberId}:${check.data.amount}`, 700)) {
      return { success: false, message: 'Duplicate submission prevented. Please wait a moment.' };
    }

    const res = await confirmContributionRpc(
      activeGroup.id,
      memberId,
      check.data.amount,
      check.data.cleanNotes
    );
    if (res.success) {
      await hydrateForUser(userAccount.id);
    }
    return res;
  };

  const requestFundContribution = async (
    amount: number,
    notes?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!activeGroup || !currentMember || !userAccount) {
      return { success: false, message: 'No active authorized group session.' };
    }

    const amountCheck = validateFinancialAmount(amount);
    if (!amountCheck.valid) {
      return { success: false, message: amountCheck.error || 'Please enter a valid fund amount.' };
    }

    if (!claimActionLock(`freq:${activeGroup.id}:${currentMember.id}:${amountCheck.value}`, 800)) {
      return { success: false, message: 'Duplicate submission prevented. Please wait a moment.' };
    }

    const cleanNotes = sanitizeText(notes || '', 200);
    const res = await submitFundRequestDirect(
      activeGroup.id,
      currentMember.id,
      currentMember.name,
      amountCheck.value,
      cleanNotes || undefined
    );

    if (res.success) {
      await hydrateForUser(userAccount.id);
      return {
        success: true,
        message: `Submitted ${amountCheck.value.toLocaleString()} ${activeGroup.currency} request for Admin approval!`,
      };
    }
    return res;
  };

  const updateFundRequest = async (
    requestId: string,
    amount: number,
    notes?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!activeGroup || !currentMember || !userAccount) {
      return { success: false, message: 'No active authorized group session.' };
    }

    const existing = fundRequests.find((r) => r.id === requestId && r.groupId === activeGroup.id);
    if (!existing) {
      return { success: false, message: 'Fund request not found.' };
    }
    if (existing.memberId !== currentMember.id) {
      return { success: false, message: 'You can only edit your own fund requests.' };
    }
    if (existing.status !== 'pending') {
      return { success: false, message: 'Only pending requests can be edited.' };
    }

    const amountCheck = validateFinancialAmount(amount);
    if (!amountCheck.valid) {
      return { success: false, message: amountCheck.error || 'Please enter a valid fund amount.' };
    }

    const cleanNotes = sanitizeText(notes || '', 200);
    const res = await updateFundRequestDirect(
      activeGroup.id,
      requestId,
      amountCheck.value,
      cleanNotes || undefined
    );

    if (res.success) {
      await hydrateForUser(userAccount.id);
      return {
        success: true,
        message: `Updated fund request to ${amountCheck.value.toLocaleString()} ${activeGroup.currency}.`,
      };
    }
    return res;
  };

  const cancelFundRequest = async (
    requestId: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!activeGroup || !currentMember || !userAccount) {
      return { success: false, message: 'No active authorized group session.' };
    }

    const existing = fundRequests.find((r) => r.id === requestId && r.groupId === activeGroup.id);
    if (!existing) {
      return { success: false, message: 'Fund request not found.' };
    }
    if (existing.memberId !== currentMember.id && !canApproveFundRequests(currentMember)) {
      return { success: false, message: 'Permission denied.' };
    }
    if (existing.status !== 'pending') {
      return { success: false, message: 'Only pending requests can be cancelled.' };
    }

    const res = await cancelFundRequestDirect(activeGroup.id, requestId);
    if (res.success) {
      await hydrateForUser(userAccount.id);
    }
    return res;
  };

  const reviewFundRequest = async (
    requestId: string,
    decision: 'approved' | 'rejected'
  ): Promise<{ success: boolean; message: string }> => {
    const req = fundRequests.find((r) => r.id === requestId && r.groupId === activeGroup?.id);
    const check = validateFundRequestReview(activeGroup, currentMember, req, decision);
    if (!check.valid || !activeGroup || !currentMember || !userAccount) {
      return { success: false, message: check.valid ? 'Unauthorized.' : check.message };
    }

    if (!claimActionLock(`review:${requestId}`, 1000)) {
      return { success: false, message: 'This request is already being processed.' };
    }

    const res = await reviewFundRequestRpc(requestId, decision);
    if (res.success) {
      await hydrateForUser(userAccount.id);
    }
    return res;
  };

  const addExpense = async (
    expenseData: Omit<Expense, 'id' | 'groupId' | 'createdByMemberId' | 'createdByName' | 'createdAt'>
  ): Promise<{ success: boolean; message: string }> => {
    const check = validateExpensePayload(
      activeGroup,
      currentMember,
      financialSummary.remainingGroupFund,
      expenseData
    );
    if (!check.valid || !activeGroup || !currentMember || !userAccount) {
      return { success: false, message: check.valid ? 'Unauthorized.' : check.message };
    }

    if (
      !claimActionLock(
        `exp:${activeGroup.id}:${currentMember.id}:${check.data.amount}:${check.data.description}`,
        700
      )
    ) {
      return { success: false, message: 'Duplicate expense submission prevented.' };
    }

    const res = await createExpenseRpc(activeGroup.id, check.data);
    if (res.success) {
      await hydrateForUser(userAccount.id);
    }
    return res;
  };

  const recordLoan = async (
    borrowerId: string,
    lenderId: string,
    amount: number,
    description: string,
    date: string
  ): Promise<{ success: boolean; message: string }> => {
    const check = validateLoanPayload(
      activeGroup,
      currentMember,
      borrowerId,
      lenderId,
      amount,
      description,
      date
    );
    if (!check.valid || !activeGroup || !userAccount) {
      return { success: false, message: check.valid ? 'Unauthorized.' : check.message };
    }

    if (
      !claimActionLock(
        `loan:${activeGroup.id}:${borrowerId}:${lenderId}:${check.data.amount}:${check.data.description}`,
        700
      )
    ) {
      return { success: false, message: 'Duplicate loan submission prevented.' };
    }

    const res = await createLoanRpc(
      activeGroup.id,
      check.data.borrower.id,
      check.data.lender.id,
      check.data.amount,
      check.data.description,
      check.data.date
    );
    if (res.success) {
      await hydrateForUser(userAccount.id);
    }
    return res;
  };

  const recordLoanRepayment = async (
    loanId: string,
    amount: number,
    date: string,
    note?: string
  ): Promise<{ success: boolean; message: string }> => {
    const loan = loans.find((l) => l.id === loanId && l.groupId === activeGroup?.id);
    const check = validateLoanRepaymentPayload(activeGroup, currentMember, loan, amount, date, note);
    if (!check.valid || !activeGroup || !userAccount) {
      return { success: false, message: check.valid ? 'Unauthorized.' : check.message };
    }

    if (!claimActionLock(`repay:${loanId}:${check.data.repayAmount}`, 700)) {
      return { success: false, message: 'Duplicate repayment prevented. Please wait a moment.' };
    }

    const res = await recordLoanRepaymentRpc(
      loanId,
      check.data.repayAmount,
      check.data.date,
      check.data.cleanNote
    );
    if (res.success) {
      await hydrateForUser(userAccount.id);
    }
    return res;
  };

  const recordSettlementTransfer = async (
    fromMemberId: string,
    toMemberId: string,
    amount: number
  ): Promise<{ success: boolean; message: string }> => {
    const check = validateSettlementPayload(
      activeGroup,
      currentMember,
      financialSummary,
      fromMemberId,
      toMemberId,
      amount
    );
    if (!check.valid || !activeGroup || !userAccount) {
      return { success: false, message: check.valid ? 'Unauthorized.' : check.message };
    }

    if (
      !claimActionLock(
        `settle:${activeGroup.id}:${fromMemberId}:${toMemberId}:${check.data.amount}`,
        800
      )
    ) {
      return { success: false, message: 'Duplicate settlement prevented.' };
    }

    const res = await recordSettlementRpc(
      activeGroup.id,
      check.data.fromMember.id,
      check.data.toMember.id,
      check.data.amount
    );
    if (res.success) {
      await hydrateForUser(userAccount.id);
    }
    return res;
  };

  const resetToDefaultData = async (): Promise<void> => {
    await clearUserAccount();
    purgeSharedLocalStorage();
  };

  return (
    <RoomSplitContext.Provider
      value={{
        supabaseConfigured: isSupabaseConfigured,
        isAuthLoading,
        groups,
        authorizedGroups,
        activeGroup,
        currentMember,
        userAccount,
        saveUserAccount,
        clearUserAccount,
        contributions,
        fundRequests,
        expenses,
        loans,
        activities,
        financialSummary,
        loanSummary,
        switchGroup,
        leaveGroup,
        createGroup,
        verifyGroupCredentials,
        joinGroup,
        updateGroupSettings,
        updateMemberProfile,
        addCoAdmin,
        removeCoAdmin,
        confirmContribution,
        requestFundContribution,
        updateFundRequest,
        cancelFundRequest,
        reviewFundRequest,
        addExpense,
        recordLoan,
        recordLoanRepayment,
        recordSettlementTransfer,
        resetToDefaultData,
      }}
    >
      {children}
    </RoomSplitContext.Provider>
  );
};

export const useRoomSplit = (): RoomSplitContextType => {
  const context = useContext(RoomSplitContext);
  if (!context) {
    throw new Error('useRoomSplit must be used within a RoomSplitProvider');
  }
  return context;
};
