import {
  Expense,
  FundRequest,
  Group,
  GroupFinancialSummary,
  GroupSettingsUpdateInput,
  Member,
  PersonalLoan,
} from '../types';
import { areAllMembersInGroup } from '../services/securityArchitecture';
import {
  canAddExpense,
  canApproveFundRequests,
  canDirectAddFund,
  canEditGroupSettings,
  canManageCoAdmins,
  canMarkSettlementPaid,
  canRecordLoan,
  canRecordLoanRepayment,
} from '../utils/permissions';
import {
  PasswordHashResult,
  sanitizeText,
  validateFinancialAmount,
  validateIsoDate,
} from '../utils/security';

export type ValidationResult<T = undefined> =
  | { valid: true; data: T }
  | { valid: false; message: string };

export function validateContributionPayload(
  group: Group | null,
  currentMember: Member | null,
  targetMemberId: string,
  amountReceived: unknown,
  notes?: string
): ValidationResult<{ targetMember: Member; amount: number; cleanNotes?: string }> {
  if (!group || !currentMember) {
    return { valid: false, message: 'No active authorized group session.' };
  }
  if (!canDirectAddFund(currentMember)) {
    return {
      valid: false,
      message: 'Members cannot directly add funds. Please submit a fund request for Admin approval.',
    };
  }
  const amountCheck = validateFinancialAmount(amountReceived);
  if (!amountCheck.valid) {
    return { valid: false, message: amountCheck.error || 'Please enter a valid contribution amount.' };
  }
  const targetMember = group.members.find((m) => m.id === targetMemberId);
  if (!targetMember) {
    return { valid: false, message: 'Selected member does not belong to this group.' };
  }
  const cleanNotes = sanitizeText(notes || '', 200);
  return {
    valid: true,
    data: {
      targetMember,
      amount: amountCheck.value,
      cleanNotes: cleanNotes || undefined,
    },
  };
}

export function validateFundRequestReview(
  group: Group | null,
  currentMember: Member | null,
  request: FundRequest | undefined,
  decision: 'approved' | 'rejected'
): ValidationResult<{ request: FundRequest; targetMember: Member; decision: 'approved' | 'rejected' }> {
  if (!group || !currentMember) {
    return { valid: false, message: 'No active authorized group session.' };
  }
  if (!canApproveFundRequests(currentMember)) {
    return {
      valid: false,
      message: 'Permission denied: Only Main Admin or Co-Admin can approve fund requests.',
    };
  }
  if (!request || request.groupId !== group.id) {
    return { valid: false, message: 'Fund request not found in this group.' };
  }
  if (request.status !== 'pending') {
    return { valid: false, message: 'This request has already been reviewed.' };
  }
  const amountCheck = validateFinancialAmount(request.amount);
  if (!amountCheck.valid) {
    return { valid: false, message: 'Fund request contains an invalid amount.' };
  }
  const targetMember = group.members.find((m) => m.id === request.memberId);
  if (!targetMember) {
    return { valid: false, message: 'Requesting member is no longer in this group.' };
  }
  return {
    valid: true,
    data: { request, targetMember, decision },
  };
}

export function validateExpensePayload(
  group: Group | null,
  currentMember: Member | null,
  currentRemainingFund: number,
  expenseData: Omit<Expense, 'id' | 'groupId' | 'createdByMemberId' | 'createdByName' | 'createdAt'>
): ValidationResult<Omit<Expense, 'id' | 'groupId' | 'createdByMemberId' | 'createdByName' | 'createdAt'>> {
  if (!group || !currentMember) {
    return { valid: false, message: 'No active authorized group session.' };
  }
  if (!canAddExpense(currentMember)) {
    return { valid: false, message: 'Permission denied.' };
  }

  const totalCheck = validateFinancialAmount(expenseData.amount);
  if (!totalCheck.valid) {
    return { valid: false, message: totalCheck.error || 'Expense amount must be greater than zero.' };
  }

  const fundCheck = validateFinancialAmount(expenseData.paidFromGroupFund, { allowZero: true });
  const personalCheck = validateFinancialAmount(expenseData.paidPersonally, { allowZero: true });
  if (!fundCheck.valid || !personalCheck.valid) {
    return { valid: false, message: 'Payment amounts must be valid non-negative numbers.' };
  }

  const cleanDesc = sanitizeText(expenseData.description, 200);
  if (!cleanDesc) {
    return { valid: false, message: 'Please enter what the expense was for.' };
  }

  const uniqueSharedIds = Array.from(new Set(expenseData.sharedMemberIds || [])).filter(Boolean);
  if (uniqueSharedIds.length === 0 || !areAllMembersInGroup(group, uniqueSharedIds)) {
    return { valid: false, message: 'All shared participants must belong to this group.' };
  }

  let paidFromGroupFund = fundCheck.value;
  let paidPersonally = personalCheck.value;
  if (expenseData.paymentSource === 'group_fund') {
    paidFromGroupFund = totalCheck.value;
    paidPersonally = 0;
  } else if (expenseData.paymentSource === 'personal') {
    paidFromGroupFund = 0;
    paidPersonally = totalCheck.value;
  } else if (expenseData.paymentSource === 'split_group_personal') {
    if (Math.abs(paidFromGroupFund + paidPersonally - totalCheck.value) > 0.01) {
      return { valid: false, message: 'Fund portion plus personal portion must equal the total amount.' };
    }
  } else {
    return { valid: false, message: 'Invalid payment source.' };
  }

  let resolvedPayerId: string | undefined;
  let resolvedPayerName: string | undefined;
  if (expenseData.paymentSource !== 'group_fund' || paidPersonally > 0) {
    const payer = group.members.find((m) => m.id === expenseData.personalPayerId);
    if (!payer) {
      return { valid: false, message: 'Selected payer does not belong to this group.' };
    }
    resolvedPayerId = payer.id;
    resolvedPayerName = payer.name;
  }

  if (paidFromGroupFund > 0 && paidFromGroupFund > currentRemainingFund + 0.01) {
    return {
      valid: false,
      message: `Insufficient group funds: Remaining fund is only ${currentRemainingFund.toLocaleString()} ${group.currency}.`,
    };
  }

  return {
    valid: true,
    data: {
      amount: totalCheck.value,
      description: cleanDesc,
      date: validateIsoDate(expenseData.date),
      sharedMemberIds: uniqueSharedIds,
      paymentSource: expenseData.paymentSource,
      paidFromGroupFund,
      paidPersonally,
      personalPayerId: resolvedPayerId,
      personalPayerName: resolvedPayerName,
    },
  };
}

export function validateLoanPayload(
  group: Group | null,
  currentMember: Member | null,
  borrowerId: string,
  lenderId: string,
  amount: unknown,
  description: string,
  date: string
): ValidationResult<{
  borrower: Member;
  lender: Member;
  amount: number;
  description: string;
  date: string;
}> {
  if (!group || !currentMember) {
    return { valid: false, message: 'No active authorized group session.' };
  }
  if (!canRecordLoan(currentMember, borrowerId, lenderId)) {
    return {
      valid: false,
      message: 'Members can only record personal loans that involve themselves.',
    };
  }
  if (borrowerId === lenderId) {
    return { valid: false, message: 'Borrower and lender must be different roommates.' };
  }
  const borrower = group.members.find((m) => m.id === borrowerId);
  const lender = group.members.find((m) => m.id === lenderId);
  if (!borrower || !lender) {
    return { valid: false, message: 'Both borrower and lender must belong to this group.' };
  }
  const amountCheck = validateFinancialAmount(amount);
  if (!amountCheck.valid) {
    return { valid: false, message: amountCheck.error || 'Loan amount must be greater than zero.' };
  }
  const cleanDesc = sanitizeText(description, 200);
  if (!cleanDesc) {
    return { valid: false, message: 'Please provide a reason or item description.' };
  }
  return {
    valid: true,
    data: {
      borrower,
      lender,
      amount: amountCheck.value,
      description: cleanDesc,
      date: validateIsoDate(date),
    },
  };
}

export function validateLoanRepaymentPayload(
  group: Group | null,
  currentMember: Member | null,
  loan: PersonalLoan | undefined,
  amount: unknown,
  date: string,
  note?: string
): ValidationResult<{
  loan: PersonalLoan;
  repayAmount: number;
  newRemaining: number;
  isSettled: boolean;
  date: string;
  cleanNote: string;
}> {
  if (!group || !currentMember) {
    return { valid: false, message: 'No active authorized group session.' };
  }
  if (!loan || loan.groupId !== group.id) {
    return { valid: false, message: 'Loan contract not found in this group.' };
  }
  if (!canRecordLoanRepayment(currentMember, loan)) {
    return {
      valid: false,
      message: 'Only the lender or an Admin/Co-Admin can confirm a loan repayment.',
    };
  }
  if (loan.status === 'settled' || loan.remainingAmount <= 0) {
    return { valid: false, message: 'This loan has already been fully settled.' };
  }
  const amountCheck = validateFinancialAmount(amount);
  if (!amountCheck.valid) {
    return { valid: false, message: amountCheck.error || 'Repayment amount must be greater than zero.' };
  }
  if (amountCheck.value > loan.remainingAmount + 0.005) {
    return {
      valid: false,
      message: `Amount exceeds remaining debt (${loan.remainingAmount.toLocaleString()} ${group.currency}).`,
    };
  }
  const rawRemaining = Math.round((loan.remainingAmount - amountCheck.value) * 100) / 100;
  const newRemaining = rawRemaining < 0.01 ? 0 : rawRemaining;
  const cleanNote = sanitizeText(note || '', 200) || 'Cash repayment';
  return {
    valid: true,
    data: {
      loan,
      repayAmount: amountCheck.value,
      newRemaining,
      isSettled: newRemaining === 0,
      date: validateIsoDate(date),
      cleanNote,
    },
  };
}

export function validateSettlementPayload(
  group: Group | null,
  currentMember: Member | null,
  financialSummary: GroupFinancialSummary,
  fromMemberId: string,
  toMemberId: string,
  amount: unknown
): ValidationResult<{ fromMember: Member; toMember: Member; amount: number }> {
  if (!group || !currentMember) {
    return { valid: false, message: 'No active authorized group session.' };
  }
  if (!canMarkSettlementPaid(currentMember, toMemberId)) {
    return {
      valid: false,
      message: 'Only the receiving member or an Admin/Co-Admin can mark this settlement as paid.',
    };
  }
  if (fromMemberId === toMemberId) {
    return { valid: false, message: 'Payer and receiver must be different members.' };
  }
  const fromMember = group.members.find((m) => m.id === fromMemberId);
  const toMember = group.members.find((m) => m.id === toMemberId);
  if (!fromMember || !toMember) {
    return { valid: false, message: 'Both members must belong to this group.' };
  }
  const amountCheck = validateFinancialAmount(amount);
  if (!amountCheck.valid) {
    return { valid: false, message: 'Invalid settlement amount.' };
  }

  const fromStat = financialSummary.memberStats[fromMemberId];
  const toStat = financialSummary.memberStats[toMemberId];
  if (!fromStat || !toStat || fromStat.currentBalance >= -0.5 || toStat.currentBalance <= 0.5) {
    return { valid: false, message: 'No pending settlement balance exists between these members.' };
  }
  if (
    amountCheck.value > Math.abs(fromStat.currentBalance) + 1 ||
    amountCheck.value > toStat.currentBalance + 1
  ) {
    return { valid: false, message: 'Settlement amount exceeds the current net balance due.' };
  }

  return {
    valid: true,
    data: { fromMember, toMember, amount: amountCheck.value },
  };
}

export function validateCoAdminChange(
  group: Group | null,
  currentMember: Member | null,
  targetMemberId: string
): ValidationResult<{ targetMember: Member }> {
  if (!group || !currentMember) {
    return { valid: false, message: 'No active authorized group session.' };
  }
  if (!canManageCoAdmins(currentMember)) {
    return { valid: false, message: 'Only the Main Admin can manage Co-Admin roles.' };
  }
  if (targetMemberId === group.mainAdminId) {
    return { valid: false, message: 'Main Admin role cannot be modified.' };
  }
  const targetMember = group.members.find((m) => m.id === targetMemberId);
  if (!targetMember) {
    return { valid: false, message: 'Member does not belong to this group.' };
  }
  return { valid: true, data: { targetMember } };
}

export function applyGroupSettingsUpdate(
  group: Group,
  currentMember: Member | null,
  input: GroupSettingsUpdateInput,
  hashedPassword?: PasswordHashResult
): ValidationResult<Group> {
  if (!canEditGroupSettings(currentMember)) {
    return { valid: false, message: 'Only the Main Admin can update group settings.' };
  }

  const nextName = input.name !== undefined ? sanitizeText(input.name, 80) : group.name;
  if (!nextName) {
    return { valid: false, message: 'Group name cannot be empty.' };
  }

  const nextDescription =
    input.description !== undefined ? sanitizeText(input.description, 200) : group.description;

  let nextExpected = group.expectedContributionPerMember;
  if (input.expectedContributionPerMember !== undefined) {
    const check = validateFinancialAmount(input.expectedContributionPerMember, { allowZero: true });
    if (!check.valid) {
      return { valid: false, message: 'Expected contribution must be a valid non-negative number.' };
    }
    nextExpected = check.value;
  }

  const updated: Group = {
    ...group,
    name: nextName,
    description: nextDescription,
    expectedContributionPerMember: nextExpected,
    ...(hashedPassword
      ? {
          passwordHash: hashedPassword.hash,
          passwordSalt: hashedPassword.salt,
          passwordAlgorithm: hashedPassword.algorithm,
        }
      : {}),
  };

  return { valid: true, data: updated };
}
