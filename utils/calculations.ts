import {
  Group,
  Contribution,
  Expense,
  PersonalLoan,
  SettlementTransfer,
  MemberFinancialStats,
  SimplifiedSettlement,
  GroupFinancialSummary,
  MemberLoanSummary,
  PairwiseLoanBalance,
  GroupLoanSummary,
} from '../types';

/**
 * Calculates each member's allocated share of shared expenses.
 * If an expense is shared by specific members, only those members bear the cost equally.
 */
export function calculateMemberExpenseShare(memberId: string, expenses: Expense[]): number {
  return expenses.reduce((totalShare, expense) => {
    if (!expense.sharedMemberIds || expense.sharedMemberIds.length === 0) {
      return totalShare;
    }
    if (expense.sharedMemberIds.includes(memberId)) {
      const splitAmount = expense.amount / expense.sharedMemberIds.length;
      return totalShare + splitAmount;
    }
    return totalShare;
  }, 0);
}

/**
 * Calculates total personal payments made by a specific member for shared expenses.
 */
export function calculateMemberPersonalPayments(memberId: string, expenses: Expense[]): number {
  return expenses.reduce((totalPaid, expense) => {
    if (expense.personalPayerId === memberId && expense.paidPersonally > 0) {
      return totalPaid + expense.paidPersonally;
    }
    return totalPaid;
  }, 0);
}

/**
 * Calculates total confirmed contributions made by a member to the group fund.
 */
export function calculateMemberConfirmedContributions(
  memberId: string,
  contributions: Contribution[]
): number {
  return contributions
    .filter((c) => c.memberId === memberId)
    .reduce((sum, c) => sum + (c.confirmedAmount || 0), 0);
}

/**
 * Precision calculation for a member's net balance:
 * Formula: Confirmed contributions + Personal payments for shared expenses - Member's fair share of shared expenses.
 * Positive = member should receive money.
 * Negative = member owes money.
 * Zero = member is balanced.
 */
export function calculateMemberBalance(
  memberId: string,
  contributions: Contribution[],
  expenses: Expense[]
): number {
  const confirmedContributions = calculateMemberConfirmedContributions(memberId, contributions);
  const personalPayments = calculateMemberPersonalPayments(memberId, expenses);
  const fairShare = calculateMemberExpenseShare(memberId, expenses);

  return confirmedContributions + personalPayments - fairShare;
}

/**
 * Group fund balance:
 * Formula: Total confirmed contributions - Total expenses paid from group fund.
 * Note: Does not count personal payments as group fund expenditure.
 */
export function calculateGroupFundBalance(
  contributions: Contribution[],
  expenses: Expense[]
): number {
  const totalConfirmed = contributions.reduce((sum, c) => sum + (c.confirmedAmount || 0), 0);
  const totalPaidFromFund = expenses.reduce((sum, e) => sum + (e.paidFromGroupFund || 0), 0);
  return totalConfirmed - totalPaidFromFund;
}

/**
 * Simplest settlement algorithm minimizing peer-to-peer transfers.
 * Total owed always matches total receivable.
 */
export function calculateSimplifiedSettlements(
  memberStats: Record<string, MemberFinancialStats>
): SimplifiedSettlement[] {
  // Separate into debtors (< 0) and creditors (> 0)
  const debtors: { memberId: string; name: string; amountOwed: number }[] = [];
  const creditors: { memberId: string; name: string; amountReceivable: number }[] = [];

  Object.values(memberStats).forEach((stats) => {
    const net = Math.round(stats.currentBalance * 100) / 100;
    if (net < -0.5) {
      debtors.push({
        memberId: stats.member.id,
        name: stats.member.name,
        amountOwed: Math.abs(net),
      });
    } else if (net > 0.5) {
      creditors.push({
        memberId: stats.member.id,
        name: stats.member.name,
        amountReceivable: net,
      });
    }
  });

  const settlements: SimplifiedSettlement[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.amountOwed, creditor.amountReceivable);
    const roundedSettle = Math.round(settleAmount * 100) / 100;

    if (roundedSettle >= 0.5) {
      settlements.push({
        id: `settle-${debtor.memberId}-${creditor.memberId}-${settlements.length}`,
        fromMemberId: debtor.memberId,
        fromMemberName: debtor.name,
        toMemberId: creditor.memberId,
        toMemberName: creditor.name,
        amount: Math.round(roundedSettle),
      });
    }

    debtor.amountOwed -= settleAmount;
    creditor.amountReceivable -= settleAmount;

    if (debtor.amountOwed <= 0.5) {
      dIdx++;
    }
    if (creditor.amountReceivable <= 0.5) {
      cIdx++;
    }
  }

  return settlements;
}

export const EMPTY_FINANCIAL_SUMMARY: GroupFinancialSummary = {
  initialFund: 0,
  totalContributions: 0,
  totalInitialAndCollected: 0,
  totalExpenses: 0,
  totalPaidFromGroupFund: 0,
  totalPaidPersonally: 0,
  remainingGroupFund: 0,
  memberStats: {},
  settlements: [],
  totalOwed: 0,
  totalReceivable: 0,
  activeLoanDebt: 0,
};

/**
 * Produces comprehensive group financial report and individual stats.
 */
export function calculateGroupFinancialSummary(
  group: Group | null | undefined,
  contributions: Contribution[],
  expenses: Expense[],
  loans: PersonalLoan[],
  settlementTransfers: SettlementTransfer[] = []
): GroupFinancialSummary {
  if (!group || !group.members) {
    return EMPTY_FINANCIAL_SUMMARY;
  }
  const groupContributions = contributions.filter((c) => c.groupId === group.id);
  const groupExpenses = expenses.filter((e) => e.groupId === group.id);
  const groupLoans = loans.filter((l) => l.groupId === group.id);
  const groupTransfers = settlementTransfers.filter((t) => t.groupId === group.id);

  const initialFund = group.initialFund || 0;
  const totalContributions = groupContributions.reduce(
    (sum, c) => sum + (c.confirmedAmount || 0),
    0
  );
  const totalInitialAndCollected = initialFund + totalContributions;
  const totalExpenses = groupExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPaidFromGroupFund = groupExpenses.reduce(
    (sum, e) => sum + (e.paidFromGroupFund || 0),
    0
  );
  const totalPaidPersonally = groupExpenses.reduce(
    (sum, e) => sum + (e.paidPersonally || 0),
    0
  );
  const remainingGroupFund = totalInitialAndCollected - totalPaidFromGroupFund;

  const memberStats: Record<string, MemberFinancialStats> = {};

  group.members.forEach((member) => {
    const totalContribution = calculateMemberConfirmedContributions(
      member.id,
      groupContributions
    );
    const personalPayments = calculateMemberPersonalPayments(member.id, groupExpenses);
    const fairShare = calculateMemberExpenseShare(member.id, groupExpenses);
    const sentSettlements = groupTransfers
      .filter((t) => t.fromMemberId === member.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const receivedSettlements = groupTransfers
      .filter((t) => t.toMemberId === member.id)
      .reduce((sum, t) => sum + t.amount, 0);

    const rawBalance =
      totalContribution + personalPayments - fairShare + sentSettlements - receivedSettlements;

    let status: 'receive' | 'owes' | 'settled' = 'settled';
    if (rawBalance > 0.5) status = 'receive';
    else if (rawBalance < -0.5) status = 'owes';

    memberStats[member.id] = {
      member,
      totalContribution,
      personalPayments,
      fairShare: Math.round(fairShare),
      currentBalance: Math.abs(rawBalance) < 0.5 ? 0 : Math.round(rawBalance),
      status,
    };
  });

  const settlements = calculateSimplifiedSettlements(memberStats);

  const totalOwed = settlements.reduce((sum, s) => sum + s.amount, 0);
  const totalReceivable = totalOwed; // Always mathematically balanced

  const activeLoanDebt = groupLoans
    .filter((l) => l.status !== 'settled')
    .reduce((sum, l) => sum + l.remainingAmount, 0);

  return {
    initialFund,
    totalContributions,
    totalInitialAndCollected,
    totalExpenses,
    totalPaidFromGroupFund,
    totalPaidPersonally,
    remainingGroupFund,
    memberStats,
    settlements,
    totalOwed,
    totalReceivable,
    activeLoanDebt,
  };
}

export const EMPTY_LOAN_SUMMARY: GroupLoanSummary = {
  totalIssued: 0,
  totalRepaid: 0,
  totalActiveDebt: 0,
  activeCount: 0,
  settledCount: 0,
  memberLoanStats: {},
  pairwiseBalances: [],
};

/**
 * Computes exact personal loan statistics for the group and every member,
 * including pairwise net balances between each pair of roommates.
 * Strictly isolated from group fund and shared expenses.
 */
export function calculateGroupLoanSummary(
  group: Group | null | undefined,
  loans: PersonalLoan[]
): GroupLoanSummary {
  if (!group || !group.members) {
    return EMPTY_LOAN_SUMMARY;
  }

  const groupLoans = loans.filter((l) => l.groupId === group.id);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  let totalIssued = 0;
  let totalActiveDebt = 0;
  let activeCount = 0;
  let settledCount = 0;

  groupLoans.forEach((loan) => {
    totalIssued += loan.originalAmount || 0;
    const rem = Math.max(0, loan.remainingAmount || 0);
    if (loan.status === 'settled' || rem < 0.01) {
      settledCount += 1;
    } else {
      activeCount += 1;
      totalActiveDebt += rem;
    }
  });

  totalIssued = round2(totalIssued);
  totalActiveDebt = round2(totalActiveDebt);
  const totalRepaid = round2(Math.max(0, totalIssued - totalActiveDebt));

  const memberLoanStats: Record<string, MemberLoanSummary> = {};

  group.members.forEach((member) => {
    const lentLoans = groupLoans.filter((l) => l.lenderId === member.id);
    const borrowedLoans = groupLoans.filter((l) => l.borrowerId === member.id);

    const lentOutOriginal = round2(
      lentLoans.reduce((sum, l) => sum + (l.originalAmount || 0), 0)
    );
    const lentOutRemaining = round2(
      lentLoans
        .filter((l) => l.status !== 'settled')
        .reduce((sum, l) => sum + Math.max(0, l.remainingAmount || 0), 0)
    );
    const lentOutRepaid = round2(Math.max(0, lentOutOriginal - lentOutRemaining));

    const borrowedOriginal = round2(
      borrowedLoans.reduce((sum, l) => sum + (l.originalAmount || 0), 0)
    );
    const borrowedRemaining = round2(
      borrowedLoans
        .filter((l) => l.status !== 'settled')
        .reduce((sum, l) => sum + Math.max(0, l.remainingAmount || 0), 0)
    );
    const borrowedRepaid = round2(Math.max(0, borrowedOriginal - borrowedRemaining));

    const netLoanBalance = round2(lentOutRemaining - borrowedRemaining);

    memberLoanStats[member.id] = {
      member,
      lentOutOriginal,
      lentOutRepaid,
      lentOutRemaining,
      borrowedOriginal,
      borrowedRepaid,
      borrowedRemaining,
      netLoanBalance,
    };
  });

  // Compute pairwise net debt between every pair of members
  const pairMap = new Map<string, number>();
  groupLoans.forEach((loan) => {
    const rem = loan.status === 'settled' ? 0 : Math.max(0, loan.remainingAmount || 0);
    if (rem < 0.01 || loan.borrowerId === loan.lenderId) return;

    const [idA, idB] =
      loan.borrowerId < loan.lenderId
        ? [loan.borrowerId, loan.lenderId]
        : [loan.lenderId, loan.borrowerId];
    const key = `${idA}::${idB}`;
    // Positive value means idA owes idB; negative means idB owes idA
    const sign = loan.borrowerId === idA ? 1 : -1;
    pairMap.set(key, (pairMap.get(key) || 0) + sign * rem);
  });

  const pairwiseBalances: PairwiseLoanBalance[] = [];
  pairMap.forEach((netVal, key) => {
    const rounded = round2(netVal);
    if (Math.abs(rounded) < 0.01) return;
    const [idA, idB] = key.split('::');
    const fromId = rounded > 0 ? idA : idB;
    const toId = rounded > 0 ? idB : idA;
    const fromMember = group.members.find((m) => m.id === fromId);
    const toMember = group.members.find((m) => m.id === toId);

    pairwiseBalances.push({
      id: `pair-${fromId}-${toId}`,
      fromMemberId: fromId,
      fromMemberName: fromMember?.name || 'Roommate',
      toMemberId: toId,
      toMemberName: toMember?.name || 'Roommate',
      amount: Math.abs(rounded),
    });
  });

  return {
    totalIssued,
    totalRepaid,
    totalActiveDebt,
    activeCount,
    settledCount,
    memberLoanStats,
    pairwiseBalances,
  };
}

/**
 * Formats currency values cleanly with standard Iraqi Dinar or selected currency symbol
 */
export function formatCurrency(amount: number, currency: string = 'IQD'): string {
  const formatted = Math.round(amount).toLocaleString('en-US');
  return `${formatted} ${currency}`;
}
