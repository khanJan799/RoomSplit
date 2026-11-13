import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'ar';

const LANGUAGE_STORAGE_KEY = 'roomsplit_language_v4';

export interface Translations {
  appName: string;
  appSubtitle: string;
  footerCredit: string;
  footerCreditFull: string;
  languageName: string;
  switchToLang: string;
  languageLabel: string;
  english: string;
  arabic: string;

  // First visit & Welcome
  firstTimeSetup: string;
  stepOneOfOne: string;
  createYourAccount: string;
  createAccountDesc: string;
  yourFullName: string;
  fullNamePlaceholder: string;
  phoneNumber: string;
  roomNumber: string;
  roomPlaceholder: string;
  createAccountContinue: string;
  accountFieldsError: string;
  welcomeAccountReady: (name: string) => string;
  edit: string;
  joinAGroup: string;
  joinGroupHint: (name: string) => string;
  createAGroup: string;
  createGroupHint: string;
  savedRoomsOnDevice: string;
  roomCount: (n: number) => string;
  codeLabel: string;
  enter: string;
  roomAccess: string;
  joinAGroupTitle: string;
  joiningAs: string;
  verified: string;
  groupCode: string;
  groupCodeHint: string;
  groupPassword: string;
  enterGroupPassword: string;
  joinRoomEnter: string;
  newRoom: string;
  createAGroupTitle: string;
  mainAdminCreator: string;
  adminBadge: string;
  coAdminBadge: string;
  memberRoleLabel: string;
  groupName: string;
  groupNamePlaceholder: string;
  passwordForRoommates: string;
  currency: string;
  currencyIQD: string;
  currencyUSD: string;
  currencyEUR: string;
  createGroupNote: string;
  createGroupOpen: string;
  studentAccount: string;
  yourAccountProfile: string;
  signOut: string;
  saveChanges: string;
  accountUpdated: string;
  signedOut: string;
  enterRoomCodeError: string;
  createAccountFirstError: string;
  enterGroupNameError: string;
  setGroupPasswordError: string;

  // Navigation & Header
  tabOverview: string;
  tabExpenses: string;
  tabFund: string;
  tabLoans: string;
  tabSettle: string;
  switchDormRoom: string;
  returnToHome: string;
  recordTransaction: string;
  addSharedExpense: string;
  roomBadge: string;
  equalSplitDesc: string;
  addToGroupFund: string;
  adminOrCoAdminBadge: string;
  verifyCashDesc: string;
  recordPersonalLoan: string;
  oneOnOneBadge: string;
  privateLoanDesc: string;
  settleUpBalances: string;
  settleDesc: string;

  // Overview
  active: string;
  roomCodePrefix: string;
  yourRole: string;
  mainAdminLabel: string;
  coAdminLabel: string;
  roommateMemberLabel: string;
  remainingGroupBalance: string;
  liveBalance: string;
  collectedMinusSpent: string;
  collected: string;
  totalSpent: string;
  addExpense: string;
  recentPurchases: string;
  viewAll: (n: number) => string;
  noPurchasesYet: string;
  purchasedBy: string;
  groupFundSource: string;
  personalPaidSource: string;
  groupMembers: string;
  shareCodeToJoin: (code: string) => string;
  youBadge: string;
  given: string;
  recordFund: string;
  adminAuthorityOnly: string;
  recordMoneyReceived: string;
  recordingFundAs: (name: string, role: string) => string;
  selectRoommateGaveMoney: string;
  amountGivenBy: (name: string) => string;
  notes: string;
  confirmAddToFund: string;

  // Quick Add Expense
  quickEntry: string;
  whatDidYouBuy: string;
  whatBoughtPlaceholder: string;
  howMuchCost: string;
  purchasedByLabel: string;
  dateLabel: string;
  paidUsingGroupMoney: string;
  subtractFromFund: (bal: string) => string;
  saveExpense: string;

  // Expenses Tab
  sharedSpend: string;
  activeCycle: string;
  splitAcrossMembers: (n: number) => string;
  youPaid: string;
  yourShare: string;
  netPoolDue: string;
  sharedLedger: string;
  itemsInRoom: (n: number, room: string) => string;
  noSharedExpensesYet: string;
  tapAddExpenseHint: (room: string) => string;
  sharedTag: string;
  paidBy: (name: string) => string;
  splitWaysPerEa: (n: number, amt: string) => string;
  newSharedExpense: string;
  totalSpentAmount: string;
  perPersonSummary: (amt: string, n: number) => string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  paymentSourceLabel: string;
  fundRemainingShort: (amt: string) => string;
  groupFundTab: string;
  personalTab: string;
  bothMixTab: string;
  whoPaidPersonally: string;
  fromGroupFund: string;
  personalOutOfPocket: string;
  payerForRemainder: string;
  splitAmong: string;
  allCount: (n: number) => string;
  custom: string;
  excluded: string;
  sharePrefix: (amt: string) => string;
  mixedPay: string;
  backSuffix: (amt: string) => string;
  dueSuffix: (amt: string) => string;

  // Fund Tab
  totalCollected: string;
  fromMembersCount: (n: number) => string;
  remainingFund: string;
  spentFromFund: (amt: string) => string;
  authorizedAddFund: string;
  viewOnlyFund: string;
  addFund: string;
  membersFundSummary: string;
  lastAddedBy: (name: string) => string;
  totalGiven: string;
  addShort: string;
  fundGivenHistory: string;
  entriesCount: (n: number) => string;
  noFundsAddedYet: string;
  tapAddFundHint: string;
  givenByName: (name: string) => string;
  addedByName: (name: string) => string;
  whoGaveMoney: string;
  noteOptional: string;
  noteCashPlaceholder: string;

  // Loans Tab
  lentOut: string;
  youOwe: string;
  owedToYou: string;
  privateOneOnOneDebt: string;
  returnedProgress: (repaid: string, orig: string) => string;
  paidBackProgress: (repaid: string, orig: string) => string;
  yourNetLoanPosition: string;
  netOwedToYou: string;
  netYouOwe: string;
  allPersonalLoansBalanced: string;
  newLoan: string;
  netOneOnOneBalances: string;
  activeDebtLabel: (amt: string) => string;
  owesWord: string;
  loanContracts: (activeCount: number) => string;
  filterAll: string;
  filterActive: string;
  filterSettled: string;
  noPersonalLoans: string;
  noFilteredLoans: (filter: string) => string;
  tapNewLoanHint: string;
  settledAgreement: string;
  activeAgreement: string;
  settled100: string;
  pctPaid: (pct: number) => string;
  remaining: string;
  original: string;
  returnedWord: string;
  leftWord: string;
  recordRepayment: string;
  loanAuditLedger: string;
  repaidTotalLabel: (amt: string) => string;
  noLoanTransactions: string;
  loanAgreementTitle: string;
  fullRepaymentTitle: string;
  partialRepaymentTitle: string;
  borrowedFrom: (b: string, l: string, desc: string) => string;
  returnedTo: (b: string, l: string, note?: string) => string;
  originalLabel: (amt: string) => string;
  leftLabel: (amt: string) => string;
  repaymentAmount: string;
  debtLeftPreview: (debt: string, ret: string, left: string) => string;
  confirmRepayment: string;
  oneOnOneContract: string;
  recordNewLoan: string;
  borrower: string;
  lender: string;
  amountLabel: string;
  reasonItem: string;
  reasonPlaceholder: string;
  savePrivateLoan: string;

  // Settlement Tab
  contributionsShort: string;
  expensesShort: string;
  fundLeftShort: string;
  whoOwesWhom: string;
  totalDue: (amt: string) => string;
  allRoommatesSettled: string;
  nobodyOwesRoom: string;
  paysWord: string;
  directPeerSettlement: string;
  markPaid: string;
  detailedMemberLedger: string;
  ledgerFormulaHint: string;
  shouldReceive: string;
  owesRoom: string;
  balanced: string;
  contribShort: string;
  personalShort: string;
  fairShareShort: string;
  balanceShort: string;
  reportsAuditTrail: string;
  permanentHistory: string;
  filterFund: string;
  filterLoans: string;
  filterRepayments: string;
  noAuditRecords: string;
  recordedWord: string;

  // Settings Tab
  memberSettings: string;
  profileGroupAdmin: string;
  testIdentitySwitcher: string;
  roleSimulation: string;
  roleSimDesc: string;
  personalProfile: string;
  noEmailRequired: string;
  updateProfile: string;
  groupAdminControls: string;
  adminLocked: string;
  onlyMainAdminDesc: (adminName: string) => string;
  descriptionDormHall: string;
  targetContrib: string;
  memberRolesSection: string;
  noOtherMembersJoined: (code: string) => string;
  makeMember: string;
  makeCoAdmin: string;
  saveGroupSettings: string;
  dataAndStorage: string;
  resetRoomSplitData: string;
  clearsLocalStorage: string;

  // Toasts & Audit Types
  settlementRecordedToast: (amt: string, from: string, to: string) => string;
  profileUpdatedToast: string;
  onlyMainAdminSettingsToast: string;
  groupSettingsUpdatedToast: string;
  switchedIdentityToast: (name: string, role: string) => string;
  nowMemberToast: (name: string) => string;
  appointedCoAdminToast: (name: string) => string;
  resetDataToast: string;
  auditTypeLabels: Record<string, string>;

  // Member Rules & Fund Approval Requests
  requestFundApproval: string;
  approvalRequiredBadge: string;
  requestFundDesc: string;
  requestFundBtn: string;
  editRequestBtn: string;
  cancelRequestBtn: string;
  pendingFundRequests: string;
  yourFundRequests: string;
  pendingApprovalBadge: string;
  approvedBadge: string;
  declinedBadge: string;
  approveBtn: string;
  declineBtn: string;
  reviewedBy: (name: string) => string;
  requestFundInfoBanner: string;
  pendingRequestsBanner: (n: number) => string;
  submitFundRequest: string;
  updateFundRequest: string;
  editFundRequestTitle: string;
  amountYouGave: string;
  iLentMoney: string;
  iBorrowedMoney: string;
  loanDirectionLabel: string;
  memberPermissionsTitle: string;
  memberAccessDesc: string;
  adminAccessDesc: string;
  coAdminAccessDesc: string;
  leaveRoomBtn: string;
  newGroupPasswordPlaceholder: string;
  passwordLengthError: (min: number) => string;
  rateLimitedError: (seconds: number) => string;
  invalidAmountError: string;
  unauthorizedActionError: string;
  supabaseNotConfiguredError: string;
}

const en: Translations = {
  appName: 'RoomSplit',
  appSubtitle: 'Manage shared money with your roommates.',
  footerCredit: 'RoomSplit · Created by AB EMAAN',
  footerCreditFull: 'RoomSplit · Created by AB EMAAN',
  languageName: 'English',
  switchToLang: 'العربية',
  languageLabel: 'Language',
  english: 'English',
  arabic: 'العربية',

  firstTimeSetup: 'First-Time Setup',
  stepOneOfOne: 'Step 1 of 1',
  createYourAccount: 'Create Your Account',
  createAccountDesc: 'Enter your details once. You will use this account to create a room or join someone else’s room.',
  yourFullName: 'Your Full Name *',
  fullNamePlaceholder: 'e.g. Abdullah Iman',
  phoneNumber: 'Phone Number *',
  roomNumber: 'Room Number *',
  roomPlaceholder: 'e.g. Room 65',
  createAccountContinue: 'Create Account & Continue',
  accountFieldsError: 'Please provide your full name, phone number, and room number.',
  welcomeAccountReady: (name) => `Welcome, ${name}! Your account is ready.`,
  edit: 'Edit',
  joinAGroup: 'JOIN A GROUP',
  joinGroupHint: (name) => `Join as ${name} using room code & password`,
  createAGroup: 'CREATE A GROUP',
  createGroupHint: 'Set up a new room as Main Admin',
  savedRoomsOnDevice: 'Saved Rooms on this device',
  roomCount: (n) => `${n} ${n === 1 ? 'room' : 'rooms'}`,
  codeLabel: 'Code',
  enter: 'Enter',
  roomAccess: 'Room Access',
  joinAGroupTitle: 'Join a Group',
  joiningAs: 'Joining as',
  verified: 'Verified',
  groupCode: 'Group Code *',
  groupCodeHint: 'Enter the room code shared by your group admin.',
  groupPassword: 'Group Password',
  enterGroupPassword: 'Enter group password',
  joinRoomEnter: 'Join Room & Enter',
  newRoom: 'New Room',
  createAGroupTitle: 'Create a Group',
  mainAdminCreator: 'Main Admin (Creator)',
  adminBadge: 'ADMIN',
  coAdminBadge: 'CO-ADMIN',
  memberRoleLabel: 'Member',
  groupName: 'Group Name *',
  groupNamePlaceholder: 'e.g. Room 3, Room 65',
  passwordForRoommates: 'Password for roommates to join',
  currency: 'Currency',
  currencyIQD: 'IQD (Iraqi Dinar)',
  currencyUSD: 'USD ($)',
  currencyEUR: 'EUR (€)',
  createGroupNote: 'After creating the group, you can add your fund inside and share the room code so members can join.',
  createGroupOpen: 'Create Group & Open Dashboard',
  studentAccount: 'Student Account',
  yourAccountProfile: 'Your Account Profile',
  signOut: 'Sign Out',
  saveChanges: 'Save Changes',
  accountUpdated: 'Account profile updated!',
  signedOut: 'Account signed out.',
  enterRoomCodeError: 'Please enter a room code (e.g. RS-6582).',
  createAccountFirstError: 'Please create your account first.',
  enterGroupNameError: 'Please enter a group name.',
  setGroupPasswordError: 'Please set a group password for roommates.',

  tabOverview: 'Overview',
  tabExpenses: 'Expenses',
  tabFund: 'Fund',
  tabLoans: 'Loans',
  tabSettle: 'Settle',
  switchDormRoom: 'Switch Dorm Room',
  returnToHome: 'Return to Home',
  recordTransaction: 'Record Transaction',
  addSharedExpense: 'Add Shared Expense',
  roomBadge: 'Room',
  equalSplitDesc: 'Equal split or custom roommates list',
  addToGroupFund: 'Add to Group Fund',
  adminOrCoAdminBadge: 'Admin',
  verifyCashDesc: 'Add fund received from yourself or roommates',
  recordPersonalLoan: 'Record Personal Loan',
  oneOnOneBadge: '1-on-1',
  privateLoanDesc: 'Private peer borrowing, isolated from dorm expenses',
  settleUpBalances: 'Settle Up Balances',
  settleDesc: 'Calculate who owes whom with minimal peer transfers',

  active: 'Active',
  roomCodePrefix: 'Room Code',
  yourRole: 'Your Role',
  mainAdminLabel: 'Main Admin',
  coAdminLabel: 'Co-Admin',
  roommateMemberLabel: 'Roommate (Member)',
  remainingGroupBalance: 'Remaining Group Balance',
  liveBalance: 'Live Balance',
  collectedMinusSpent: 'Total Collected − Spent from Group Fund',
  collected: 'Collected',
  totalSpent: 'Total Spent',
  addExpense: 'Add Expense',
  recentPurchases: 'Recent Purchases',
  viewAll: (n) => `View all (${n})`,
  noPurchasesYet: 'No purchases recorded yet. Tap "Add Expense" above to log items.',
  purchasedBy: 'Purchased by',
  groupFundSource: 'Group Fund',
  personalPaidSource: 'Personal Paid',
  groupMembers: 'Group Members',
  shareCodeToJoin: (code) => `Share code ${code} to join`,
  youBadge: 'YOU',
  given: 'Given',
  recordFund: 'Record Fund',
  adminAuthorityOnly: 'Admin Authority',
  recordMoneyReceived: 'Record Money Received',
  recordingFundAs: (name, role) => `Recording as ${name} (${role}). Only Admin or Co-Admin can add funds.`,
  selectRoommateGaveMoney: 'Select Roommate who gave the money:',
  amountGivenBy: (name) => `Amount Given by ${name}`,
  notes: 'Notes',
  confirmAddToFund: 'Confirm & Add to Group Fund',

  quickEntry: 'Quick Entry',
  whatDidYouBuy: 'What did you buy? (Description) *',
  whatBoughtPlaceholder: 'e.g. Oil, rice, drinking water...',
  howMuchCost: 'How much did it cost?',
  purchasedByLabel: 'Purchased by *',
  dateLabel: 'Date',
  paidUsingGroupMoney: 'Paid using group money',
  subtractFromFund: (bal) => `Subtract from group fund (Balance: ${bal})`,
  saveExpense: 'Save Expense',

  sharedSpend: 'Shared Spend',
  activeCycle: 'Active Cycle',
  splitAcrossMembers: (n) => `Split across ${n} ${n === 1 ? 'roommate' : 'roommates'}`,
  youPaid: 'You Paid',
  yourShare: 'Your Share',
  netPoolDue: 'Net Pool Due',
  sharedLedger: 'Shared Ledger',
  itemsInRoom: (n, room) => `${n} items · ${room}`,
  noSharedExpensesYet: 'No shared expenses recorded yet',
  tapAddExpenseHint: (room) => `Tap "Add Expense" to log shared items for ${room}.`,
  sharedTag: 'Shared',
  paidBy: (name) => `Paid by ${name}`,
  splitWaysPerEa: (n, amt) => `Split ${n} ways · ${amt}/ea`,
  newSharedExpense: 'New Shared Expense',
  totalSpentAmount: 'Total Spent Amount',
  perPersonSummary: (amt, n) => `${amt} / person (${n} roommates)`,
  descriptionLabel: 'Description *',
  descriptionPlaceholder: 'e.g. Rice, tomatoes, dorm Wi-Fi...',
  paymentSourceLabel: 'Payment Source *',
  fundRemainingShort: (amt) => `Fund: ${amt}`,
  groupFundTab: 'Group Fund',
  personalTab: 'Personal',
  bothMixTab: 'Both (Mix)',
  whoPaidPersonally: 'Who paid personally?',
  fromGroupFund: 'From Group Fund:',
  personalOutOfPocket: 'Personal Out-of-Pocket:',
  payerForRemainder: 'Payer for the remainder:',
  splitAmong: 'Split Among',
  allCount: (n) => `All (${n})`,
  custom: 'Custom',
  excluded: 'Excluded',
  sharePrefix: (amt) => `Share: ${amt}`,
  mixedPay: 'Mixed Pay',
  backSuffix: (amt) => `+${amt} back`,
  dueSuffix: (amt) => `-${amt} due`,

  totalCollected: 'Total Collected',
  fromMembersCount: (n) => `From ${n} ${n === 1 ? 'member' : 'members'}`,
  remainingFund: 'Remaining Fund',
  spentFromFund: (amt) => `Spent: ${amt} from fund`,
  authorizedAddFund: 'You can add funds for yourself or any member',
  viewOnlyFund: 'View only (Admin & Co-Admin manage funds)',
  addFund: 'Add Fund',
  membersFundSummary: 'Members Fund Summary',
  lastAddedBy: (name) => `Last added by ${name}`,
  totalGiven: 'Total Given',
  addShort: 'Add',
  fundGivenHistory: 'Fund Given History',
  entriesCount: (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`,
  noFundsAddedYet: 'No funds have been added yet.',
  tapAddFundHint: 'Tap "Add Fund" above to add from your side or a member.',
  givenByName: (name) => `Given by ${name}`,
  addedByName: (name) => `Added by ${name}`,
  whoGaveMoney: 'Who gave this money?',
  noteOptional: 'Note (Optional)',
  noteCashPlaceholder: 'e.g. Cash handed in room',

  lentOut: 'Lent Out',
  youOwe: 'You Owe',
  owedToYou: 'Owed to you',
  privateOneOnOneDebt: 'Private 1-on-1 debt',
  returnedProgress: (repaid, orig) => `${repaid} / ${orig} returned`,
  paidBackProgress: (repaid, orig) => `${repaid} / ${orig} paid back`,
  yourNetLoanPosition: 'Your Net Loan Position',
  netOwedToYou: 'Net owed to you across 1-on-1 loans',
  netYouOwe: 'Net amount you owe across 1-on-1 loans',
  allPersonalLoansBalanced: 'All personal loans balanced',
  newLoan: 'New Loan',
  netOneOnOneBalances: 'Net 1-on-1 Loan Balances',
  activeDebtLabel: (amt) => `Active Debt: ${amt}`,
  owesWord: 'owes',
  loanContracts: (n) => `Loan Contracts (${n} active)`,
  filterAll: 'All',
  filterActive: 'Active',
  filterSettled: 'Settled',
  noPersonalLoans: 'No personal loans recorded',
  noFilteredLoans: (f) => `No ${f} loans`,
  tapNewLoanHint: 'Tap "New Loan" to track private peer agreements outside room splits.',
  settledAgreement: 'Settled Agreement',
  activeAgreement: 'Active Agreement',
  settled100: '100% Settled',
  pctPaid: (pct) => `${pct}% Paid`,
  remaining: 'Remaining',
  original: 'Original',
  returnedWord: 'returned',
  leftWord: 'left',
  recordRepayment: 'Record Repayment',
  loanAuditLedger: 'Loan Audit Ledger',
  repaidTotalLabel: (amt) => `Repaid Total: ${amt}`,
  noLoanTransactions: 'No loan transactions recorded yet.',
  loanAgreementTitle: 'Loan Agreement',
  fullRepaymentTitle: 'Full Repayment',
  partialRepaymentTitle: 'Partial Repayment',
  borrowedFrom: (b, l, desc) => `${b} borrowed from ${l} · ${desc}`,
  returnedTo: (b, l, note) => `${b} returned to ${l}${note ? ` · ${note}` : ''}`,
  originalLabel: (amt) => `Original: ${amt}`,
  leftLabel: (amt) => `Left: ${amt}`,
  repaymentAmount: 'Repayment Amount',
  debtLeftPreview: (debt, ret, left) => `Debt: ${debt} − Return: ${ret} = Left: ${left}`,
  confirmRepayment: 'Confirm Repayment',
  oneOnOneContract: '1-on-1 Contract',
  recordNewLoan: 'Record New Loan',
  borrower: 'Borrower',
  lender: 'Lender',
  amountLabel: 'Amount',
  reasonItem: 'Reason / Item *',
  reasonPlaceholder: 'e.g. Textbook printing',
  savePrivateLoan: 'Save Private Loan',

  contributionsShort: 'Fund',
  expensesShort: 'Expenses',
  fundLeftShort: 'Fund Left',
  whoOwesWhom: 'Who Owes Whom',
  totalDue: (amt) => `Total Due: ${amt}`,
  allRoommatesSettled: 'All Roommates Settled!',
  nobodyOwesRoom: 'Nobody currently owes money for shared group expenses.',
  paysWord: 'pays',
  directPeerSettlement: 'Direct peer settlement',
  markPaid: 'Mark Paid',
  detailedMemberLedger: 'Detailed Member Ledger',
  ledgerFormulaHint: 'Contrib + Personal - Fair Share',
  shouldReceive: 'Should Receive',
  owesRoom: 'Owes Room',
  balanced: 'Balanced',
  contribShort: 'Contrib',
  personalShort: 'Personal',
  fairShareShort: 'Fair Share',
  balanceShort: 'Balance',
  reportsAuditTrail: 'Reports & Audit Trail',
  permanentHistory: 'Permanent History',
  filterFund: 'Fund',
  filterLoans: 'Loans',
  filterRepayments: 'Repayments',
  noAuditRecords: 'No audit records matching this filter.',
  recordedWord: 'Recorded',

  memberSettings: 'Member Settings',
  profileGroupAdmin: 'Profile & Group Admin',
  testIdentitySwitcher: 'Test Identity Switcher',
  roleSimulation: 'Role Simulation',
  roleSimDesc: 'Switch between roommates to verify that only admins can update settings and confirm funds:',
  personalProfile: 'Personal Profile',
  noEmailRequired: 'No email required',
  updateProfile: 'Update Profile',
  groupAdminControls: 'Group Admin Controls',
  adminLocked: 'Admin Locked',
  onlyMainAdminDesc: (adminName) =>
    `Only the Main Admin (${adminName}) can change group details, manage passwords, or appoint co-admins.`,
  descriptionDormHall: 'Description / Dorm Hall',
  targetContrib: 'Target Contrib',
  memberRolesSection: 'Member Roles (Co-Admin / Member):',
  noOtherMembersJoined: (code) =>
    `No other roommates have joined yet. Share your room code (${code}) so members can join.`,
  makeMember: 'Make Member',
  makeCoAdmin: 'Make Co-Admin',
  saveGroupSettings: 'Save Group Settings',
  dataAndStorage: 'Data & Storage',
  resetRoomSplitData: 'Reset RoomSplit Data',
  clearsLocalStorage: 'Clears local storage on this device',

  settlementRecordedToast: (amt, from, to) => `✅ Recorded ${amt} settlement from ${from} to ${to}!`,
  profileUpdatedToast: '✅ Profile information updated successfully!',
  onlyMainAdminSettingsToast: '⚠️ Only the Main Admin can update group settings.',
  groupSettingsUpdatedToast: '✅ Group details and settings updated!',
  switchedIdentityToast: (name, role) => `Switched active identity to ${name} (${role})`,
  nowMemberToast: (name) => `${name} is now a regular Member.`,
  appointedCoAdminToast: (name) => `Appointed ${name} as Co-Admin!`,
  resetDataToast: 'Reset all local storage data',
  auditTypeLabels: {
    shared_expense: 'shared expense',
    contribution: 'fund',
    personal_loan: 'personal loan',
    loan_repayment: 'loan repayment',
    settlement: 'settlement',
    member_joined: 'member',
  },

  requestFundApproval: 'Request Fund Approval',
  approvalRequiredBadge: 'Approval',
  requestFundDesc: 'Submit money you gave for admin approval',
  requestFundBtn: 'Request Fund',
  editRequestBtn: 'Edit',
  cancelRequestBtn: 'Cancel',
  pendingFundRequests: 'Pending Fund Requests',
  yourFundRequests: 'Your Fund Requests',
  pendingApprovalBadge: 'Pending Approval',
  approvedBadge: 'Approved',
  declinedBadge: 'Declined',
  approveBtn: 'Approve',
  declineBtn: 'Decline',
  reviewedBy: (name) => `Reviewed by ${name}`,
  requestFundInfoBanner:
    'Members cannot add directly to the fund. Submit your amount below — it enters the group fund once an Admin or Co-Admin approves it.',
  pendingRequestsBanner: (n) =>
    `${n} pending fund ${n === 1 ? 'request' : 'requests'} awaiting approval`,
  submitFundRequest: 'Submit for Admin Approval',
  updateFundRequest: 'Update Pending Request',
  editFundRequestTitle: 'Edit Fund Request',
  amountYouGave: 'Amount You Gave',
  iLentMoney: 'I Lent Money',
  iBorrowedMoney: 'I Borrowed Money',
  loanDirectionLabel: 'Your Role in Loan',
  memberPermissionsTitle: 'Your Role & Access',
  memberAccessDesc:
    'You can log shared expenses, submit fund requests for admin approval, and manage your own 1-on-1 loans.',
  adminAccessDesc:
    'Full Main Admin control: manage room settings, appoint co-admins, add funds directly, and approve member requests.',
  coAdminAccessDesc:
    'Co-Admin access: add funds directly, approve member fund requests, and manage settlements.',
  leaveRoomBtn: 'Back to Rooms List',
  newGroupPasswordPlaceholder: 'Leave blank to keep current',
  passwordLengthError: (min) => `Password must be at least ${min} characters long.`,
  rateLimitedError: (seconds) => `Too many failed attempts. Please wait ${seconds}s before trying again.`,
  invalidAmountError: 'Please enter a valid positive amount.',
  unauthorizedActionError: 'Permission denied or session expired.',
  supabaseNotConfiguredError:
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.',
};

const ar: Translations = {
  appName: 'روم سبليت',
  appSubtitle: 'إدارة الأموال والمصاريف المشتركة مع زملاء السكن.',
  footerCredit: 'RoomSplit · تطوير AB EMAAN',
  footerCreditFull: 'RoomSplit · تطوير AB EMAAN',
  languageName: 'العربية',
  switchToLang: 'English',
  languageLabel: 'اللغة',
  english: 'English',
  arabic: 'العربية',

  firstTimeSetup: 'الإعداد الأولي',
  stepOneOfOne: 'الخطوة ١ من ١',
  createYourAccount: 'إنشاء حسابك',
  createAccountDesc: 'أدخل بياناتك مرة واحدة. ستستخدم هذا الحساب لإنشاء مجموعة أو الانضمام إلى مجموعة أخرى.',
  yourFullName: 'الاسم الكامل *',
  fullNamePlaceholder: 'مثال: عبدالله إيمان',
  phoneNumber: 'رقم الهاتف *',
  roomNumber: 'رقم الغرفة *',
  roomPlaceholder: 'مثال: غرفة 65',
  createAccountContinue: 'إنشاء الحساب والمتابعة',
  accountFieldsError: 'يرجى إدخال الاسم الكامل ورقم الهاتف ورقم الغرفة.',
  welcomeAccountReady: (name) => `أهلاً بك، ${name}! حسابك جاهز الآن.`,
  edit: 'تعديل',
  joinAGroup: 'الانضمام إلى مجموعة',
  joinGroupHint: (name) => `انضم باسم ${name} عبر رمز الغرفة وكلمة المرور`,
  createAGroup: 'إنشاء مجموعة',
  createGroupHint: 'أنشئ غرفة جديدة بصلاحية المشرف الرئيسي',
  savedRoomsOnDevice: 'الغرف المحفوظة على هذا الجهاز',
  roomCount: (n) => `${n} ${n === 1 ? 'غرفة' : 'غرف'}`,
  codeLabel: 'الرمز',
  enter: 'دخول',
  roomAccess: 'الدخول للغرفة',
  joinAGroupTitle: 'الانضمام إلى مجموعة',
  joiningAs: 'الانضمام باسم',
  verified: 'موثق',
  groupCode: 'رمز المجموعة *',
  groupCodeHint: 'أدخل رمز الغرفة الذي شاركه معك مشرف المجموعة.',
  groupPassword: 'كلمة مرور المجموعة',
  enterGroupPassword: 'أدخل كلمة مرور المجموعة',
  joinRoomEnter: 'انضمام ودخول الغرفة',
  newRoom: 'غرفة جديدة',
  createAGroupTitle: 'إنشاء مجموعة جديدة',
  mainAdminCreator: 'المشرف الرئيسي (المنشئ)',
  adminBadge: 'مشرف',
  coAdminBadge: 'مشرف مساعد',
  memberRoleLabel: 'عضو',
  groupName: 'اسم المجموعة *',
  groupNamePlaceholder: 'مثال: غرفة 3، غرفة 65',
  passwordForRoommates: 'كلمة مرور انضمام الزملاء',
  currency: 'العملة',
  currencyIQD: 'IQD (دينار عراقي)',
  currencyUSD: 'USD (دولار)',
  currencyEUR: 'EUR (يورو)',
  createGroupNote: 'بعد إنشاء المجموعة، يمكنك إضافة مبلغ الصندوق من طرفك ومشاركة رمز الغرفة لينضم الأعضاء.',
  createGroupOpen: 'إنشاء المجموعة وفتح اللوحة',
  studentAccount: 'حساب الطالب',
  yourAccountProfile: 'ملف حسابك الشخصي',
  signOut: 'تسجيل الخروج',
  saveChanges: 'حفظ التغييرات',
  accountUpdated: 'تم تحديث بيانات الحساب!',
  signedOut: 'تم تسجيل الخروج من الحساب.',
  enterRoomCodeError: 'يرجى إدخال رمز الغرفة (مثال: RS-6582).',
  createAccountFirstError: 'يرجى إنشاء حسابك أولاً.',
  enterGroupNameError: 'يرجى إدخال اسم المجموعة.',
  setGroupPasswordError: 'يرجى تعيين كلمة مرور للغرفة.',

  tabOverview: 'الرئيسية',
  tabExpenses: 'المصاريف',
  tabFund: 'الصندوق',
  tabLoans: 'الديون',
  tabSettle: 'التسوية',
  switchDormRoom: 'تبديل الغرفة',
  returnToHome: 'العودة للصفحة الرئيسية',
  recordTransaction: 'تسجيل عملية',
  addSharedExpense: 'إضافة مصروف مشترك',
  roomBadge: 'غرفة',
  equalSplitDesc: 'تقسيم متساوٍ أو اختيار أعضاء محددين',
  addToGroupFund: 'إضافة إلى صندوق المجموعة',
  adminOrCoAdminBadge: 'مشرف',
  verifyCashDesc: 'تسجيل مبلغ مضاف من طرفك أو من الأعضاء',
  recordPersonalLoan: 'تسجيل دين شخصي',
  oneOnOneBadge: '١ إلى ١',
  privateLoanDesc: 'سلفة شخصية خاصة معزولة عن مصاريف الغرفة',
  settleUpBalances: 'تسوية الحسابات',
  settleDesc: 'حساب من يدين لمن بأقل عدد من التحويلات',

  active: 'نشط',
  roomCodePrefix: 'رمز الغرفة',
  yourRole: 'صلاحيتك',
  mainAdminLabel: 'المشرف الرئيسي',
  coAdminLabel: 'مشرف مساعد',
  roommateMemberLabel: 'عضو الغرفة',
  remainingGroupBalance: 'رصيد المجموعة المتبقي',
  liveBalance: 'الرصيد المباشر',
  collectedMinusSpent: 'إجمالي المجموع − المصروف من الصندوق',
  collected: 'المحصّل',
  totalSpent: 'إجمالي المصروف',
  addExpense: 'إضافة مصروف',
  recentPurchases: 'المشتريات الأخيرة',
  viewAll: (n) => `عرض الكل (${n})`,
  noPurchasesYet: 'لا توجد مشتريات مسجلة بعد. اضغط على "إضافة مصروف" بالأعلى.',
  purchasedBy: 'بواسطة',
  groupFundSource: 'من الصندوق',
  personalPaidSource: 'دفع شخصي',
  groupMembers: 'أعضاء المجموعة',
  shareCodeToJoin: (code) => `شارك الرمز ${code} للانضمام`,
  youBadge: 'أنت',
  given: 'المدفوع',
  recordFund: 'إضافة مبلغ',
  adminAuthorityOnly: 'صلاحية المشرف',
  recordMoneyReceived: 'تسجيل مبلغ مستلم للصندوق',
  recordingFundAs: (name, role) => `تسجيل بواسطة ${name} (${role}). المشرف والمشرف المساعد فقط يمكنهم إضافة الأموال.`,
  selectRoommateGaveMoney: 'اختر العضو الذي قدّم المبلغ:',
  amountGivenBy: (name) => `المبلغ المقدم من ${name}`,
  notes: 'ملاحظات',
  confirmAddToFund: 'تأكيد وإضافة للصندوق',

  quickEntry: 'إدخال سريع',
  whatDidYouBuy: 'ماذا اشتريت؟ (الوصف) *',
  whatBoughtPlaceholder: 'مثال: زيت، أرز، ماء شرب...',
  howMuchCost: 'كم كان السعر؟',
  purchasedByLabel: 'المشتري *',
  dateLabel: 'التاريخ',
  paidUsingGroupMoney: 'دفع من أموال الصندوق المشترك',
  subtractFromFund: (bal) => `خصم من الصندوق (الرصيد: ${bal})`,
  saveExpense: 'حفظ المصروف',

  sharedSpend: 'المصروف المشترك',
  activeCycle: 'الدورة الحالية',
  splitAcrossMembers: (n) => `موزع على ${n} ${n === 1 ? 'عضو' : 'أعضاء'}`,
  youPaid: 'دفعت شخصياً',
  yourShare: 'حصتك',
  netPoolDue: 'الصافي المستحق',
  sharedLedger: 'سجل المصاريف المشتركة',
  itemsInRoom: (n, room) => `${n} عناصر · ${room}`,
  noSharedExpensesYet: 'لا توجد مصاريف مشتركة مسجلة بعد',
  tapAddExpenseHint: (room) => `اضغط "إضافة مصروف" لتسجيل المشتريات المشتركة لغرفة ${room}.`,
  sharedTag: 'مشترك',
  paidBy: (name) => `دفعها ${name}`,
  splitWaysPerEa: (n, amt) => `تقسيم على ${n} · ${amt} للواحد`,
  newSharedExpense: 'مصروف مشترك جديد',
  totalSpentAmount: 'إجمالي المبلغ المصروف',
  perPersonSummary: (amt, n) => `${amt} / للشخص (${n} أعضاء)`,
  descriptionLabel: 'الوصف *',
  descriptionPlaceholder: 'مثال: أرز، طماطم، إنترنت السكن...',
  paymentSourceLabel: 'مصدر الدفع *',
  fundRemainingShort: (amt) => `الصندوق: ${amt}`,
  groupFundTab: 'من الصندوق',
  personalTab: 'دفع شخصي',
  bothMixTab: 'مختلط',
  whoPaidPersonally: 'من دفع من حسابه الشخصي؟',
  fromGroupFund: 'من صندوق المجموعة:',
  personalOutOfPocket: 'مدفوع شخصياً:',
  payerForRemainder: 'دافع المبلغ المتبقي:',
  splitAmong: 'تقسيم على',
  allCount: (n) => `الكل (${n})`,
  custom: 'مخصص',
  excluded: 'مستبعد',
  sharePrefix: (amt) => `الحصة: ${amt}`,
  mixedPay: 'دفع مختلط',
  backSuffix: (amt) => `+${amt} يسترد`,
  dueSuffix: (amt) => `-${amt} عليه`,

  totalCollected: 'إجمالي المجموع',
  fromMembersCount: (n) => `من ${n} ${n === 1 ? 'عضو' : 'أعضاء'}`,
  remainingFund: 'الرصيد المتبقي',
  spentFromFund: (amt) => `المصروف من الصندوق: ${amt}`,
  authorizedAddFund: 'يمكنك إضافة مبلغ من طرفك أو لأي عضو',
  viewOnlyFund: 'عرض فقط (الإضافة للمشرف والمشرف المساعد)',
  addFund: 'إضافة مبلغ',
  membersFundSummary: 'أعضاء الصندوق ومساهماتهم',
  lastAddedBy: (name) => `آخر إضافة بواسطة ${name}`,
  totalGiven: 'إجمالي المدفوع',
  addShort: 'إضافة',
  fundGivenHistory: 'سجل المبالغ المضافة للصندوق',
  entriesCount: (n) => `${n} ${n === 1 ? 'عملية' : 'عمليات'}`,
  noFundsAddedYet: 'لم تتم إضافة أي مبالغ للصندوق بعد.',
  tapAddFundHint: 'اضغط "إضافة مبلغ" بالأعلى للإضافة من طرفك أو من أي عضو.',
  givenByName: (name) => `مقدم من ${name}`,
  addedByName: (name) => `أضافه ${name}`,
  whoGaveMoney: 'من قدّم هذا المبلغ؟',
  noteOptional: 'ملاحظة (اختياري)',
  noteCashPlaceholder: 'مثال: نقداً في الغرفة',

  lentOut: 'أقرضت',
  youOwe: 'عليك دين',
  owedToYou: 'مستحق لك',
  privateOneOnOneDebt: 'دين شخصي ١ إلى ١',
  returnedProgress: (repaid, orig) => `تم استرداد ${repaid} / ${orig}`,
  paidBackProgress: (repaid, orig) => `تم سداد ${repaid} / ${orig}`,
  yourNetLoanPosition: 'صافي موقف الديون الشخصية',
  netOwedToYou: 'الصافي المستحق لك في الديون الشخصية',
  netYouOwe: 'صافي المبلغ الذي تدين به للآخرين',
  allPersonalLoansBalanced: 'جميع الديون الشخصية مسددة',
  newLoan: 'دين جديد',
  netOneOnOneBalances: 'صافي الديون الفردية (١ إلى ١)',
  activeDebtLabel: (amt) => `الديون النشطة: ${amt}`,
  owesWord: 'مدين لـ',
  loanContracts: (n) => `عقود الديون (${n} نشط)`,
  filterAll: 'الكل',
  filterActive: 'النشطة',
  filterSettled: 'المسددة',
  noPersonalLoans: 'لا توجد ديون شخصية مسجلة',
  noFilteredLoans: (f) => `لا توجد ديون ${f}`,
  tapNewLoanHint: 'اضغط "دين جديد" لتسجيل سلفة شخصية منفصلة عن مصاريف الغرفة.',
  settledAgreement: 'اتفاقية مسددة',
  activeAgreement: 'اتفاقية نشطة',
  settled100: 'مسدد ١٠٠٪',
  pctPaid: (pct) => `مدفوع ${pct}%`,
  remaining: 'المتبقي',
  original: 'الأصل',
  returnedWord: 'مسدد',
  leftWord: 'متبقي',
  recordRepayment: 'تسجيل سداد',
  loanAuditLedger: 'سجل تدقيق الديون',
  repaidTotalLabel: (amt) => `إجمالي المسدد: ${amt}`,
  noLoanTransactions: 'لا توجد عمليات ديون مسجلة بعد.',
  loanAgreementTitle: 'اتفاقية دين',
  fullRepaymentTitle: 'سداد كامل',
  partialRepaymentTitle: 'سداد جزئي',
  borrowedFrom: (b, l, desc) => `اقترض ${b} من ${l} · ${desc}`,
  returnedTo: (b, l, note) => `أرجع ${b} إلى ${l}${note ? ` · ${note}` : ''}`,
  originalLabel: (amt) => `الأصل: ${amt}`,
  leftLabel: (amt) => `المتبقي: ${amt}`,
  repaymentAmount: 'مبلغ السداد',
  debtLeftPreview: (debt, ret, left) => `الدين: ${debt} − السداد: ${ret} = المتبقي: ${left}`,
  confirmRepayment: 'تأكيد السداد',
  oneOnOneContract: 'عقد ١ إلى ١',
  recordNewLoan: 'تسجيل دين جديد',
  borrower: 'المقترض',
  lender: 'المُقرض',
  amountLabel: 'المبلغ',
  reasonItem: 'السبب / الغرض *',
  reasonPlaceholder: 'مثال: طباعة ملازم، مصاريف خاصة',
  savePrivateLoan: 'حفظ الدين الشخصي',

  contributionsShort: 'الصندوق',
  expensesShort: 'المصاريف',
  fundLeftShort: 'المتبقي',
  whoOwesWhom: 'من يدين لمن',
  totalDue: (amt) => `إجمالي المستحق: ${amt}`,
  allRoommatesSettled: 'جميع الأعضاء متساوون!',
  nobodyOwesRoom: 'لا يوجد أي عضو مدين حالياً لمصاريف المجموعة المشتركة.',
  paysWord: 'يدفع لـ',
  directPeerSettlement: 'تسوية مباشرة بين الأعضاء',
  markPaid: 'تم الدفع',
  detailedMemberLedger: 'كشف حساب الأعضاء التفصيلي',
  ledgerFormulaHint: 'الصندوق + الشخصي − الحصة',
  shouldReceive: 'يستلم',
  owesRoom: 'عليه دفع',
  balanced: 'متوازن',
  contribShort: 'الصندوق',
  personalShort: 'شخصي',
  fairShareShort: 'الحصة',
  balanceShort: 'الرصيد',
  reportsAuditTrail: 'التقارير وسجل التدقيق',
  permanentHistory: 'سجل دائم',
  filterFund: 'الصندوق',
  filterLoans: 'الديون',
  filterRepayments: 'السداد',
  noAuditRecords: 'لا توجد سجلات مطابقة لهذا التصنيف.',
  recordedWord: 'تم التسجيل',

  memberSettings: 'إعدادات العضو',
  profileGroupAdmin: 'الملف الشخصي وإعدادات المشرف',
  testIdentitySwitcher: 'تبديل الهوية للتجربة',
  roleSimulation: 'محاكاة الصلاحية',
  roleSimDesc: 'بدّل بين الأعضاء للتحقق من أن المشرف والمشرف المساعد فقط يملكون الصلاحيات:',
  personalProfile: 'الملف الشخصي',
  noEmailRequired: 'لا يتطلب بريد إلكتروني',
  updateProfile: 'تحديث الملف الشخصي',
  groupAdminControls: 'تحكم المشرف الرئيسي',
  adminLocked: 'خاص بالمشرف',
  onlyMainAdminDesc: (adminName) =>
    `المشرف الرئيسي (${adminName}) فقط يمكنه تعديل بيانات المجموعة، كلمة المرور، أو تعيين مشرفين مساعدين.`,
  descriptionDormHall: 'الوصف / السكن',
  targetContrib: 'المبلغ المستهدف',
  memberRolesSection: 'صلاحيات الأعضاء (مشرف مساعد / عضو):',
  noOtherMembersJoined: (code) =>
    `لم ينضم أعضاء آخرون بعد. شارك رمز الغرفة (${code}) ليتمكنوا من الانضمام.`,
  makeMember: 'تحويل لعضو',
  makeCoAdmin: 'ترقية لمشرف مساعد',
  saveGroupSettings: 'حفظ إعدادات المجموعة',
  dataAndStorage: 'البيانات والتخزين',
  resetRoomSplitData: 'إعادة ضبط بيانات التطبيق',
  clearsLocalStorage: 'يمسح جميع البيانات المحفوظة على هذا الجهاز',

  settlementRecordedToast: (amt, from, to) => `✅ تم تسجيل تسوية بمبلغ ${amt} من ${from} إلى ${to}!`,
  profileUpdatedToast: '✅ تم تحديث بيانات الملف الشخصي بنجاح!',
  onlyMainAdminSettingsToast: '⚠️ المشرف الرئيسي فقط يمكنه تعديل إعدادات المجموعة.',
  groupSettingsUpdatedToast: '✅ تم تحديث بيانات وإعدادات المجموعة!',
  switchedIdentityToast: (name, role) => `تم التبديل إلى هوية ${name} (${role})`,
  nowMemberToast: (name) => `أصبح ${name} عضواً عادياً الآن.`,
  appointedCoAdminToast: (name) => `تم تعيين ${name} كمشرف مساعد!`,
  resetDataToast: 'تم مسح جميع البيانات المحلية',
  auditTypeLabels: {
    shared_expense: 'مصروف مشترك',
    contribution: 'الصندوق',
    personal_loan: 'دين شخصي',
    loan_repayment: 'سداد دين',
    settlement: 'تسوية',
    member_joined: 'عضو',
  },

  requestFundApproval: 'طلب موافقة إضافة صندوق',
  approvalRequiredBadge: 'بموافقة',
  requestFundDesc: 'أرسل المبلغ الذي دفعته ليوافق عليه المشرف',
  requestFundBtn: 'طلب إضافة',
  editRequestBtn: 'تعديل',
  cancelRequestBtn: 'إلغاء',
  pendingFundRequests: 'طلبات الصندوق المعلقة',
  yourFundRequests: 'طلبات الصندوق الخاصة بك',
  pendingApprovalBadge: 'بانتظار الموافقة',
  approvedBadge: 'تمت الموافقة',
  declinedBadge: 'مرفوض',
  approveBtn: 'موافقة',
  declineBtn: 'رفض',
  reviewedBy: (name) => `راجعه ${name}`,
  requestFundInfoBanner:
    'لا يمكن للأعضاء إضافة الأموال مباشرة. أرسل طلبك أدناه وسيضاف للصندوق فور موافقة المشرف أو المشرف المساعد.',
  pendingRequestsBanner: (n) =>
    `${n} ${n === 1 ? 'طلب صندوق معلق' : 'طلبات صندوق معلقة'} بانتظار الموافقة`,
  submitFundRequest: 'إرسال الطلب لموافقة المشرف',
  updateFundRequest: 'تحديث الطلب المعلق',
  editFundRequestTitle: 'تعديل طلب الصندوق',
  amountYouGave: 'المبلغ الذي قدمته',
  iLentMoney: 'أنا أقرضت',
  iBorrowedMoney: 'أنا اقترضت',
  loanDirectionLabel: 'دورك في الدين',
  memberPermissionsTitle: 'دورك وصلاحياتك',
  memberAccessDesc:
    'يمكنك تسجيل المصاريف المشتركة، إرسال طلبات إضافة للصندوق لموافقة المشرف، وإدارة ديونك الشخصية.',
  adminAccessDesc:
    'تحكم المشرف الرئيسي: تعديل إعدادات الغرفة، تعيين مشرفين مساعدين، إضافة الأموال مباشرة، والموافقة على الطلبات.',
  coAdminAccessDesc:
    'صلاحية المشرف المساعد: إضافة الأموال مباشرة، الموافقة على طلبات الأعضاء، وإدارة التسويات.',
  leaveRoomBtn: 'العودة لقائمة الغرف',
  newGroupPasswordPlaceholder: 'اتركه فارغاً للإبقاء على الحالية',
  passwordLengthError: (min) => `يجب أن تكون كلمة المرور ${min} أحرف على الأقل.`,
  rateLimitedError: (seconds) => `محاولات فاشلة كثيرة. يرجى الانتظار ${seconds} ثانية قبل المحاولة مرة أخرى.`,
  invalidAmountError: 'يرجى إدخال مبلغ صحيح أكبر من صفر.',
  unauthorizedActionError: 'ليس لديك صلاحية أو انتهت الجلسة.',
  supabaseNotConfiguredError:
    'لم يتم ربط Supabase بعد. أضف متغيرات VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في إعدادات البيئة.',
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  isRTL: boolean;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'ar' || saved === 'en') return saved;
      return 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    const isRTL = language === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore storage errors
    }
  }, [language]);

  const setLanguage = (lang: Language) => setLanguageState(lang);
  const toggleLanguage = () => setLanguageState((prev) => (prev === 'en' ? 'ar' : 'en'));
  const isRTL = language === 'ar';
  const t = language === 'ar' ? ar : en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, isRTL, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
};
