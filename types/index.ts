export type MemberRole = 'main_admin' | 'co_admin' | 'member';

export interface Member {
  id: string;
  name: string;
  phone: string;
  roomNumber: string;
  role: MemberRole;
}

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  roomNumber: string;
  createdAt: string;
}

export interface AuthSession {
  groupId: string;
  memberId: string;
  token: string;
  issuedAt: number;
  expiresAt: number;
}

export interface GroupSettingsUpdateInput {
  name?: string;
  description?: string;
  newPassword?: string;
  expectedContributionPerMember?: number;
}

export interface Group {
  id: string;
  name: string;
  code: string; // e.g. RS-7K9M2P
  passwordHash?: string;
  passwordSalt?: string;
  passwordAlgorithm?: 'PBKDF2-SHA256';
  initialFund: number; // e.g. 50000 IQD
  description?: string;
  campus?: string;
  currency: 'IQD' | 'USD' | 'EUR';
  mainAdminId: string;
  coAdminIds: string[];
  members: Member[];
  expectedContributionPerMember?: number; // e.g. 10000 IQD
  isArchived?: boolean;
}

export type ContributionStatus = 'pending' | 'partially_paid' | 'fully_paid';

export interface Contribution {
  id: string;
  groupId: string;
  memberId: string;
  memberName: string;
  expectedAmount: number;
  confirmedAmount: number;
  status: ContributionStatus;
  confirmedByAdminId?: string;
  confirmedByAdminName?: string;
  confirmedAt?: string;
  notes?: string;
}

export type FundRequestStatus = 'pending' | 'approved' | 'rejected';

export interface FundRequest {
  id: string;
  groupId: string;
  memberId: string;
  memberName: string;
  amount: number;
  notes?: string;
  status: FundRequestStatus;
  date: string;
  createdAt: string;
  reviewedByAdminId?: string;
  reviewedByAdminName?: string;
  reviewedAt?: string;
}

export type PaymentSourceType = 'group_fund' | 'personal' | 'split_group_personal';

export interface Expense {
  id: string;
  groupId: string;
  amount: number;
  description: string;
  date: string;
  sharedMemberIds: string[]; // members who share this expense
  paymentSource: PaymentSourceType;
  paidFromGroupFund: number;
  personalPayerId?: string;
  personalPayerName?: string;
  paidPersonally: number;
  createdByMemberId: string;
  createdByName: string;
  createdAt: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number;
  date: string;
  note?: string;
  remainingAfter: number;
}

export interface PersonalLoan {
  id: string;
  groupId: string;
  borrowerId: string;
  borrowerName: string;
  lenderId: string;
  lenderName: string;
  originalAmount: number;
  remainingAmount: number;
  description: string;
  date: string;
  status: 'active' | 'partially_repaid' | 'settled';
  repayments: LoanRepayment[];
}

export type ActivityType = 'contribution' | 'shared_expense' | 'personal_loan' | 'loan_repayment' | 'settlement';

export interface ActivityItem {
  id: string;
  groupId: string;
  type: ActivityType;
  title: string;
  description: string;
  amount: number;
  actorName: string;
  targetName?: string;
  date: string;
  timestamp: number;
}

export interface MemberFinancialStats {
  member: Member;
  totalContribution: number;
  personalPayments: number;
  fairShare: number;
  currentBalance: number; // positive = should receive; negative = owes; 0 = settled
  status: 'receive' | 'owes' | 'settled';
}

export interface SimplifiedSettlement {
  id: string;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
}

export interface SettlementTransfer {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
  timestamp: number;
}

export interface GroupFinancialSummary {
  initialFund: number;
  totalContributions: number;
  totalInitialAndCollected: number;
  totalExpenses: number;
  totalPaidFromGroupFund: number;
  totalPaidPersonally: number;
  remainingGroupFund: number;
  memberStats: Record<string, MemberFinancialStats>;
  settlements: SimplifiedSettlement[];
  totalOwed: number;
  totalReceivable: number;
  activeLoanDebt: number;
}

export interface MemberLoanSummary {
  member: Member;
  lentOutOriginal: number;
  lentOutRepaid: number;
  lentOutRemaining: number;
  borrowedOriginal: number;
  borrowedRepaid: number;
  borrowedRemaining: number;
  netLoanBalance: number; // positive = owed to member, negative = member owes others
}

export interface PairwiseLoanBalance {
  id: string;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number;
}

export interface GroupLoanSummary {
  totalIssued: number;
  totalRepaid: number;
  totalActiveDebt: number;
  activeCount: number;
  settledCount: number;
  memberLoanStats: Record<string, MemberLoanSummary>;
  pairwiseBalances: PairwiseLoanBalance[];
}
