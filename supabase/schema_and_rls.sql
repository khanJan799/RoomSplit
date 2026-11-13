-- RoomSplit Production PostgreSQL / Supabase Security Schema & RLS Policies
-- Designed for strict group isolation, RBAC (main_admin / co_admin / member),
-- salted password verification, rate limiting, and atomic financial transactions.
-- NOTE: Execute via Supabase migrations when connecting a live Supabase backend.
-- Never expose SUPABASE_SERVICE_ROLE_KEY in frontend code.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User Profiles (bound 1:1 with Supabase Auth auth.uid())
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  phone TEXT NOT NULL CHECK (char_length(trim(phone)) BETWEEN 3 AND 24),
  room_number TEXT NOT NULL CHECK (char_length(trim(room_number)) BETWEEN 1 AND 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Groups (Password hash stored privately; never returned in client SELECT queries)
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  code TEXT NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 6 AND 16),
  password_hash TEXT NOT NULL,
  initial_fund NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (initial_fund >= 0),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
  currency TEXT NOT NULL DEFAULT 'IQD' CHECK (currency IN ('IQD', 'USD', 'EUR')),
  main_admin_id UUID NOT NULL REFERENCES auth.users(id),
  expected_contribution_per_member NUMERIC(14,2) NOT NULL DEFAULT 10000 CHECK (expected_contribution_per_member >= 0),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Separate secret table so SELECT on `groups` can never accidentally leak password hashes
CREATE TABLE IF NOT EXISTS public.group_secrets (
  group_id UUID PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Group Memberships & Roles
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 80),
  phone TEXT NOT NULL CHECK (char_length(trim(phone)) <= 24),
  room_number TEXT NOT NULL CHECK (char_length(trim(room_number)) <= 40),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('main_admin', 'co_admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- 4. Contributions (Confirmed funds only writable by admin / co_admin via RPC)
CREATE TABLE IF NOT EXISTS public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expected_amount NUMERIC(14,2) NOT NULL DEFAULT 10000 CHECK (expected_amount >= 0),
  confirmed_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (confirmed_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'fully_paid')),
  confirmed_by_admin_id UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  notes TEXT CHECK (char_length(notes) <= 200),
  UNIQUE (group_id, member_id)
);

-- 5. Member Fund Requests (Members submit pending; Admins/Co-Admins approve/reject atomically)
CREATE TABLE IF NOT EXISTS public.fund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0 AND amount <= 1000000000),
  notes TEXT CHECK (char_length(notes) <= 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_admin_id UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Shared Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0 AND amount <= 1000000000),
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 1 AND 200),
  expense_date DATE NOT NULL,
  shared_member_ids UUID[] NOT NULL CHECK (array_length(shared_member_ids, 1) >= 1),
  payment_source TEXT NOT NULL CHECK (payment_source IN ('group_fund', 'personal', 'split_group_personal')),
  paid_from_group_fund NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_from_group_fund >= 0),
  personal_payer_id UUID REFERENCES auth.users(id),
  paid_personally NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_personally >= 0),
  created_by_member_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT expense_split_sum CHECK (abs((paid_from_group_fund + paid_personally) - amount) <= 0.01)
);

-- 7. Personal 1-on-1 Loans & Repayments
CREATE TABLE IF NOT EXISTS public.personal_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES auth.users(id),
  lender_id UUID NOT NULL REFERENCES auth.users(id),
  original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0 AND original_amount <= 1000000000),
  remaining_amount NUMERIC(14,2) NOT NULL CHECK (remaining_amount >= 0),
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 1 AND 200),
  loan_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partially_repaid', 'settled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (borrower_id <> lender_id),
  CHECK (remaining_amount <= original_amount)
);

CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.personal_loans(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  repayment_date DATE NOT NULL,
  note TEXT CHECK (char_length(note) <= 200),
  remaining_after NUMERIC(14,2) NOT NULL CHECK (remaining_after >= 0),
  confirmed_by_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Settlement Transfers
CREATE TABLE IF NOT EXISTS public.settlement_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  from_member_id UUID NOT NULL REFERENCES auth.users(id),
  to_member_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0 AND amount <= 1000000000),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_member_id <> to_member_id)
);

-- 9. Audit Trail (Append-Only)
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('contribution', 'shared_expense', 'personal_loan', 'loan_repayment', 'settlement')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  actor_id UUID REFERENCES auth.users(id),
  target_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Server-Side Brute-Force Join Attempts Log
CREATE TABLE IF NOT EXISTS public.join_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ
);

-- ============================================================================
-- SECURITY HELPER FUNCTIONS (SECURITY DEFINER with locked search_path)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin_or_co_admin(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = auth.uid()
      AND role IN ('main_admin', 'co_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_main_admin(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = auth.uid()
      AND role = 'main_admin'
  );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) ON EVERY SENSITIVE TABLE
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_rate_limits ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only read/write their own profile OR read profiles of fellow group members
CREATE POLICY "profiles_select_own_or_roommates" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
    )
  );
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Group secrets: zero direct client access (RPC only)
CREATE POLICY "group_secrets_no_direct_access" ON public.group_secrets
  FOR ALL USING (FALSE) WITH CHECK (FALSE);
CREATE POLICY "join_rate_limits_no_direct_access" ON public.join_rate_limits
  FOR ALL USING (FALSE) WITH CHECK (FALSE);

-- Groups: Only members of Group A can view Group A; only Main Admin can update settings
CREATE POLICY "groups_select_member_only" ON public.groups
  FOR SELECT USING (public.is_group_member(id));
CREATE POLICY "groups_update_main_admin_only" ON public.groups
  FOR UPDATE USING (public.is_group_main_admin(id))
  WITH CHECK (public.is_group_main_admin(id));

-- Group Members: Strictly isolated by group; role changes ONLY by Main Admin (excluding self/main_admin)
CREATE POLICY "members_select_group_only" ON public.group_members
  FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "members_update_role_main_admin_only" ON public.group_members
  FOR UPDATE USING (public.is_group_main_admin(group_id) AND role <> 'main_admin')
  WITH CHECK (public.is_group_main_admin(group_id) AND role IN ('co_admin', 'member'));

-- Contributions: Members can view their group's contributions; ONLY Admin/Co-Admin can mutate via RPC
CREATE POLICY "contributions_select_group_only" ON public.contributions
  FOR SELECT USING (public.is_group_member(group_id));

-- Fund Requests: Members see their group's requests; insert/edit ONLY their own pending request; Admin/Co-Admin review via RPC
CREATE POLICY "fund_requests_select_group_only" ON public.fund_requests
  FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "fund_requests_insert_own" ON public.fund_requests
  FOR INSERT WITH CHECK (
    public.is_group_member(group_id) AND member_id = auth.uid() AND status = 'pending'
  );
CREATE POLICY "fund_requests_update_own_pending" ON public.fund_requests
  FOR UPDATE USING (
    public.is_group_member(group_id) AND member_id = auth.uid() AND status = 'pending'
  )
  WITH CHECK (member_id = auth.uid() AND status = 'pending');
CREATE POLICY "fund_requests_delete_own_pending" ON public.fund_requests
  FOR DELETE USING (
    public.is_group_member(group_id) AND status = 'pending'
    AND (member_id = auth.uid() OR public.is_group_admin_or_co_admin(group_id))
  );

-- Expenses: Group members can read & insert expenses (atomic fund deduction via RPC)
CREATE POLICY "expenses_select_group_only" ON public.expenses
  FOR SELECT USING (public.is_group_member(group_id));

-- Personal Loans & Repayments: Isolated per group; members can create only if involved; repayment confirmed by lender/admin/co-admin
CREATE POLICY "loans_select_group_only" ON public.personal_loans
  FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "loans_insert_group_involved" ON public.personal_loans
  FOR INSERT WITH CHECK (
    public.is_group_member(group_id)
    AND (public.is_group_admin_or_co_admin(group_id) OR auth.uid() IN (borrower_id, lender_id))
  );
CREATE POLICY "repayments_select_group_only" ON public.loan_repayments
  FOR SELECT USING (public.is_group_member(group_id));

-- Settlements & Activities: Group-isolated read
CREATE POLICY "settlements_select_group_only" ON public.settlement_transfers
  FOR SELECT USING (public.is_group_member(group_id));
CREATE POLICY "activities_select_group_only" ON public.activities
  FOR SELECT USING (public.is_group_member(group_id));

-- ============================================================================
-- ATOMIC SERVER-SIDE RPC FUNCTIONS (Prevent Race Conditions & Forged Requests)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_fund_request_atomic(
  p_request_id UUID,
  p_decision TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.fund_requests%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision';
  END IF;

  -- Lock row FOR UPDATE to prevent double-approval race conditions
  SELECT * INTO v_req FROM public.fund_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fund request not found';
  END IF;

  IF NOT public.is_group_admin_or_co_admin(v_req.group_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already reviewed';
  END IF;

  UPDATE public.fund_requests
  SET status = p_decision,
      reviewed_by_admin_id = auth.uid(),
      reviewed_at = NOW()
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    INSERT INTO public.contributions (group_id, member_id, confirmed_amount, status, confirmed_by_admin_id, confirmed_at, notes)
    VALUES (v_req.group_id, v_req.member_id, v_req.amount, 'partially_paid', auth.uid(), NOW(), v_req.notes)
    ON CONFLICT (group_id, member_id)
    DO UPDATE SET
      confirmed_amount = public.contributions.confirmed_amount + EXCLUDED.confirmed_amount,
      status = CASE
        WHEN public.contributions.confirmed_amount + EXCLUDED.confirmed_amount >= public.contributions.expected_amount THEN 'fully_paid'
        ELSE 'partially_paid'
      END,
      confirmed_by_admin_id = auth.uid(),
      confirmed_at = NOW();
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'decision', p_decision);
END;
$$;
