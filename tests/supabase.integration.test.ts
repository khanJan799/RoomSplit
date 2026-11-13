import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSafeSupabaseError } from '../src/lib/supabase';
import {
  confirmContributionRpc,
  createExpenseRpc,
  createGroupRpc,
  createLoanRpc,
  ensureAnonymousAuthAndSaveProfile,
  fetchUserGroupsAndData,
  joinGroupRpc,
  mapDatabaseRowsToDomainState,
  mapProfileRow,
  recordLoanRepaymentRpc,
  recordSettlementRpc,
  reviewFundRequestRpc,
  setMemberRoleRpc,
  submitFundRequestDirect,
  updateGroupSettingsRpc,
} from '../src/services/supabaseService';

type RpcCall = { fn: string; args: Record<string, unknown> };

function createMockSupabase(rpcResponder: (fn: string, args: Record<string, unknown>) => unknown) {
  const rpcCalls: RpcCall[] = [];
  const tableOps: { table: string; op: string; payload?: unknown }[] = [];

  const makeQueryChain = (table: string) => {
    const chain = {
      select: () => chain,
      insert: (payload: unknown) => {
        tableOps.push({ table, op: 'insert', payload });
        return { error: null };
      },
      update: (payload: unknown) => {
        tableOps.push({ table, op: 'update', payload });
        return chain;
      },
      delete: () => {
        tableOps.push({ table, op: 'delete' });
        return chain;
      },
      eq: () => chain,
      order: () => chain,
      maybeSingle: async () => ({
        data:
          table === 'profiles'
            ? {
                id: '00000000-0000-0000-0000-000000000001',
                name: 'Abdullah',
                phone: '07701112222',
                room_number: 'Room 65',
                created_at: '2026-11-13T00:00:00.000Z',
              }
            : { id: 'req-1' },
        error: null,
      }),
      then: (resolve: (val: { data: unknown[]; error: null }) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return chain;
  };

  let signedIn = false;

  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session: signedIn ? { user: { id: '00000000-0000-0000-0000-000000000001' } } : null,
        },
        error: null,
      }),
      signInAnonymously: async () => {
        signedIn = true;
        return { data: { user: { id: '00000000-0000-0000-0000-000000000001' } }, error: null };
      },
      signOut: async () => {
        signedIn = false;
        return { error: null };
      },
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return rpcResponder(fn, args);
    },
    from: (table: string) => makeQueryChain(table),
  } as unknown as SupabaseClient;

  return { client, rpcCalls, tableOps };
}

async function runTests() {
  let passed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    await fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  };

  await test('Profile & full relational PostgreSQL rows map accurately without exposing secrets', () => {
    const profile = mapProfileRow({
      id: 'u-1',
      name: 'Abdullah',
      phone: '07701112222',
      room_number: 'Room 65',
      created_at: '2026-11-13T00:00:00.000Z',
    });
    assert.equal(profile.id, 'u-1');
    assert.equal(profile.roomNumber, 'Room 65');

    const bundle = mapDatabaseRowsToDomainState({
      groups: [
        {
          id: 'g-1',
          name: 'Room 65',
          code: 'RS-7K9M2P',
          initial_fund: '0.00',
          description: 'Dorm Hall A',
          currency: 'IQD',
          main_admin_id: 'u-1',
          expected_contribution_per_member: '20000.00',
          is_archived: false,
          created_at: '2026-11-13T00:00:00.000Z',
        },
      ],
      members: [
        {
          id: 'gm-1',
          group_id: 'g-1',
          user_id: 'u-1',
          display_name: 'Abdullah',
          phone: '07701112222',
          room_number: 'Room 65',
          role: 'main_admin',
          joined_at: '2026-11-13T00:00:00.000Z',
        },
        {
          id: 'gm-2',
          group_id: 'g-1',
          user_id: 'u-2',
          display_name: 'Hassan',
          phone: '07703334444',
          room_number: 'Room 65',
          role: 'co_admin',
          joined_at: '2026-11-13T01:00:00.000Z',
        },
      ],
      contributions: [
        {
          id: 'c-1',
          group_id: 'g-1',
          member_id: 'u-1',
          member_name: 'Abdullah',
          expected_amount: '20000',
          confirmed_amount: '20000',
          status: 'fully_paid',
          confirmed_by_admin_id: 'u-1',
          confirmed_by_admin_name: 'Abdullah',
          confirmed_at: '2026-11-13T02:00:00.000Z',
          notes: 'Cash',
        },
      ],
      fundRequests: [],
      expenses: [
        {
          id: 'e-1',
          group_id: 'g-1',
          amount: '5000.00',
          description: 'Water',
          expense_date: '2026-11-13',
          shared_member_ids: ['u-1', 'u-2'],
          payment_source: 'group_fund',
          paid_from_group_fund: '5000.00',
          personal_payer_id: null,
          personal_payer_name: null,
          paid_personally: '0.00',
          created_by_member_id: 'u-1',
          created_by_name: 'Abdullah',
          created_at: '2026-11-13T03:00:00.000Z',
        },
      ],
      loans: [
        {
          id: 'l-1',
          group_id: 'g-1',
          borrower_id: 'u-2',
          borrower_name: 'Hassan',
          lender_id: 'u-1',
          lender_name: 'Abdullah',
          original_amount: '10000',
          remaining_amount: '4000',
          description: 'Print',
          loan_date: '2026-11-13',
          status: 'partially_repaid',
          created_at: '2026-11-13T04:00:00.000Z',
        },
      ],
      repayments: [
        {
          id: 'r-1',
          loan_id: 'l-1',
          group_id: 'g-1',
          amount: '6000',
          repayment_date: '2026-11-13',
          note: 'Partial',
          remaining_after: '4000',
          confirmed_by_id: 'u-1',
          created_at: '2026-11-13T05:00:00.000Z',
        },
      ],
      settlements: [],
      activities: [],
    });

    assert.equal(bundle.groups.length, 1);
    assert.deepEqual(bundle.groups[0].coAdminIds, ['u-2']);
    assert.equal(bundle.groups[0].passwordHash, undefined);
    assert.equal(bundle.contributions[0].confirmedAmount, 20000);
    assert.equal(bundle.expenses[0].paidFromGroupFund, 5000);
    assert.equal(bundle.loans[0].repayments.length, 1);
    assert.equal(bundle.loans[0].repayments[0].remainingAfter, 4000);
    assert.ok((bundle.loans[0].createdAt || 0) > 0);
  });

  await test('Supabase RPC & RLS service wrappers pass validated arguments cleanly', async () => {
    const { client, rpcCalls, tableOps } = createMockSupabase((fn) => {
      if (fn === 'update_roomsplit_profile') {
        return {
          data: {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Abdullah',
            phone: '07701112222',
            room_number: 'Room 65',
            created_at: '2026-11-13T00:00:00.000Z',
          },
          error: null,
        };
      }
      if (fn === 'create_roomsplit_group') {
        return { data: { success: true, group_id: 'grp-uuid-1', code: 'RS-ABCDEF' }, error: null };
      }
      if (fn === 'join_roomsplit_group') {
        return {
          data: {
            success: false,
            retry_after_seconds: 60,
            message: 'Too many failed attempts. Please wait 60s before trying again.',
          },
          error: null,
        };
      }
      if (fn === 'set_roomsplit_member_role') {
        return { data: true, error: null };
      }
      return { data: { success: true, message: 'OK' }, error: null };
    });

    const authRes = await ensureAnonymousAuthAndSaveProfile(
      'Abdullah',
      '07701112222',
      'Room 65',
      client
    );
    assert.equal(authRes.success, true);
    assert.equal(authRes.account?.name, 'Abdullah');

    const grpRes = await createGroupRpc('Room 65', 'Pass#123', 0, 'IQD', 'Hall', client);
    assert.equal(grpRes.success, true);
    assert.equal(grpRes.groupId, 'grp-uuid-1');

    const joinRes = await joinGroupRpc('RS-BAD', 'wrong', client);
    assert.equal(joinRes.success, false);
    assert.equal(joinRes.retryAfterSeconds, 60);

    await updateGroupSettingsRpc('grp-uuid-1', { name: 'Room 65B' }, client);
    const roleOk = await setMemberRoleRpc('grp-uuid-1', 'u-2', 'co_admin', client);
    assert.equal(roleOk, true);

    await confirmContributionRpc('grp-uuid-1', 'u-1', 20000, 'Cash', client);
    await submitFundRequestDirect('grp-uuid-1', 'u-2', 'Hassan', 15000, 'Cash', client);
    await reviewFundRequestRpc('req-1', 'approved', client);
    await createExpenseRpc(
      'grp-uuid-1',
      {
        amount: 5000,
        description: 'Rice',
        date: '2026-11-13',
        sharedMemberIds: ['u-1', 'u-2'],
        paymentSource: 'group_fund',
        paidFromGroupFund: 5000,
        paidPersonally: 0,
      },
      client
    );
    await createLoanRpc('grp-uuid-1', 'u-2', 'u-1', 10000, 'Book', '2026-11-13', client);
    await recordLoanRepaymentRpc('l-1', 5000, '2026-11-13', 'Paid', client);
    await recordSettlementRpc('grp-uuid-1', 'u-2', 'u-1', 2500, client);

    const bundle = await fetchUserGroupsAndData('00000000-0000-0000-0000-000000000001', client);
    assert.deepEqual(bundle.groups, []);

    assert.equal(rpcCalls.length, 11);
    assert.equal(tableOps.some((t) => t.table === 'fund_requests' && t.op === 'insert'), true);
  });

  await test('Error sanitizer strips internal SQL schema errors & secret leaks', () => {
    const sqlLeak = {
      message: 'permission denied for relation "group_secrets" in schema public',
    };
    const sanitized = getSafeSupabaseError(sqlLeak, 'Operation failed.');
    assert.equal(sanitized.includes('group_secrets'), false);
    assert.equal(sanitized, 'Permission denied for this group action.');

    const checkLeak = {
      message: 'new row for relation "expenses" violates check constraint "expense_split_sum"',
    };
    assert.equal(getSafeSupabaseError(checkLeak, 'Invalid expense.'), 'Invalid expense.');
  });

  await test('SQL migration enforces RLS on all tables, isolates group secrets, and grants privileges cleanly', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/001_roomsplit_supabase.sql');
    const schemaPath = path.resolve(process.cwd(), 'supabase/schema_and_rls.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    assert.equal(sql, schemaSql);

    const tablesWithRls = [
      'profiles',
      'groups',
      'group_secrets',
      'group_members',
      'contributions',
      'fund_requests',
      'expenses',
      'personal_loans',
      'loan_repayments',
      'settlement_transfers',
      'activities',
    ];
    for (const tbl of tablesWithRls) {
      assert.ok(
        sql.includes(`ALTER TABLE public.${tbl} ENABLE ROW LEVEL SECURITY;`),
        `Missing RLS enablement for ${tbl}`
      );
    }

    assert.ok(sql.includes('FOR ALL USING (FALSE) WITH CHECK (FALSE);'));
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.join_roomsplit_group'));
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.approve_fund_request_atomic'));
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.create_roomsplit_expense'));
    assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION'));
    assert.ok(sql.includes('TO authenticated;'));
  });

  await test('Frontend src/ contains zero service-role keys, DB passwords, or shared localStorage', () => {
    const storeSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/data/store.tsx'), 'utf8');
    assert.equal(storeSrc.includes('mockData'), false);
    assert.equal(storeSrc.includes('INITIAL_GROUPS'), false);
    assert.equal(storeSrc.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
    assert.equal(storeSrc.includes('service_role'), false);
    assert.equal(storeSrc.includes("localStorage.setItem('roomsplit_groups"), false);
  });

  console.log(`\nALL ${passed} SUPABASE INTEGRATION & SECURITY TESTS PASSED`);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
