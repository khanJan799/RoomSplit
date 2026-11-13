import assert from 'node:assert/strict';
import {
  checkJoinRateLimit,
  claimActionLock,
  clearJoinRateLimit,
  createAuthSession,
  generateRoomCode,
  generateSecureId,
  hashGroupPassword,
  isSessionValid,
  isValidGroup,
  pruneExpiredSessions,
  recordFailedJoinAttempt,
  resetActionLocks,
  resetAllRateLimits,
  safeParseArray,
  sanitizePhone,
  sanitizeText,
  validateFinancialAmount,
  validateIsoDate,
  validatePasswordStrength,
  verifyGroupPassword,
} from '../src/utils/security';
import { authorizeGroupMember } from '../src/services/securityArchitecture';
import {
  applyGroupSettingsUpdate,
  validateCoAdminChange,
  validateContributionPayload,
  validateExpensePayload,
  validateFundRequestReview,
  validateLoanPayload,
  validateLoanRepaymentPayload,
  validateSettlementPayload,
} from '../src/data/storeLogic';
import {
  calculateGroupFinancialSummary,
  calculateGroupLoanSummary,
} from '../src/utils/calculations';
import {
  AuthSession,
  Contribution,
  Expense,
  FundRequest,
  Group,
  Member,
  PersonalLoan,
  SettlementTransfer,
} from '../src/types';

async function runTests() {
  let passed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    await fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  };

  // Fixture setup: Group A & Group B
  const adminA: Member = { id: 'usr-admin-a', name: 'Abdullah', phone: '07701112222', roomNumber: 'R1', role: 'main_admin' };
  const coAdminA: Member = { id: 'usr-coadmin-a', name: 'Hassan', phone: '07703334444', roomNumber: 'R2', role: 'co_admin' };
  const memberA: Member = { id: 'usr-member-a', name: 'Ali', phone: '07705556666', roomNumber: 'R3', role: 'member' };
  const memberA2: Member = { id: 'usr-member-a2', name: 'Zaid', phone: '07707778888', roomNumber: 'R4', role: 'member' };

  const adminB: Member = { id: 'usr-admin-b', name: 'Omar', phone: '07801112222', roomNumber: 'B1', role: 'main_admin' };

  const passHashA = await hashGroupPassword('DormPass#2026');
  const passHashB = await hashGroupPassword('GroupB!999');

  const groupA: Group = {
    id: 'grp-a',
    name: 'Room 65',
    code: 'RS-7K9M2P',
    passwordHash: passHashA.hash,
    passwordSalt: passHashA.salt,
    passwordAlgorithm: passHashA.algorithm,
    initialFund: 0,
    description: 'Hall A',
    currency: 'IQD',
    mainAdminId: adminA.id,
    coAdminIds: [coAdminA.id],
    members: [adminA, coAdminA, memberA, memberA2],
    expectedContributionPerMember: 20000,
  };

  const groupB: Group = {
    id: 'grp-b',
    name: 'Room 99',
    code: 'RS-9X4Q8L',
    passwordHash: passHashB.hash,
    passwordSalt: passHashB.salt,
    passwordAlgorithm: passHashB.algorithm,
    initialFund: 0,
    currency: 'IQD',
    mainAdminId: adminB.id,
    coAdminIds: [],
    members: [adminB],
    expectedContributionPerMember: 10000,
  };

  // 1. Password Hashing & Strength
  await test('PBKDF2-SHA256 hashes with unique salts and verifies accurately', async () => {
    const h1 = await hashGroupPassword('Secret123');
    const h2 = await hashGroupPassword('Secret123');
    assert.notEqual(h1.salt, h2.salt);
    assert.notEqual(h1.hash, h2.hash);
    assert.equal(h1.hash.length, 64);
    assert.equal(await verifyGroupPassword('Secret123', h1.hash, h1.salt), true);
    assert.equal(await verifyGroupPassword('WrongPass', h1.hash, h1.salt), false);
    assert.equal(await verifyGroupPassword('Secret123', undefined, h1.salt), false);
    assert.equal(await verifyGroupPassword('', h1.hash, h1.salt), false);
  });

  await test('Password strength rejects empty, short, and oversized passwords', () => {
    assert.equal(validatePasswordStrength('   ').valid, false);
    assert.equal(validatePasswordStrength('123').valid, false);
    assert.equal(validatePasswordStrength('1234').valid, true);
    assert.equal(validatePasswordStrength('a'.repeat(129)).valid, false);
  });

  await test('Cryptographic room codes & IDs are strong and unique', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode(Array.from(codes));
      assert.match(code, /^RS-[A-Z2-9]{6}$/);
      assert.equal(codes.has(code), false);
      codes.add(code);
    }
    const id1 = generateSecureId('usr');
    const id2 = generateSecureId('usr');
    assert.notEqual(id1, id2);
  });

  // 2. Rate Limiting
  await test('Brute-force rate limiter locks out after 5 failed attempts and clears on success', () => {
    resetAllRateLimits();
    const targetCode = 'RS-7K9M2P';
    for (let i = 0; i < 4; i++) {
      assert.equal(checkJoinRateLimit(targetCode).allowed, true);
      const res = recordFailedJoinAttempt(targetCode);
      assert.equal(res.locked, false);
    }
    const fifth = recordFailedJoinAttempt(targetCode);
    assert.equal(fifth.locked, true);
    assert.ok(fifth.retryAfterSeconds >= 1);
    assert.equal(checkJoinRateLimit(targetCode).allowed, false);

    clearJoinRateLimit(targetCode);
    assert.equal(checkJoinRateLimit(targetCode).allowed, true);
    resetAllRateLimits();
  });

  // 3. Session Authorization & Cross-Group Isolation
  await test('Session validation & strict cross-group isolation (no members[0] fallback)', () => {
    const validSessionA = createAuthSession(groupA.id, memberA.id);
    const expiredSessionB: AuthSession = {
      groupId: groupB.id,
      memberId: adminB.id,
      token: 'tok-expired',
      issuedAt: Date.now() - 100_000,
      expiresAt: Date.now() - 1000,
    };
    const sessions = {
      [groupA.id]: validSessionA,
      [groupB.id]: expiredSessionB,
    };

    assert.equal(isSessionValid(validSessionA, memberA.id), true);
    assert.equal(isSessionValid(validSessionA, adminA.id), false);
    assert.equal(isSessionValid(expiredSessionB, adminB.id), false);

    // Group A member can access Group A as memberA, NOT Group B (no fallback to adminB!)
    assert.equal(authorizeGroupMember(groupA, memberA.id, sessions)?.id, memberA.id);
    assert.equal(authorizeGroupMember(groupB, memberA.id, sessions), null);
    assert.equal(authorizeGroupMember(groupB, adminB.id, sessions), null);
    assert.equal(Object.keys(pruneExpiredSessions(sessions)).length, 1);
  });

  // 4. Role Permissions & Privilege Escalation
  await test('RBAC prevents member/co-admin privilege escalation', () => {
    // Member cannot direct-add fund
    assert.equal(validateContributionPayload(groupA, memberA, memberA.id, 10000).valid, false);
    // Co-Admin and Main Admin can direct-add fund
    assert.equal(validateContributionPayload(groupA, coAdminA, memberA.id, 10000).valid, true);
    assert.equal(validateContributionPayload(groupA, adminA, memberA.id, 10000).valid, true);

    const pendingReq: FundRequest = {
      id: 'freq-1',
      groupId: groupA.id,
      memberId: memberA.id,
      memberName: memberA.name,
      amount: 20000,
      status: 'pending',
      date: '2026-11-13',
      createdAt: new Date().toISOString(),
    };
    // Member cannot approve their own fund request
    assert.equal(validateFundRequestReview(groupA, memberA, pendingReq, 'approved').valid, false);
    // Co-Admin can approve
    assert.equal(validateFundRequestReview(groupA, coAdminA, pendingReq, 'approved').valid, true);
    // Cannot approve already-approved request
    assert.equal(
      validateFundRequestReview(groupA, adminA, { ...pendingReq, status: 'approved' }, 'approved').valid,
      false
    );

    // Only Main Admin can manage Co-Admins or Group Settings
    assert.equal(validateCoAdminChange(groupA, memberA, memberA2.id).valid, false);
    assert.equal(validateCoAdminChange(groupA, coAdminA, memberA2.id).valid, false);
    assert.equal(validateCoAdminChange(groupA, adminA, adminA.id).valid, false); // cannot target mainAdmin
    assert.equal(validateCoAdminChange(groupA, adminA, memberA2.id).valid, true);

    assert.equal(applyGroupSettingsUpdate(groupA, coAdminA, { name: 'Hacked' }).valid, false);
    assert.equal(applyGroupSettingsUpdate(groupA, memberA, { name: 'Hacked' }).valid, false);

    // Mass assignment protection: passing extra forged fields does not overwrite mainAdminId or id
    const forgedInput = {
      name: 'Room 65 Updated',
      id: 'grp-hijacked',
      mainAdminId: memberA.id,
    } as unknown as Parameters<typeof applyGroupSettingsUpdate>[2];
    const updatedGroupRes = applyGroupSettingsUpdate(groupA, adminA, forgedInput);
    assert.equal(updatedGroupRes.valid, true);
    if (updatedGroupRes.valid) {
      assert.equal(updatedGroupRes.data.id, groupA.id);
      assert.equal(updatedGroupRes.data.mainAdminId, adminA.id);
      assert.equal(updatedGroupRes.data.name, 'Room 65 Updated');
    }
  });

  // 5. Cross-Group IDOR, Financial Abuse & Input Sanitization
  await test('Cross-group IDOR & invalid financial inputs are strictly rejected', () => {
    // Loan in Group B cannot be repaid from Group A context
    const loanInB: PersonalLoan = {
      id: 'loan-b1',
      groupId: groupB.id,
      borrowerId: adminB.id,
      borrowerName: adminB.name,
      lenderId: memberA.id,
      lenderName: memberA.name,
      originalAmount: 5000,
      remainingAmount: 5000,
      description: 'Book',
      date: '2026-11-13',
      status: 'active',
      repayments: [],
    };
    assert.equal(
      validateLoanRepaymentPayload(groupA, adminA, loanInB, 1000, '2026-11-13').valid,
      false
    );

    // Member cannot create loan between two other members
    assert.equal(
      validateLoanPayload(groupA, memberA, memberA2.id, coAdminA.id, 5000, 'Tea', '2026-11-13').valid,
      false
    );
    // Member CAN create loan involving themselves
    assert.equal(
      validateLoanPayload(groupA, memberA, memberA.id, memberA2.id, 5000, 'Tea', '2026-11-13').valid,
      true
    );

    // Borrower cannot self-confirm loan repayment
    const loanInA: PersonalLoan = {
      id: 'loan-a1',
      groupId: groupA.id,
      borrowerId: memberA.id,
      borrowerName: memberA.name,
      lenderId: memberA2.id,
      lenderName: memberA2.name,
      originalAmount: 5000,
      remainingAmount: 5000,
      description: 'Taxi',
      date: '2026-11-13',
      status: 'active',
      repayments: [],
    };
    assert.equal(
      validateLoanRepaymentPayload(groupA, memberA, loanInA, 2000, '2026-11-13').valid,
      false
    );
    // Over-repayment rejected
    assert.equal(
      validateLoanRepaymentPayload(groupA, memberA2, loanInA, 6000, '2026-11-13').valid,
      false
    );
    // Lender partial repayment accepted
    const validRepay = validateLoanRepaymentPayload(groupA, memberA2, loanInA, 2000, '2026-11-13');
    assert.equal(validRepay.valid, true);
    if (validRepay.valid) {
      assert.equal(validRepay.data.newRemaining, 3000);
      assert.equal(validRepay.data.isSettled, false);
    }

    // Expense validation: rejects negative, NaN, cross-group participant, insufficient group fund
    assert.equal(
      validateExpensePayload(groupA, memberA, 10000, {
        amount: -500,
        description: 'Hack',
        date: '2026-11-13',
        sharedMemberIds: [memberA.id],
        paymentSource: 'group_fund',
        paidFromGroupFund: -500,
        paidPersonally: 0,
      }).valid,
      false
    );
    assert.equal(
      validateExpensePayload(groupA, memberA, 10000, {
        amount: 5000,
        description: 'Cross group member',
        date: '2026-11-13',
        sharedMemberIds: [memberA.id, adminB.id],
        paymentSource: 'group_fund',
        paidFromGroupFund: 5000,
        paidPersonally: 0,
      }).valid,
      false
    );
    assert.equal(
      validateExpensePayload(groupA, memberA, 10000, {
        amount: 25000,
        description: 'Overspend',
        date: '2026-11-13',
        sharedMemberIds: [memberA.id, memberA2.id],
        paymentSource: 'group_fund',
        paidFromGroupFund: 25000,
        paidPersonally: 0,
      }).valid,
      false
    );
  });

  await test('Input sanitization, prototype pollution defense & duplicate lock', () => {
    assert.equal(sanitizeText('<script>alert(1)</script>Groceries', 100), 'scriptalert(1)/scriptGroceries');
    assert.equal(sanitizeText('  أحمد علي  \u0000', 50), 'أحمد علي');
    assert.equal(sanitizePhone('0770-123-4567<script>'), '0770-123-4567');
    assert.equal(validateFinancialAmount(NaN).valid, false);
    assert.equal(validateFinancialAmount(Infinity).valid, false);
    assert.equal(validateFinancialAmount(-10).valid, false);
    assert.equal(validateFinancialAmount(1500.556).value, 1500.56);
    assert.match(validateIsoDate('not-a-date'), /^\d{4}-\d{2}-\d{2}$/);

    const poisoned = JSON.stringify([
      {
        id: 'grp-1',
        name: 'Test',
        code: 'RS-ABCDEF',
        mainAdminId: 'u1',
        currency: 'IQD',
        initialFund: 0,
        members: [],
        __proto__: { polluted: true },
      },
      { invalid: true },
    ]);
    const parsed = safeParseArray(poisoned, isValidGroup, []);
    assert.equal(parsed.length, 1);
    assert.equal(({} as Record<string, unknown>).polluted, undefined);

    resetActionLocks();
    assert.equal(claimActionLock('submit-1', 1000), true);
    assert.equal(claimActionLock('submit-1', 1000), false);
    resetActionLocks();
  });

  // 6. Financial Calculation Consistency & Settlement Security
  await test('Financial & loan calculations remain mathematically balanced and isolated', () => {
    const contribs: Contribution[] = [
      { id: 'c1', groupId: groupA.id, memberId: adminA.id, memberName: adminA.name, expectedAmount: 20000, confirmedAmount: 20000, status: 'fully_paid' },
      { id: 'c2', groupId: groupA.id, memberId: coAdminA.id, memberName: coAdminA.name, expectedAmount: 20000, confirmedAmount: 20000, status: 'fully_paid' },
      { id: 'c3', groupId: groupA.id, memberId: memberA.id, memberName: memberA.name, expectedAmount: 20000, confirmedAmount: 0, status: 'pending' },
      { id: 'c4', groupId: groupA.id, memberId: memberA2.id, memberName: memberA2.name, expectedAmount: 20000, confirmedAmount: 0, status: 'pending' },
    ];
    const exps: Expense[] = [
      {
        id: 'e1',
        groupId: groupA.id,
        amount: 40000,
        description: 'Dinner & Supplies',
        date: '2026-11-13',
        sharedMemberIds: [adminA.id, coAdminA.id, memberA.id, memberA2.id],
        paymentSource: 'group_fund',
        paidFromGroupFund: 40000,
        paidPersonally: 0,
        createdByMemberId: adminA.id,
        createdByName: adminA.name,
        createdAt: new Date().toISOString(),
      },
    ];
    const loans: PersonalLoan[] = [
      {
        id: 'l1',
        groupId: groupA.id,
        borrowerId: memberA.id,
        borrowerName: memberA.name,
        lenderId: adminA.id,
        lenderName: adminA.name,
        originalAmount: 15000,
        remainingAmount: 5000,
        description: 'Bus card',
        date: '2026-11-13',
        status: 'partially_repaid',
        repayments: [
          { id: 'r1', loanId: 'l1', amount: 10000, date: '2026-11-13', remainingAfter: 5000 },
        ],
      },
    ];
    const transfers: SettlementTransfer[] = [];

    const summary = calculateGroupFinancialSummary(groupA, contribs, exps, loans, transfers);
    assert.equal(summary.totalContributions, 40000);
    assert.equal(summary.totalExpenses, 40000);
    assert.equal(summary.remainingGroupFund, 0);
    assert.equal(summary.totalOwed, summary.totalReceivable);
    assert.equal(summary.totalOwed, 20000); // Ali & Zaid each owe 10,000; Abdullah & Hassan each receive 10,000

    // Settlement validation: debtor (memberA) cannot forge mark-paid for himself; creditor (adminA) can
    assert.equal(
      validateSettlementPayload(groupA, memberA, summary, memberA.id, adminA.id, 10000).valid,
      false
    );
    // Over-settlement exceeding balance is rejected
    assert.equal(
      validateSettlementPayload(groupA, adminA, summary, memberA.id, adminA.id, 50000).valid,
      false
    );
    // Exact valid settlement allowed
    assert.equal(
      validateSettlementPayload(groupA, adminA, summary, memberA.id, adminA.id, 10000).valid,
      true
    );

    const loanSummary = calculateGroupLoanSummary(groupA, loans);
    assert.equal(loanSummary.totalIssued, 15000);
    assert.equal(loanSummary.totalActiveDebt, 5000);
    assert.equal(loanSummary.totalRepaid, 10000);
    assert.equal(loanSummary.pairwiseBalances.length, 1);
    assert.equal(loanSummary.pairwiseBalances[0].amount, 5000);
  });

  console.log(`\nALL ${passed} SECURITY & FINANCIAL AUDIT TESTS PASSED`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
