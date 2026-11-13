import { Member, PersonalLoan } from '../types';

export function isMainAdmin(member?: Member | null): boolean {
  return member?.role === 'main_admin';
}

export function isCoAdmin(member?: Member | null): boolean {
  return member?.role === 'co_admin';
}

export function isAdminOrCoAdmin(member?: Member | null): boolean {
  return member?.role === 'main_admin' || member?.role === 'co_admin';
}

/** Only Main Admin can edit group name, password, description, or manage Co-Admins. */
export function canEditGroupSettings(member?: Member | null): boolean {
  return isMainAdmin(member);
}

/** Only Main Admin can appoint or remove Co-Admins. */
export function canManageCoAdmins(member?: Member | null): boolean {
  return isMainAdmin(member);
}

/** Only Admin or Co-Admin can directly add/confirm funds into the group balance. */
export function canDirectAddFund(member?: Member | null): boolean {
  return isAdminOrCoAdmin(member);
}

/** Only Admin or Co-Admin can approve or reject member fund requests. */
export function canApproveFundRequests(member?: Member | null): boolean {
  return isAdminOrCoAdmin(member);
}

/** Regular members can submit and modify pending fund requests for themselves (awaiting approval). */
export function canRequestFund(member?: Member | null): boolean {
  return Boolean(member);
}

/** Any group member can log a shared expense. */
export function canAddExpense(member?: Member | null): boolean {
  return Boolean(member);
}

/**
 * Admin / Co-Admin can record any 1-on-1 loan.
 * Regular members can only record loans where they are the borrower or lender.
 */
export function canRecordLoan(
  member: Member | null | undefined,
  borrowerId: string,
  lenderId: string
): boolean {
  if (!member) return false;
  if (isAdminOrCoAdmin(member)) return true;
  return member.id === borrowerId || member.id === lenderId;
}

/**
 * Only Admin, Co-Admin, or the Lender who gave the money can confirm loan repayments.
 */
export function canRecordLoanRepayment(
  member: Member | null | undefined,
  loan: Pick<PersonalLoan, 'lenderId' | 'borrowerId'>
): boolean {
  if (!member) return false;
  if (isAdminOrCoAdmin(member)) return true;
  return member.id === loan.lenderId;
}

/**
 * Only Admin, Co-Admin, or the Creditor receiving payment can mark a peer settlement as paid.
 */
export function canMarkSettlementPaid(
  member: Member | null | undefined,
  toMemberId: string
): boolean {
  if (!member) return false;
  if (isAdminOrCoAdmin(member)) return true;
  return member.id === toMemberId;
}
