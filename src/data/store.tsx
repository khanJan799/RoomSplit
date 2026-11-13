import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Group,
  Member,
  UserAccount,
  AuthSession,
  GroupSettingsUpdateInput,
  Contribution,
  FundRequest,
  Expense,
  PersonalLoan,
  SettlementTransfer,
  ActivityItem,
  GroupFinancialSummary,
  GroupLoanSummary,
} from '../types';
import {
  INITIAL_GROUPS,
  INITIAL_CONTRIBUTIONS,
  INITIAL_EXPENSES,
  INITIAL_LOANS,
  INITIAL_ACTIVITIES,
  INITIAL_SETTLEMENTS,
} from './mockData';
import {
  calculateGroupFinancialSummary,
  calculateGroupLoanSummary,
  EMPTY_FINANCIAL_SUMMARY,
  EMPTY_LOAN_SUMMARY,
} from '../utils/calculations';
import { canApproveFundRequests } from '../utils/permissions';
import {
  checkJoinRateLimit,
  claimActionLock,
  clearJoinRateLimit,
  createAuthSession,
  generateRoomCode,
  generateSecureId,
  hashGroupPassword,
  isValidActivity,
  isValidContribution,
  isValidExpense,
  isValidFundRequest,
  isValidGroup,
  isValidLoan,
  isValidSessionRecord,
  isValidSettlementTransfer,
  isValidUserAccount,
  pruneExpiredSessions,
  recordFailedJoinAttempt,
  safeParseArray,
  safeParseObject,
  sanitizePhone,
  sanitizeText,
  validateFinancialAmount,
  validatePasswordStrength,
  verifyGroupPassword,
} from '../utils/security';
import { authorizeGroupMember } from '../services/securityArchitecture';
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

interface RoomSplitContextType {
  groups: Group[];
  authorizedGroups: Group[];
  activeGroup: Group | null;
  currentMember: Member | null;
  userAccount: UserAccount | null;
  saveUserAccount: (name: string, phone: string, roomNumber: string) => UserAccount;
  clearUserAccount: () => void;
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
  updateMemberProfile: (name: string, phone: string, roomNumber: string) => void;
  addCoAdmin: (memberId: string) => boolean;
  removeCoAdmin: (memberId: string) => boolean;
  confirmContribution: (
    memberId: string,
    amountReceived: number,
    notes?: string
  ) => { success: boolean; message: string };
  requestFundContribution: (
    amount: number,
    notes?: string
  ) => { success: boolean; message: string };
  updateFundRequest: (
    requestId: string,
    amount: number,
    notes?: string
  ) => { success: boolean; message: string };
  cancelFundRequest: (requestId: string) => { success: boolean; message: string };
  reviewFundRequest: (
    requestId: string,
    decision: 'approved' | 'rejected'
  ) => { success: boolean; message: string };
  addExpense: (
    expense: Omit<Expense, 'id' | 'groupId' | 'createdByMemberId' | 'createdByName' | 'createdAt'>
  ) => { success: boolean; message: string };
  recordLoan: (
    borrowerId: string,
    lenderId: string,
    amount: number,
    description: string,
    date: string
  ) => { success: boolean; message: string };
  recordLoanRepayment: (
    loanId: string,
    amount: number,
    date: string,
    note?: string
  ) => { success: boolean; message: string };
  recordSettlementTransfer: (
    fromMemberId: string,
    toMemberId: string,
    amount: number
  ) => { success: boolean; message: string };
  resetToDefaultData: () => void;
}

const RoomSplitContext = createContext<RoomSplitContextType | undefined>(undefined);

const STORAGE_KEYS = {
  GROUPS: 'roomsplit_groups_v4',
  ACTIVE_GROUP_ID: 'roomsplit_active_group_id_v4',
  CURRENT_USER_ID: 'roomsplit_current_user_id_v4',
  USER_ACCOUNT: 'roomsplit_user_account_v4',
  AUTH_SESSIONS: 'roomsplit_sessions_v4',
  CONTRIBUTIONS: 'roomsplit_contributions_v4',
  FUND_REQUESTS: 'roomsplit_fund_requests_v4',
  EXPENSES: 'roomsplit_expenses_v4',
  LOANS: 'roomsplit_loans_v4',
  SETTLEMENTS: 'roomsplit_settlements_v4',
  ACTIVITIES: 'roomsplit_activities_v4',
};

const purgeLegacyStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('roomsplit_') && !key.endsWith('_v4')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignore storage restrictions
  }
};

type LegacyGroup = Group & { password?: string };

export const RoomSplitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  purgeLegacyStorage();

  const [groups, setGroups] = useState<LegacyGroup[]>(() => {
    try {
      return safeParseArray(localStorage.getItem(STORAGE_KEYS.GROUPS), isValidGroup, INITIAL_GROUPS);
    } catch {
      return INITIAL_GROUPS;
    }
  });

  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_GROUP_ID);
      return saved && typeof saved === 'string' ? saved : null;
    } catch {
      return null;
    }
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
      return saved && typeof saved === 'string' ? saved : null;
    } catch {
      return null;
    }
  });

  const [userAccount, setUserAccount] = useState<UserAccount | null>(() => {
    try {
      return safeParseObject<UserAccount | null>(
        localStorage.getItem(STORAGE_KEYS.USER_ACCOUNT),
        (obj): obj is UserAccount | null => obj === null || isValidUserAccount(obj),
        null
      );
    } catch {
      return null;
    }
  });

  // Bound, expiring sessions: groupId -> AuthSession
  const [authSessions, setAuthSessions] = useState<Record<string, AuthSession>>(() => {
    try {
      const raw = safeParseObject<Record<string, AuthSession>>(
        localStorage.getItem(STORAGE_KEYS.AUTH_SESSIONS),
        isValidSessionRecord,
        {}
      );
      return pruneExpiredSessions(raw);
    } catch {
      return {};
    }
  });

  const [contributions, setContributions] = useState<Contribution[]>(() => {
    try {
      return safeParseArray(
        localStorage.getItem(STORAGE_KEYS.CONTRIBUTIONS),
        isValidContribution,
        INITIAL_CONTRIBUTIONS
      );
    } catch {
      return INITIAL_CONTRIBUTIONS;
    }
  });

  const [fundRequests, setFundRequests] = useState<FundRequest[]>(() => {
    try {
      return safeParseArray(
        localStorage.getItem(STORAGE_KEYS.FUND_REQUESTS),
        isValidFundRequest,
        []
      );
    } catch {
      return [];
    }
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      return safeParseArray(
        localStorage.getItem(STORAGE_KEYS.EXPENSES),
        isValidExpense,
        INITIAL_EXPENSES
      );
    } catch {
      return INITIAL_EXPENSES;
    }
  });

  const [loans, setLoans] = useState<PersonalLoan[]>(() => {
    try {
      return safeParseArray(localStorage.getItem(STORAGE_KEYS.LOANS), isValidLoan, INITIAL_LOANS);
    } catch {
      return INITIAL_LOANS;
    }
  });

  const [activities, setActivities] = useState<ActivityItem[]>(() => {
    try {
      return safeParseArray(
        localStorage.getItem(STORAGE_KEYS.ACTIVITIES),
        isValidActivity,
        INITIAL_ACTIVITIES
      );
    } catch {
      return INITIAL_ACTIVITIES;
    }
  });

  const [settlementTransfers, setSettlementTransfers] = useState<SettlementTransfer[]>(() => {
    try {
      return safeParseArray(
        localStorage.getItem(STORAGE_KEYS.SETTLEMENTS),
        isValidSettlementTransfer,
        INITIAL_SETTLEMENTS
      );
    } catch {
      return INITIAL_SETTLEMENTS;
    }
  });

  // Migrate any legacy plain-text `password` fields on groups to salted PBKDF2-SHA256 hashes immediately
  useEffect(() => {
    const groupsWithPlaintext = groups.filter(
      (g) => typeof g.password === 'string' && g.password.trim().length > 0 && !g.passwordHash
    );
    if (groupsWithPlaintext.length === 0) return;

    let cancelled = false;
    (async () => {
      const migrated = await Promise.all(
        groups.map(async (g) => {
          if (typeof g.password === 'string' && g.password.trim().length > 0 && !g.passwordHash) {
            const hashed = await hashGroupPassword(g.password);
            const rest = { ...g };
            delete rest.password;
            return {
              ...rest,
              passwordHash: hashed.hash,
              passwordSalt: hashed.salt,
              passwordAlgorithm: hashed.algorithm,
            };
          }
          if ('password' in g) {
            const rest = { ...g };
            delete rest.password;
            return rest;
          }
          return g;
        })
      );
      if (!cancelled) {
        setGroups(migrated);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groups]);

  // Periodically prune expired sessions
  useEffect(() => {
    const timer = setInterval(() => {
      setAuthSessions((prev) => {
        const cleaned = pruneExpiredSessions(prev);
        return Object.keys(cleaned).length === Object.keys(prev).length ? prev : cleaned;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Persist sanitized state to localStorage (never persisting plain-text group passwords)
  useEffect(() => {
    try {
      const sanitizedGroups = groups.map((g) => {
        if ('password' in g) {
          const rest = { ...g };
          delete rest.password;
          return rest;
        }
        return g;
      });
      localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(sanitizedGroups));

      if (activeGroupId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_GROUP_ID, activeGroupId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_GROUP_ID);
      }
      if (currentUserId) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, currentUserId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
      }
      if (userAccount) {
        localStorage.setItem(STORAGE_KEYS.USER_ACCOUNT, JSON.stringify(userAccount));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER_ACCOUNT);
      }
      localStorage.setItem(STORAGE_KEYS.AUTH_SESSIONS, JSON.stringify(authSessions));
      localStorage.setItem(STORAGE_KEYS.CONTRIBUTIONS, JSON.stringify(contributions));
      localStorage.setItem(STORAGE_KEYS.FUND_REQUESTS, JSON.stringify(fundRequests));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(loans));
      localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(settlementTransfers));
      localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
    } catch {
      // Avoid logging sensitive state payloads
    }
  }, [
    groups,
    activeGroupId,
    currentUserId,
    userAccount,
    authSessions,
    contributions,
    fundRequests,
    expenses,
    loans,
    settlementTransfers,
    activities,
  ]);

  // Strict authorization: activeGroup and currentMember are NEVER resolved without a valid bound session
  const candidateActiveGroup = groups.find((g) => g.id === activeGroupId) || null;
  const currentMember = authorizeGroupMember(
    candidateActiveGroup,
    userAccount?.id || currentUserId,
    authSessions
  );
  const activeGroup = currentMember ? candidateActiveGroup : null;

  // Only expose rooms the authenticated user is actually a member of with an active valid session
  const authorizedGroups = useMemo(() => {
    if (!userAccount) return [];
    return groups.filter((g) => Boolean(authorizeGroupMember(g, userAccount.id, authSessions)));
  }, [groups, userAccount, authSessions]);

  const financialSummary = activeGroup
    ? calculateGroupFinancialSummary(activeGroup, contributions, expenses, loans, settlementTransfers)
    : EMPTY_FINANCIAL_SUMMARY;

  const loanSummary = activeGroup
    ? calculateGroupLoanSummary(activeGroup, loans)
    : EMPTY_LOAN_SUMMARY;

  const saveUserAccount = (name: string, phone: string, roomNumber: string): UserAccount => {
    const cleanName = sanitizeText(name, 80);
    const cleanPhone = sanitizePhone(phone);
    const cleanRoom = sanitizeText(roomNumber, 40);

    const account: UserAccount = {
      id: userAccount?.id || generateSecureId('usr'),
      name: cleanName || 'Roommate',
      phone: cleanPhone,
      roomNumber: cleanRoom || 'Room',
      createdAt: userAccount?.createdAt || new Date().toISOString(),
    };
    setUserAccount(account);
    setCurrentUserId(account.id);
    return account;
  };

  const clearUserAccount = () => {
    setUserAccount(null);
    setCurrentUserId(null);
    setActiveGroupId(null);
    setAuthSessions({});
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_ACCOUNT);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_GROUP_ID);
      localStorage.removeItem(STORAGE_KEYS.AUTH_SESSIONS);
    } catch {
      // Ignore storage errors
    }
  };

  const switchGroup = (groupId: string): boolean => {
    if (!userAccount) return false;
    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return false;

    const authorized = authorizeGroupMember(targetGroup, userAccount.id, authSessions);
    if (!authorized) {
      return false;
    }

    setCurrentUserId(authorized.id);
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

    const newGroupId = generateSecureId('grp');
    const generatedCode = generateRoomCode(groups.map((g) => g.code));
    const hashedPass = await hashGroupPassword(password);

    const account = saveUserAccount(adminProfile.name, adminProfile.phone, adminProfile.roomNumber);

    const adminMember: Member = {
      id: account.id,
      name: account.name,
      phone: account.phone,
      roomNumber: account.roomNumber,
      role: 'main_admin',
    };

    const newGroup: Group = {
      id: newGroupId,
      name: cleanName,
      code: generatedCode,
      passwordHash: hashedPass.hash,
      passwordSalt: hashedPass.salt,
      passwordAlgorithm: hashedPass.algorithm,
      initialFund: fundCheck.value,
      description: sanitizeText(description, 200),
      currency,
      mainAdminId: account.id,
      coAdminIds: [],
      members: [adminMember],
      expectedContributionPerMember: 10000,
      isArchived: false,
    };

    const newSession = createAuthSession(newGroupId, account.id);

    const newActivity: ActivityItem = {
      id: generateSecureId('act'),
      groupId: newGroupId,
      type: 'settlement',
      title: 'Room Created',
      description:
        newGroup.initialFund > 0
          ? `${adminMember.name} created ${cleanName} with initial fund of ${newGroup.initialFund.toLocaleString()} ${currency}`
          : `${adminMember.name} created ${cleanName}`,
      amount: newGroup.initialFund,
      actorName: adminMember.name,
      date: 'Just now',
      timestamp: Date.now(),
    };

    setGroups((prev) => [newGroup, ...prev]);
    setActivities((prev) => [newActivity, ...prev]);
    setCurrentUserId(account.id);
    setAuthSessions((prev) => ({ ...pruneExpiredSessions(prev), [newGroupId]: newSession }));
    setActiveGroupId(newGroupId);

    return { success: true, group: newGroup };
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
    const cleanCode = sanitizeText(code, 20).toUpperCase();
    const rateCheck = checkJoinRateLimit(cleanCode);
    if (!rateCheck.allowed) {
      return {
        valid: false,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
        error: `Too many failed attempts. Please wait ${rateCheck.retryAfterSeconds}s before trying again.`,
      };
    }

    const formattedCode = cleanCode.startsWith('RS-') ? cleanCode : `RS-${cleanCode}`;
    const targetGroup = groups.find(
      (g) => g.code.toUpperCase() === formattedCode || g.code.toUpperCase() === cleanCode
    );

    if (!targetGroup) {
      const failState = recordFailedJoinAttempt(cleanCode);
      return {
        valid: false,
        retryAfterSeconds: failState.locked ? failState.retryAfterSeconds : undefined,
        error: failState.locked
          ? `Too many failed attempts. Please wait ${failState.retryAfterSeconds}s before trying again.`
          : 'Invalid room code or password. Please check and try again.',
      };
    }

    const isPassValid = await verifyGroupPassword(
      password,
      targetGroup.passwordHash,
      targetGroup.passwordSalt
    );

    if (!isPassValid) {
      const failState = recordFailedJoinAttempt(cleanCode);
      return {
        valid: false,
        retryAfterSeconds: failState.locked ? failState.retryAfterSeconds : undefined,
        error: failState.locked
          ? `Too many failed attempts. Please wait ${failState.retryAfterSeconds}s before trying again.`
          : 'Invalid room code or password. Please check and try again.',
      };
    }

    clearJoinRateLimit(cleanCode);

    const existingMember = userAccount
      ? targetGroup.members.find((m) => m.id === userAccount.id)
      : undefined;

    if (existingMember) {
      return { valid: true, group: targetGroup, member: existingMember, needsProfile: false };
    }

    return { valid: true, group: targetGroup, needsProfile: !userAccount };
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
    if (!claimActionLock(`join:${code.trim().toUpperCase()}`, 700)) {
      return { success: false, message: 'Please wait a moment before trying again.' };
    }

    const verification = await verifyGroupCredentials(code, password);
    if (!verification.valid || !verification.group) {
      return {
        success: false,
        message: verification.error || 'Invalid room code or password.',
        retryAfterSeconds: verification.retryAfterSeconds,
      };
    }

    const targetGroup = verification.group;

    let activeAccount = userAccount;
    if (!activeAccount && profile) {
      activeAccount = saveUserAccount(profile.name, profile.phone, profile.roomNumber);
    }

    if (!activeAccount) {
      return { success: false, message: 'Please create an account first to join the room.' };
    }

    // Strict identity match ONLY by authenticated userAccount.id (prevents display-name/phone takeover)
    const existing = targetGroup.members.find((m) => m.id === activeAccount!.id);
    const session = createAuthSession(targetGroup.id, activeAccount.id);

    if (existing) {
      setCurrentUserId(existing.id);
      setAuthSessions((prev) => ({ ...pruneExpiredSessions(prev), [targetGroup.id]: session }));
      setActiveGroupId(targetGroup.id);
      return { success: true, group: targetGroup };
    }

    const newMember: Member = {
      id: activeAccount.id,
      name: activeAccount.name,
      phone: activeAccount.phone,
      roomNumber: activeAccount.roomNumber,
      role: 'member',
    };

    const updatedGroup: Group = {
      ...targetGroup,
      members: [...targetGroup.members, newMember],
    };

    const newContrib: Contribution = {
      id: generateSecureId('contrib'),
      groupId: targetGroup.id,
      memberId: newMember.id,
      memberName: newMember.name,
      expectedAmount: targetGroup.expectedContributionPerMember || 10000,
      confirmedAmount: 0,
      status: 'pending',
    };

    const newAct: ActivityItem = {
      id: generateSecureId('act'),
      groupId: targetGroup.id,
      type: 'settlement',
      title: 'New Member Joined',
      description: `${newMember.name} (${newMember.roomNumber}) joined the room`,
      amount: 0,
      actorName: newMember.name,
      date: 'Just now',
      timestamp: Date.now(),
    };

    setGroups((prev) => prev.map((g) => (g.id === targetGroup.id ? updatedGroup : g)));
    setContributions((prev) => [...prev, newContrib]);
    setActivities((prev) => [newAct, ...prev]);
    setCurrentUserId(activeAccount.id);
    setAuthSessions((prev) => ({ ...pruneExpiredSessions(prev), [targetGroup.id]: session }));
    setActiveGroupId(targetGroup.id);

    return { success: true, group: updatedGroup };
  };

  const updateGroupSettings = async (
    data: GroupSettingsUpdateInput
  ): Promise<{ success: boolean; message?: string }> => {
    if (!activeGroup || !currentMember) {
      return { success: false, message: 'No active authorized group session.' };
    }

    let hashedPass;
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
      hashedPass = await hashGroupPassword(data.newPassword);
    }

    const result = applyGroupSettingsUpdate(activeGroup, currentMember, data, hashedPass);
    if (!result.valid) {
      return { success: false, message: result.message };
    }

    setGroups((prev) => prev.map((g) => (g.id === activeGroup.id ? result.data : g)));
    return { success: true };
  };

  const updateMemberProfile = (name: string, phone: string, roomNumber: string) => {
    const account = saveUserAccount(name, phone, roomNumber);

    setGroups((prev) =>
      prev.map((g) => {
        const hasMember = g.members.some((m) => m.id === account.id);
        if (!hasMember) return g;
        return {
          ...g,
          members: g.members.map((m) =>
            m.id === account.id
              ? { ...m, name: account.name, phone: account.phone, roomNumber: account.roomNumber }
              : m
          ),
        };
      })
    );

    setContributions((prev) =>
      prev.map((c) => (c.memberId === account.id ? { ...c, memberName: account.name } : c))
    );

    setFundRequests((prev) =>
      prev.map((r) => (r.memberId === account.id ? { ...r, memberName: account.name } : r))
    );
  };

  const addCoAdmin = (memberId: string): boolean => {
    const check = validateCoAdminChange(activeGroup, currentMember, memberId);
    if (!check.valid || !activeGroup) return false;

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== activeGroup.id) return g;
        const currentCoAdmins = g.coAdminIds || [];
        if (currentCoAdmins.includes(memberId)) return g;
        return {
          ...g,
          coAdminIds: [...currentCoAdmins, memberId],
          members: g.members.map((m) =>
            m.id === memberId && m.id !== g.mainAdminId ? { ...m, role: 'co_admin' } : m
          ),
        };
      })
    );
    return true;
  };

  const removeCoAdmin = (memberId: string): boolean => {
    const check = validateCoAdminChange(activeGroup, currentMember, memberId);
    if (!check.valid || !activeGroup) return false;

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== activeGroup.id) return g;
        return {
          ...g,
          coAdminIds: (g.coAdminIds || []).filter((id) => id !== memberId),
          members: g.members.map((m) =>
            m.id === memberId && m.id !== g.mainAdminId ? { ...m, role: 'member' } : m
          ),
        };
      })
    );
    return true;
  };

  const applyConfirmedContribution = (
    member: Member,
    amountReceived: number,
    reviewer: Member,
    notes?: string
  ) => {
    if (!activeGroup) return;
    const targetExpected = activeGroup.expectedContributionPerMember || 10000;

    setContributions((prev) => {
      const existing = prev.find((c) => c.groupId === activeGroup.id && c.memberId === member.id);
      if (existing) {
        const newConfirmedTotal = Math.round(((existing.confirmedAmount || 0) + amountReceived) * 100) / 100;
        const status =
          newConfirmedTotal >= existing.expectedAmount
            ? 'fully_paid'
            : newConfirmedTotal > 0
            ? 'partially_paid'
            : 'pending';

        return prev.map((c) =>
          c.id === existing.id
            ? {
                ...existing,
                confirmedAmount: newConfirmedTotal,
                status,
                confirmedByAdminId: reviewer.id,
                confirmedByAdminName: reviewer.name,
                confirmedAt: new Date().toISOString(),
                notes: notes || existing.notes,
              }
            : c
        );
      }

      const status =
        amountReceived >= targetExpected
          ? 'fully_paid'
          : amountReceived > 0
          ? 'partially_paid'
          : 'pending';

      return [
        ...prev,
        {
          id: generateSecureId('contrib'),
          groupId: activeGroup.id,
          memberId: member.id,
          memberName: member.name,
          expectedAmount: targetExpected,
          confirmedAmount: amountReceived,
          status,
          confirmedByAdminId: reviewer.id,
          confirmedByAdminName: reviewer.name,
          confirmedAt: new Date().toISOString(),
          notes,
        },
      ];
    });

    const roleTag = reviewer.role === 'main_admin' ? 'Admin' : 'Co-Admin';
    const todayDate = new Date().toISOString().split('T')[0];

    const newActivity: ActivityItem = {
      id: generateSecureId('act'),
      groupId: activeGroup.id,
      type: 'contribution',
      title: 'Fund Added',
      description: `${member.name} gave ${amountReceived.toLocaleString()} ${activeGroup.currency}${notes ? ` (${notes})` : ''}`,
      amount: amountReceived,
      actorName: member.name,
      targetName: `${reviewer.name} (${roleTag})`,
      date: todayDate,
      timestamp: Date.now(),
    };
    setActivities((prev) => [newActivity, ...prev]);
  };

  const confirmContribution = (
    memberId: string,
    amountReceived: number,
    notes?: string
  ): { success: boolean; message: string } => {
    const check = validateContributionPayload(
      activeGroup,
      currentMember,
      memberId,
      amountReceived,
      notes
    );
    if (!check.valid || !activeGroup || !currentMember) {
      return { success: false, message: check.valid ? 'Unauthorized.' : check.message };
    }

    if (!claimActionLock(`contrib:${activeGroup.id}:${memberId}:${check.data.amount}`, 700)) {
      return { success: false, message: 'Duplicate submission prevented. Please wait a moment.' };
    }

    applyConfirmedContribution(
      check.data.targetMember,
      check.data.amount,
      currentMember,
      check.data.cleanNotes
    );

    return {
      success: true,
      message: `Added ${check.data.amount.toLocaleString()} ${activeGroup.currency} from ${check.data.targetMember.name}!`,
    };
  };

  const requestFundContribution = (
    amount: number,
    notes?: string
  ): { success: boolean; message: string } => {
    if (!activeGroup || !currentMember) {
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
    const now = new Date();
    const newRequest: FundRequest = {
      id: generateSecureId('freq'),
      groupId: activeGroup.id,
      memberId: currentMember.id,
      memberName: currentMember.name,
      amount: amountCheck.value,
      notes: cleanNotes || undefined,
      status: 'pending',
      date: now.toISOString().split('T')[0],
      createdAt: now.toISOString(),
    };

    setFundRequests((prev) => [newRequest, ...prev]);

    return {
      success: true,
      message: `Submitted ${amountCheck.value.toLocaleString()} ${activeGroup.currency} request for Admin approval!`,
    };
  };

  const updateFundRequest = (
    requestId: string,
    amount: number,
    notes?: string
  ): { success: boolean; message: string } => {
    if (!activeGroup || !currentMember) {
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
    setFundRequests((prev) =>
      prev.map((r) =>
        r.id === requestId && r.groupId === activeGroup.id && r.status === 'pending'
          ? { ...r, amount: amountCheck.value, notes: cleanNotes || undefined }
          : r
      )
    );

    return {
      success: true,
      message: `Updated fund request to ${amountCheck.value.toLocaleString()} ${activeGroup.currency}.`,
    };
  };

  const cancelFundRequest = (requestId: string): { success: boolean; message: string } => {
    if (!activeGroup || !currentMember) {
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

    setFundRequests((prev) =>
      prev.filter((r) => !(r.id === requestId && r.groupId === activeGroup.id))
    );

    return { success: true, message: 'Cancelled pending fund request.' };
  };

  const reviewFundRequest = (
    requestId: string,
    decision: 'approved' | 'rejected'
  ): { success: boolean; message: string } => {
    const req = fundRequests.find((r) => r.id === requestId && r.groupId === activeGroup?.id);
    const check = validateFundRequestReview(activeGroup, currentMember, req, decision);
    if (!check.valid || !activeGroup || !currentMember) {
      return { success: false, message: check.valid ? 'Unauthorized.' : check.message };
    }

    if (!claimActionLock(`review:${requestId}`, 1000)) {
      return { success: false, message: 'This request is already being processed.' };
    }

    const nowIso = new Date().toISOString();
    setFundRequests((prev) =>
      prev.map((r) =>
        r.id === requestId && r.groupId === activeGroup.id && r.status === 'pending'
          ? {
              ...r,
              status: decision,
              reviewedByAdminId: currentMember.id,
              reviewedByAdminName: currentMember.name,
              reviewedAt: nowIso,
            }
          : r
      )
    );

    if (decision === 'approved') {
      applyConfirmedContribution(
        check.data.targetMember,
        check.data.request.amount,
        currentMember,
        check.data.request.notes
      );
      return {
        success: true,
        message: `Approved ${check.data.request.amount.toLocaleString()} ${activeGroup.currency} from ${check.data.targetMember.name}!`,
      };
    }

    return {
      success: true,
      message: `Declined ${check.data.targetMember.name}'s request (${check.data.request.amount.toLocaleString()} ${activeGroup.currency}).`,
    };
  };

  const addExpense = (
    expenseData: Omit<Expense, 'id' | 'groupId' | 'createdByMemberId' | 'createdByName' | 'createdAt'>
  ): { success: boolean; message: string } => {
    const check = validateExpensePayload(
      activeGroup,
      currentMember,
      financialSummary.remainingGroupFund,
      expenseData
    );
    if (!check.valid || !activeGroup || !currentMember) {
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

    const newExpense: Expense = {
      ...check.data,
      id: generateSecureId('exp'),
      groupId: activeGroup.id,
      createdByMemberId: currentMember.id,
      createdByName: currentMember.name,
      createdAt: new Date().toISOString(),
    };

    let descNote = '';
    if (newExpense.paymentSource === 'group_fund') {
      descNote = `Paid from group fund (${newExpense.amount.toLocaleString()} ${activeGroup.currency})`;
    } else if (newExpense.paymentSource === 'personal') {
      descNote = `Paid personally by ${newExpense.personalPayerName}`;
    } else {
      descNote = `Paid: ${newExpense.paidFromGroupFund.toLocaleString()} from group fund + ${newExpense.paidPersonally.toLocaleString()} by ${newExpense.personalPayerName}`;
    }

    const newActivity: ActivityItem = {
      id: generateSecureId('act'),
      groupId: activeGroup.id,
      type: 'shared_expense',
      title: newExpense.description,
      description: descNote,
      amount: newExpense.amount,
      actorName: newExpense.personalPayerName || currentMember.name,
      date: 'Just now',
      timestamp: Date.now(),
    };

    setExpenses((prev) => [newExpense, ...prev]);
    setActivities((prev) => [newActivity, ...prev]);

    return {
      success: true,
      message: `Saved: ${newExpense.description} (${newExpense.amount.toLocaleString()} ${activeGroup.currency})`,
    };
  };

  const recordLoan = (
    borrowerId: string,
    lenderId: string,
    amount: number,
    description: string,
    date: string
  ): { success: boolean; message: string } => {
    const check = validateLoanPayload(
      activeGroup,
      currentMember,
      borrowerId,
      lenderId,
      amount,
      description,
      date
    );
    if (!check.valid || !activeGroup) {
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

    const now = Date.now();
    const newLoan: PersonalLoan = {
      id: generateSecureId('loan'),
      groupId: activeGroup.id,
      borrowerId: check.data.borrower.id,
      borrowerName: check.data.borrower.name,
      lenderId: check.data.lender.id,
      lenderName: check.data.lender.name,
      originalAmount: check.data.amount,
      remainingAmount: check.data.amount,
      description: check.data.description,
      date: check.data.date,
      status: 'active',
      repayments: [],
    };

    const newActivity: ActivityItem = {
      id: generateSecureId('act'),
      groupId: activeGroup.id,
      type: 'personal_loan',
      title: 'Personal Loan',
      description: `${newLoan.borrowerName} borrowed ${check.data.amount.toLocaleString()} ${activeGroup.currency} from ${newLoan.lenderName}: ${check.data.description}`,
      amount: check.data.amount,
      actorName: newLoan.lenderName,
      targetName: newLoan.borrowerName,
      date: newLoan.date,
      timestamp: now,
    };

    setLoans((prev) => [newLoan, ...prev]);
    setActivities((prev) => [newActivity, ...prev]);

    return {
      success: true,
      message: `Recorded ${check.data.amount.toLocaleString()} ${activeGroup.currency} loan (${check.data.lender.name} → ${check.data.borrower.name}).`,
    };
  };

  const recordLoanRepayment = (
    loanId: string,
    amount: number,
    date: string,
    note?: string
  ): { success: boolean; message: string } => {
    const loan = loans.find((l) => l.id === loanId && l.groupId === activeGroup?.id);
    const check = validateLoanRepaymentPayload(activeGroup, currentMember, loan, amount, date, note);
    if (!check.valid || !activeGroup) {
      return { success: false, message: check.valid ? 'Unauthorized.' : check.message };
    }

    if (!claimActionLock(`repay:${loanId}:${check.data.repayAmount}`, 700)) {
      return { success: false, message: 'Duplicate repayment prevented. Please wait a moment.' };
    }

    const now = Date.now();
    const repaymentItem = {
      id: generateSecureId('repay'),
      loanId,
      amount: check.data.repayAmount,
      date: check.data.date,
      note: check.data.cleanNote,
      remainingAfter: check.data.newRemaining,
    };

    setLoans((prev) =>
      prev.map((l) => {
        if (l.id === loanId && l.groupId === activeGroup.id) {
          return {
            ...l,
            remainingAmount: check.data.newRemaining,
            status: check.data.isSettled ? 'settled' : 'partially_repaid',
            repayments: [repaymentItem, ...(l.repayments || [])],
          };
        }
        return l;
      })
    );

    const newActivity: ActivityItem = {
      id: generateSecureId('act'),
      groupId: activeGroup.id,
      type: 'loan_repayment',
      title: check.data.isSettled ? 'Personal Loan Fully Settled' : 'Partial Loan Repayment',
      description: `${check.data.loan.borrowerName} returned ${check.data.repayAmount.toLocaleString()} ${activeGroup.currency} to ${check.data.loan.lenderName}`,
      amount: check.data.repayAmount,
      actorName: check.data.loan.borrowerName,
      targetName: check.data.loan.lenderName,
      date: check.data.date,
      timestamp: now,
    };

    setActivities((prev) => [newActivity, ...prev]);

    return {
      success: true,
      message: check.data.isSettled
        ? `Loan fully settled (${check.data.repayAmount.toLocaleString()} ${activeGroup.currency})!`
        : `Repayment of ${check.data.repayAmount.toLocaleString()} ${activeGroup.currency} recorded!`,
    };
  };

  const recordSettlementTransfer = (
    fromMemberId: string,
    toMemberId: string,
    amount: number
  ): { success: boolean; message: string } => {
    const check = validateSettlementPayload(
      activeGroup,
      currentMember,
      financialSummary,
      fromMemberId,
      toMemberId,
      amount
    );
    if (!check.valid || !activeGroup) {
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

    const now = Date.now();
    const newTransfer: SettlementTransfer = {
      id: generateSecureId('transfer'),
      groupId: activeGroup.id,
      fromMemberId: check.data.fromMember.id,
      toMemberId: check.data.toMember.id,
      amount: check.data.amount,
      date: new Date().toISOString().split('T')[0],
      timestamp: now,
    };

    const newActivity: ActivityItem = {
      id: generateSecureId('act'),
      groupId: activeGroup.id,
      type: 'settlement',
      title: 'Peer Group Settlement Paid',
      description: `${check.data.fromMember.name} paid ${check.data.amount.toLocaleString()} ${activeGroup.currency} to ${check.data.toMember.name} to settle balance`,
      amount: check.data.amount,
      actorName: check.data.fromMember.name,
      targetName: check.data.toMember.name,
      date: 'Just now',
      timestamp: now,
    };

    setSettlementTransfers((prev) => [newTransfer, ...prev]);
    setActivities((prev) => [newActivity, ...prev]);

    return {
      success: true,
      message: `Recorded ${check.data.amount.toLocaleString()} ${activeGroup.currency} settlement.`,
    };
  };

  const resetToDefaultData = () => {
    setGroups(INITIAL_GROUPS);
    setActiveGroupId(null);
    setCurrentUserId(null);
    setUserAccount(null);
    setAuthSessions({});
    setContributions(INITIAL_CONTRIBUTIONS);
    setFundRequests([]);
    setExpenses(INITIAL_EXPENSES);
    setLoans(INITIAL_LOANS);
    setSettlementTransfers(INITIAL_SETTLEMENTS);
    setActivities(INITIAL_ACTIVITIES);
    try {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <RoomSplitContext.Provider
      value={{
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
