-- ============================================================================
-- RoomSplit Supabase Schema, RLS Policies & RPC Functions
-- Simple, reliable PostgreSQL setup for student roommate expense & fund groups
-- Run once in Supabase Dashboard -> SQL Editor (or `supabase db push`)
-- Prerequisite: Enable "Anonymous Sign-Ins" in Supabase Authentication -> Providers
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User Profiles (1:1 with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  phone TEXT NOT NULL CHECK (char_length(trim(phone)) BETWEEN 1 AND 24),
  room_number TEXT NOT NULL CHECK (char_length(trim(room_number)) BETWEEN 1 AND 40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Groups (Public metadata — password hashes stored separately in group_secrets)
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  code TEXT NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 4 AND 20),
  initial_fund NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (initial_fund >= 0),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 200),
  currency TEXT NOT NULL DEFAULT 'IQD' CHECK (currency IN ('IQD', 'USD', 'EUR')),
  main_admin_id UUID NOT NULL REFERENCES auth.users(id),
  expected_contribution_per_member NUMERIC(14,2) NOT NULL DEFAULT 10000 CHECK (expected_contribution_per_member >= 0),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Group Password Hashes (Isolated from direct client queries)
CREATE TABLE IF NOT EXISTS public.group_secrets (
  group_id UUID PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Group Members & Roles (main_admin | co_admin | member)
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

CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);

-- 5. Contributions (Total confirmed money given by each member)
CREATE TABLE IF NOT EXISTS public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  expected_amount NUMERIC(14,2) NOT NULL DEFAULT 10000 CHECK (expected_amount >= 0),
  confirmed_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (confirmed_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'fully_paid')),
  confirmed_by_admin_id UUID REFERENCES auth.users(id),
  confirmed_by_admin_name TEXT,
  confirmed_at TIMESTAMPTZ,
  notes TEXT CHECK (char_length(notes) <= 200),
  UNIQUE (group_id, member_id)
);

-- 6. Member Fund Approval Requests
CREATE TABLE IF NOT EXISTS public.fund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0 AND amount <= 1000000000),
  notes TEXT CHECK (char_length(notes) <= 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reviewed_by_admin_id UUID REFERENCES auth.users(id),
  reviewed_by_admin_name TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_requests_group_id ON public.fund_requests(group_id);

-- 7. Shared Expenses
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
  personal_payer_name TEXT,
  paid_personally NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_personally >= 0),
  created_by_member_id UUID NOT NULL REFERENCES auth.users(id),
  created_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT expense_split_sum CHECK (abs((paid_from_group_fund + paid_personally) - amount) <= 0.01)
);

CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON public.expenses(group_id);

-- 8. Personal 1-on-1 Loans & Repayments
CREATE TABLE IF NOT EXISTS public.personal_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES auth.users(id),
  borrower_name TEXT NOT NULL,
  lender_id UUID NOT NULL REFERENCES auth.users(id),
  lender_name TEXT NOT NULL,
  original_amount NUMERIC(14,2) NOT NULL CHECK (original_amount > 0 AND original_amount <= 1000000000),
  remaining_amount NUMERIC(14,2) NOT NULL CHECK (remaining_amount >= 0),
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 1 AND 200),
  loan_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partially_repaid', 'settled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (borrower_id <> lender_id),
  CHECK (remaining_amount <= original_amount)
);

CREATE INDEX IF NOT EXISTS idx_personal_loans_group_id ON public.personal_loans(group_id);

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

-- 9. Settlement Transfers
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

-- 10. Group Activity / History Log
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('contribution', 'shared_expense', 'personal_loan', 'loan_repayment', 'settlement')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  actor_name TEXT NOT NULL,
  target_name TEXT,
  activity_date TEXT NOT NULL DEFAULT 'Just now',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_group_id ON public.activities(group_id);

-- ============================================================================
-- HELPER FUNCTIONS FOR GROUP ISOLATION & ROLES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
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
SET search_path = public, extensions
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
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = auth.uid()
      AND role = 'main_admin'
  );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — STRICT GROUP ISOLATION
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

-- Profiles: Users manage their own profile and can view roommates in shared groups
DROP POLICY IF EXISTS "profiles_select_own_or_roommates" ON public.profiles;
CREATE POLICY "profiles_select_own_or_roommates" ON public.profiles
  FOR SELECT USING (
    id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.group_members gm1
      JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Group Secrets: Never directly readable or writable by clients
DROP POLICY IF EXISTS "group_secrets_no_direct_access" ON public.group_secrets;
CREATE POLICY "group_secrets_no_direct_access" ON public.group_secrets
  FOR ALL USING (FALSE) WITH CHECK (FALSE);

-- Groups & Members: Strictly isolated to members of that group
DROP POLICY IF EXISTS "groups_select_member_only" ON public.groups;
CREATE POLICY "groups_select_member_only" ON public.groups
  FOR SELECT USING (public.is_group_member(id));

DROP POLICY IF EXISTS "members_select_group_only" ON public.group_members;
CREATE POLICY "members_select_group_only" ON public.group_members
  FOR SELECT USING (public.is_group_member(group_id));

-- Contributions
DROP POLICY IF EXISTS "contributions_select_group_only" ON public.contributions;
CREATE POLICY "contributions_select_group_only" ON public.contributions
  FOR SELECT USING (public.is_group_member(group_id));

-- Fund Requests: Members can view group requests and create/edit/cancel their own pending ones
DROP POLICY IF EXISTS "fund_requests_select_group_only" ON public.fund_requests;
CREATE POLICY "fund_requests_select_group_only" ON public.fund_requests
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "fund_requests_insert_own" ON public.fund_requests;
CREATE POLICY "fund_requests_insert_own" ON public.fund_requests
  FOR INSERT WITH CHECK (
    public.is_group_member(group_id) AND member_id = auth.uid() AND status = 'pending'
  );

DROP POLICY IF EXISTS "fund_requests_update_own_pending" ON public.fund_requests;
CREATE POLICY "fund_requests_update_own_pending" ON public.fund_requests
  FOR UPDATE USING (
    public.is_group_member(group_id) AND member_id = auth.uid() AND status = 'pending'
  )
  WITH CHECK (member_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "fund_requests_delete_own_pending" ON public.fund_requests;
CREATE POLICY "fund_requests_delete_own_pending" ON public.fund_requests
  FOR DELETE USING (
    public.is_group_member(group_id) AND status = 'pending'
    AND (member_id = auth.uid() OR public.is_group_admin_or_co_admin(group_id))
  );

-- Expenses, Loans, Repayments, Settlements, Activities: Isolated per group
DROP POLICY IF EXISTS "expenses_select_group_only" ON public.expenses;
CREATE POLICY "expenses_select_group_only" ON public.expenses
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "loans_select_group_only" ON public.personal_loans;
CREATE POLICY "loans_select_group_only" ON public.personal_loans
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "repayments_select_group_only" ON public.loan_repayments;
CREATE POLICY "repayments_select_group_only" ON public.loan_repayments
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "settlements_select_group_only" ON public.settlement_transfers;
CREATE POLICY "settlements_select_group_only" ON public.settlement_transfers
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS "activities_select_group_only" ON public.activities;
CREATE POLICY "activities_select_group_only" ON public.activities
  FOR SELECT USING (public.is_group_member(group_id));

-- ============================================================================
-- RPC FUNCTIONS FOR RELIABLE APP OPERATIONS
-- ============================================================================

-- A. Save / Update User Profile (Name, Phone, Room Number)
CREATE OR REPLACE FUNCTION public.update_roomsplit_profile(
  p_name TEXT,
  p_phone TEXT,
  p_room_number TEXT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := left(regexp_replace(trim(coalesce(p_name, '')), '[<>]', '', 'g'), 80);
  v_phone TEXT := left(regexp_replace(trim(coalesce(p_phone, '')), '[^0-9+\-\s()]', '', 'g'), 24);
  v_room TEXT := left(regexp_replace(trim(coalesce(p_room_number, '')), '[<>]', '', 'g'), 40);
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF char_length(v_name) < 1 OR char_length(v_phone) < 1 OR char_length(v_room) < 1 THEN
    RAISE EXCEPTION 'Name, phone, and room number are required';
  END IF;

  INSERT INTO public.profiles (id, name, phone, room_number)
  VALUES (v_uid, v_name, v_phone, v_room)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    room_number = EXCLUDED.room_number,
    updated_at = NOW()
  RETURNING * INTO v_profile;

  UPDATE public.group_members
  SET display_name = v_name, phone = v_phone, room_number = v_room
  WHERE user_id = v_uid;

  UPDATE public.contributions SET member_name = v_name WHERE member_id = v_uid;
  UPDATE public.fund_requests SET member_name = v_name WHERE member_id = v_uid;

  RETURN v_profile;
END;
$$;

-- B. Create Group + Set Password + Add Creator as Main Admin
CREATE OR REPLACE FUNCTION public.create_roomsplit_group(
  p_name TEXT,
  p_password TEXT,
  p_initial_fund NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'IQD',
  p_description TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_name TEXT := left(regexp_replace(trim(coalesce(p_name, '')), '[<>]', '', 'g'), 80);
  v_desc TEXT := left(regexp_replace(trim(coalesce(p_description, '')), '[<>]', '', 'g'), 200);
  v_pass TEXT := trim(coalesce(p_password, ''));
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  v_bytes BYTEA;
  v_i INT;
  v_group_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Please create your profile account first';
  END IF;
  IF char_length(v_name) < 1 THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;
  IF char_length(v_pass) < 4 OR char_length(v_pass) > 128 THEN
    RAISE EXCEPTION 'Password must be between 4 and 128 characters';
  END IF;
  IF p_currency NOT IN ('IQD', 'USD', 'EUR') THEN
    RAISE EXCEPTION 'Invalid currency';
  END IF;
  IF coalesce(p_initial_fund, 0) < 0 OR coalesce(p_initial_fund, 0) > 1000000000 THEN
    RAISE EXCEPTION 'Invalid initial fund';
  END IF;

  -- Generate unique RS-XXXXXX join code
  LOOP
    v_bytes := gen_random_bytes(6);
    v_code := 'RS-';
    FOR v_i IN 0..5 LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % 32) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE code = v_code);
  END LOOP;

  INSERT INTO public.groups (name, code, initial_fund, description, currency, main_admin_id)
  VALUES (v_name, v_code, coalesce(p_initial_fund, 0), v_desc, p_currency, v_uid)
  RETURNING id INTO v_group_id;

  INSERT INTO public.group_secrets (group_id, password_hash)
  VALUES (v_group_id, crypt(v_pass, gen_salt('bf', 8)));

  INSERT INTO public.group_members (group_id, user_id, display_name, phone, room_number, role)
  VALUES (v_group_id, v_uid, v_profile.name, v_profile.phone, v_profile.room_number, 'main_admin');

  INSERT INTO public.contributions (group_id, member_id, member_name, expected_amount, confirmed_amount, status)
  VALUES (v_group_id, v_uid, v_profile.name, 10000, 0, 'pending');

  INSERT INTO public.activities (group_id, type, title, description, amount, actor_name, activity_date)
  VALUES (
    v_group_id,
    'settlement',
    'Room Created',
    v_profile.name || ' created ' || v_name,
    coalesce(p_initial_fund, 0),
    v_profile.name,
    CURRENT_DATE::TEXT
  );

  RETURN jsonb_build_object('success', TRUE, 'group_id', v_group_id, 'code', v_code, 'name', v_name);
END;
$$;

-- C. Join Group Using Room Code & Password
CREATE OR REPLACE FUNCTION public.join_roomsplit_group(
  p_code TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_clean_code TEXT := upper(trim(coalesce(p_code, '')));
  v_formatted_code TEXT;
  v_pass TEXT := trim(coalesce(p_password, ''));
  v_group public.groups%ROWTYPE;
  v_secret public.group_secrets%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Please create an account first to join the room.');
  END IF;

  v_formatted_code := CASE WHEN v_clean_code LIKE 'RS-%' THEN v_clean_code ELSE 'RS-' || v_clean_code END;

  SELECT * INTO v_group FROM public.groups WHERE upper(code) IN (v_formatted_code, v_clean_code) LIMIT 1;
  IF v_group.id IS NOT NULL THEN
    SELECT * INTO v_secret FROM public.group_secrets WHERE group_id = v_group.id;
  END IF;

  IF v_group.id IS NULL OR v_secret.password_hash IS NULL OR v_secret.password_hash <> crypt(v_pass, v_secret.password_hash) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid room code or password.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = v_group.id AND user_id = v_uid) THEN
    INSERT INTO public.group_members (group_id, user_id, display_name, phone, room_number, role)
    VALUES (v_group.id, v_uid, v_profile.name, v_profile.phone, v_profile.room_number, 'member');

    INSERT INTO public.contributions (group_id, member_id, member_name, expected_amount, confirmed_amount, status)
    VALUES (v_group.id, v_uid, v_profile.name, coalesce(v_group.expected_contribution_per_member, 10000), 0, 'pending')
    ON CONFLICT (group_id, member_id) DO NOTHING;

    INSERT INTO public.activities (group_id, type, title, description, amount, actor_name, activity_date)
    VALUES (
      v_group.id,
      'settlement',
      'New Member Joined',
      v_profile.name || ' (' || v_profile.room_number || ') joined the room',
      0,
      v_profile.name,
      CURRENT_DATE::TEXT
    );
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'group_id', v_group.id, 'name', v_group.name, 'code', v_group.code);
END;
$$;

-- D. Main Admin: Update Group Settings
CREATE OR REPLACE FUNCTION public.update_roomsplit_group_settings(
  p_group_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_new_password TEXT DEFAULT NULL,
  p_expected_contribution NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_name TEXT;
  v_desc TEXT;
  v_pass TEXT;
  v_target NUMERIC(14,2);
BEGIN
  IF NOT public.is_group_main_admin(p_group_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Only the Main Admin can update group settings.');
  END IF;

  IF p_name IS NOT NULL THEN
    v_name := left(regexp_replace(trim(p_name), '[<>]', '', 'g'), 80);
    IF char_length(v_name) < 1 THEN
      RETURN jsonb_build_object('success', FALSE, 'message', 'Group name cannot be empty.');
    END IF;
    UPDATE public.groups SET name = v_name WHERE id = p_group_id;
  END IF;

  IF p_description IS NOT NULL THEN
    v_desc := left(regexp_replace(trim(p_description), '[<>]', '', 'g'), 200);
    UPDATE public.groups SET description = v_desc WHERE id = p_group_id;
  END IF;

  IF p_expected_contribution IS NOT NULL THEN
    IF p_expected_contribution < 0 OR p_expected_contribution > 1000000000 THEN
      RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid contribution target.');
    END IF;
    v_target := round(p_expected_contribution, 2);
    UPDATE public.groups SET expected_contribution_per_member = v_target WHERE id = p_group_id;
    UPDATE public.contributions
    SET expected_amount = v_target,
        status = CASE
          WHEN confirmed_amount >= v_target AND v_target > 0 THEN 'fully_paid'
          WHEN confirmed_amount > 0 THEN 'partially_paid'
          ELSE 'pending'
        END
    WHERE group_id = p_group_id;
  END IF;

  IF p_new_password IS NOT NULL AND char_length(trim(p_new_password)) > 0 THEN
    v_pass := trim(p_new_password);
    IF char_length(v_pass) < 4 OR char_length(v_pass) > 128 THEN
      RETURN jsonb_build_object('success', FALSE, 'message', 'Password must be at least 4 characters long.');
    END IF;
    UPDATE public.group_secrets
    SET password_hash = crypt(v_pass, gen_salt('bf', 8)),
        updated_at = NOW()
    WHERE group_id = p_group_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- E. Main Admin: Appoint Co-Admin or Demote to Member
CREATE OR REPLACE FUNCTION public.set_roomsplit_member_role(
  p_group_id UUID,
  p_target_user_id UUID,
  p_role TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_main_admin UUID;
BEGIN
  IF NOT public.is_group_main_admin(p_group_id) THEN
    RETURN FALSE;
  END IF;
  IF p_role NOT IN ('co_admin', 'member') THEN
    RETURN FALSE;
  END IF;
  SELECT main_admin_id INTO v_main_admin FROM public.groups WHERE id = p_group_id;
  IF v_main_admin IS NULL OR p_target_user_id = v_main_admin THEN
    RETURN FALSE;
  END IF;

  UPDATE public.group_members
  SET role = p_role
  WHERE group_id = p_group_id AND user_id = p_target_user_id;

  RETURN FOUND;
END;
$$;

-- F. Admin / Co-Admin: Add Funds Directly for Self or Member
CREATE OR REPLACE FUNCTION public.confirm_roomsplit_contribution(
  p_group_id UUID,
  p_member_id UUID,
  p_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_reviewer public.group_members%ROWTYPE;
  v_target public.group_members%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_amount NUMERIC(14,2) := round(coalesce(p_amount, 0), 2);
  v_notes TEXT := nullif(left(regexp_replace(trim(coalesce(p_notes, '')), '[<>]', '', 'g'), 200), '');
  v_role_tag TEXT;
BEGIN
  IF NOT public.is_group_admin_or_co_admin(p_group_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Members cannot directly add funds. Please submit a fund request for Admin approval.');
  END IF;
  IF v_amount <= 0 OR v_amount > 1000000000 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Please enter a valid contribution amount.');
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id FOR UPDATE;
  SELECT * INTO v_reviewer FROM public.group_members WHERE group_id = p_group_id AND user_id = v_uid;
  SELECT * INTO v_target FROM public.group_members WHERE group_id = p_group_id AND user_id = p_member_id;
  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Member not found in this group.');
  END IF;

  INSERT INTO public.contributions (
    group_id, member_id, member_name, expected_amount, confirmed_amount, status,
    confirmed_by_admin_id, confirmed_by_admin_name, confirmed_at, notes
  )
  VALUES (
    p_group_id, v_target.user_id, v_target.display_name, coalesce(v_group.expected_contribution_per_member, 10000),
    v_amount,
    CASE WHEN v_amount >= coalesce(v_group.expected_contribution_per_member, 10000) THEN 'fully_paid' ELSE 'partially_paid' END,
    v_reviewer.user_id, v_reviewer.display_name, NOW(), v_notes
  )
  ON CONFLICT (group_id, member_id) DO UPDATE SET
    member_name = EXCLUDED.member_name,
    confirmed_amount = public.contributions.confirmed_amount + EXCLUDED.confirmed_amount,
    status = CASE
      WHEN public.contributions.confirmed_amount + EXCLUDED.confirmed_amount >= public.contributions.expected_amount THEN 'fully_paid'
      ELSE 'partially_paid'
    END,
    confirmed_by_admin_id = v_reviewer.user_id,
    confirmed_by_admin_name = v_reviewer.display_name,
    confirmed_at = NOW(),
    notes = coalesce(EXCLUDED.notes, public.contributions.notes);

  v_role_tag := CASE WHEN v_reviewer.role = 'main_admin' THEN 'Admin' ELSE 'Co-Admin' END;
  INSERT INTO public.activities (group_id, type, title, description, amount, actor_name, target_name, activity_date)
  VALUES (
    p_group_id,
    'contribution',
    'Fund Added',
    v_target.display_name || ' gave ' || v_amount::TEXT || ' ' || v_group.currency || coalesce(' (' || v_notes || ')', ''),
    v_amount,
    v_target.display_name,
    v_reviewer.display_name || ' (' || v_role_tag || ')',
    CURRENT_DATE::TEXT
  );

  RETURN jsonb_build_object('success', TRUE, 'message', 'Added ' || v_amount::TEXT || ' ' || v_group.currency || ' from ' || v_target.display_name || '!');
END;
$$;

-- G. Admin / Co-Admin: Approve or Decline Member Fund Request
CREATE OR REPLACE FUNCTION public.approve_fund_request_atomic(
  p_request_id UUID,
  p_decision TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_req public.fund_requests%ROWTYPE;
  v_reviewer public.group_members%ROWTYPE;
  v_target public.group_members%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_role_tag TEXT;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid decision.');
  END IF;

  SELECT * INTO v_req FROM public.fund_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Fund request not found.');
  END IF;

  IF NOT public.is_group_admin_or_co_admin(v_req.group_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Permission denied: Only Main Admin or Co-Admin can approve fund requests.');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'This request has already been reviewed.');
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = v_req.group_id FOR UPDATE;
  SELECT * INTO v_reviewer FROM public.group_members WHERE group_id = v_req.group_id AND user_id = v_uid;
  SELECT * INTO v_target FROM public.group_members WHERE group_id = v_req.group_id AND user_id = v_req.member_id;
  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Requesting member is no longer in this group.');
  END IF;

  UPDATE public.fund_requests
  SET status = p_decision,
      reviewed_by_admin_id = v_reviewer.user_id,
      reviewed_by_admin_name = v_reviewer.display_name,
      reviewed_at = NOW()
  WHERE id = p_request_id;

  IF p_decision = 'approved' THEN
    INSERT INTO public.contributions (
      group_id, member_id, member_name, expected_amount, confirmed_amount, status,
      confirmed_by_admin_id, confirmed_by_admin_name, confirmed_at, notes
    )
    VALUES (
      v_req.group_id, v_target.user_id, v_target.display_name, coalesce(v_group.expected_contribution_per_member, 10000),
      v_req.amount,
      CASE WHEN v_req.amount >= coalesce(v_group.expected_contribution_per_member, 10000) THEN 'fully_paid' ELSE 'partially_paid' END,
      v_reviewer.user_id, v_reviewer.display_name, NOW(), v_req.notes
    )
    ON CONFLICT (group_id, member_id) DO UPDATE SET
      member_name = EXCLUDED.member_name,
      confirmed_amount = public.contributions.confirmed_amount + EXCLUDED.confirmed_amount,
      status = CASE
        WHEN public.contributions.confirmed_amount + EXCLUDED.confirmed_amount >= public.contributions.expected_amount THEN 'fully_paid'
        ELSE 'partially_paid'
      END,
      confirmed_by_admin_id = v_reviewer.user_id,
      confirmed_by_admin_name = v_reviewer.display_name,
      confirmed_at = NOW(),
      notes = coalesce(EXCLUDED.notes, public.contributions.notes);

    v_role_tag := CASE WHEN v_reviewer.role = 'main_admin' THEN 'Admin' ELSE 'Co-Admin' END;
    INSERT INTO public.activities (group_id, type, title, description, amount, actor_name, target_name, activity_date)
    VALUES (
      v_req.group_id,
      'contribution',
      'Fund Added',
      v_target.display_name || ' gave ' || v_req.amount::TEXT || ' ' || v_group.currency || coalesce(' (' || v_req.notes || ')', ''),
      v_req.amount,
      v_target.display_name,
      v_reviewer.display_name || ' (' || v_role_tag || ')',
      CURRENT_DATE::TEXT
    );

    RETURN jsonb_build_object('success', TRUE, 'message', 'Approved ' || v_req.amount::TEXT || ' ' || v_group.currency || ' from ' || v_target.display_name || '!');
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'message', 'Declined ' || v_target.display_name || '''s request.');
END;
$$;

-- H. Add Shared Expense (Checks Remaining Group Fund Balance & Group Membership)
CREATE OR REPLACE FUNCTION public.create_roomsplit_expense(
  p_group_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_expense_date DATE,
  p_shared_member_ids UUID[],
  p_payment_source TEXT,
  p_paid_from_group_fund NUMERIC,
  p_personal_payer_id UUID DEFAULT NULL,
  p_paid_personally NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_group public.groups%ROWTYPE;
  v_creator public.group_members%ROWTYPE;
  v_payer public.group_members%ROWTYPE;
  v_amount NUMERIC(14,2) := round(coalesce(p_amount, 0), 2);
  v_from_fund NUMERIC(14,2) := round(coalesce(p_paid_from_group_fund, 0), 2);
  v_personal NUMERIC(14,2) := round(coalesce(p_paid_personally, 0), 2);
  v_desc TEXT := left(regexp_replace(trim(coalesce(p_description, '')), '[<>]', '', 'g'), 200);
  v_unique_ids UUID[];
  v_total_collected NUMERIC(14,2);
  v_total_spent_fund NUMERIC(14,2);
  v_remaining_fund NUMERIC(14,2);
  v_act_desc TEXT;
BEGIN
  IF NOT public.is_group_member(p_group_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Permission denied.');
  END IF;
  IF v_amount <= 0 OR v_amount > 1000000000 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Expense amount must be greater than zero.');
  END IF;
  IF char_length(v_desc) < 1 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Please enter what the expense was for.');
  END IF;
  IF p_payment_source NOT IN ('group_fund', 'personal', 'split_group_personal') THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid payment source.');
  END IF;

  IF p_payment_source = 'group_fund' THEN
    v_from_fund := v_amount;
    v_personal := 0;
  ELSIF p_payment_source = 'personal' THEN
    v_from_fund := 0;
    v_personal := v_amount;
  ELSIF v_from_fund < 0 OR v_personal < 0 OR abs((v_from_fund + v_personal) - v_amount) > 0.01 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Fund portion plus personal portion must equal the total amount.');
  END IF;

  SELECT array_agg(DISTINCT x) INTO v_unique_ids FROM unnest(p_shared_member_ids) AS x WHERE x IS NOT NULL;
  IF v_unique_ids IS NULL OR array_length(v_unique_ids, 1) < 1 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Please select at least one roommate sharing this expense.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_unique_ids) AS sid
    WHERE NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = p_group_id AND user_id = sid)
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'All shared participants must belong to this group.');
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id FOR UPDATE;
  SELECT * INTO v_creator FROM public.group_members WHERE group_id = p_group_id AND user_id = v_uid;

  IF v_personal > 0 THEN
    SELECT * INTO v_payer FROM public.group_members WHERE group_id = p_group_id AND user_id = p_personal_payer_id;
    IF v_payer.id IS NULL THEN
      RETURN jsonb_build_object('success', FALSE, 'message', 'Selected payer does not belong to this group.');
    END IF;
  END IF;

  IF v_from_fund > 0 THEN
    SELECT coalesce(sum(confirmed_amount), 0) INTO v_total_collected FROM public.contributions WHERE group_id = p_group_id;
    SELECT coalesce(sum(paid_from_group_fund), 0) INTO v_total_spent_fund FROM public.expenses WHERE group_id = p_group_id;
    v_remaining_fund := coalesce(v_group.initial_fund, 0) + v_total_collected - v_total_spent_fund;

    IF v_from_fund > v_remaining_fund + 0.01 THEN
      RETURN jsonb_build_object(
        'success', FALSE,
        'message', 'Insufficient group funds: Remaining fund is only ' || v_remaining_fund::TEXT || ' ' || v_group.currency || '.'
      );
    END IF;
  END IF;

  INSERT INTO public.expenses (
    group_id, amount, description, expense_date, shared_member_ids, payment_source,
    paid_from_group_fund, personal_payer_id, personal_payer_name, paid_personally,
    created_by_member_id, created_by_name
  )
  VALUES (
    p_group_id, v_amount, v_desc, coalesce(p_expense_date, CURRENT_DATE), v_unique_ids, p_payment_source,
    v_from_fund, v_payer.user_id, v_payer.display_name, v_personal,
    v_creator.user_id, v_creator.display_name
  );

  IF p_payment_source = 'group_fund' THEN
    v_act_desc := 'Paid from group fund (' || v_amount::TEXT || ' ' || v_group.currency || ')';
  ELSIF p_payment_source = 'personal' THEN
    v_act_desc := 'Paid personally by ' || coalesce(v_payer.display_name, v_creator.display_name);
  ELSE
    v_act_desc := 'Paid: ' || v_from_fund::TEXT || ' from group fund + ' || v_personal::TEXT || ' by ' || coalesce(v_payer.display_name, v_creator.display_name);
  END IF;

  INSERT INTO public.activities (group_id, type, title, description, amount, actor_name, activity_date)
  VALUES (
    p_group_id,
    'shared_expense',
    v_desc,
    v_act_desc,
    v_amount,
    coalesce(v_payer.display_name, v_creator.display_name),
    coalesce(p_expense_date, CURRENT_DATE)::TEXT
  );

  RETURN jsonb_build_object('success', TRUE, 'message', 'Saved: ' || v_desc || ' (' || v_amount::TEXT || ' ' || v_group.currency || ')');
END;
$$;

-- I. Record Personal 1-on-1 Loan
CREATE OR REPLACE FUNCTION public.create_roomsplit_loan(
  p_group_id UUID,
  p_borrower_id UUID,
  p_lender_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_loan_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_group public.groups%ROWTYPE;
  v_borrower public.group_members%ROWTYPE;
  v_lender public.group_members%ROWTYPE;
  v_amount NUMERIC(14,2) := round(coalesce(p_amount, 0), 2);
  v_desc TEXT := left(regexp_replace(trim(coalesce(p_description, '')), '[<>]', '', 'g'), 200);
BEGIN
  IF NOT public.is_group_member(p_group_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Permission denied.');
  END IF;
  IF NOT (public.is_group_admin_or_co_admin(p_group_id) OR v_uid IN (p_borrower_id, p_lender_id)) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Members can only record personal loans that involve themselves.');
  END IF;
  IF p_borrower_id = p_lender_id THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Borrower and lender must be different roommates.');
  END IF;
  IF v_amount <= 0 OR v_amount > 1000000000 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Loan amount must be greater than zero.');
  END IF;
  IF char_length(v_desc) < 1 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Please provide a reason or item description.');
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id;
  SELECT * INTO v_borrower FROM public.group_members WHERE group_id = p_group_id AND user_id = p_borrower_id;
  IF v_borrower.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Both borrower and lender must belong to this group.');
  END IF;
  SELECT * INTO v_lender FROM public.group_members WHERE group_id = p_group_id AND user_id = p_lender_id;
  IF v_lender.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Both borrower and lender must belong to this group.');
  END IF;

  INSERT INTO public.personal_loans (
    group_id, borrower_id, borrower_name, lender_id, lender_name,
    original_amount, remaining_amount, description, loan_date, status
  )
  VALUES (
    p_group_id, v_borrower.user_id, v_borrower.display_name, v_lender.user_id, v_lender.display_name,
    v_amount, v_amount, v_desc, coalesce(p_loan_date, CURRENT_DATE), 'active'
  );

  INSERT INTO public.activities (group_id, type, title, description, amount, actor_name, target_name, activity_date)
  VALUES (
    p_group_id,
    'personal_loan',
    'Personal Loan',
    v_borrower.display_name || ' borrowed ' || v_amount::TEXT || ' ' || v_group.currency || ' from ' || v_lender.display_name || ': ' || v_desc,
    v_amount,
    v_lender.display_name,
    v_borrower.display_name,
    coalesce(p_loan_date, CURRENT_DATE)::TEXT
  );

  RETURN jsonb_build_object('success', TRUE, 'message', 'Recorded ' || v_amount::TEXT || ' ' || v_group.currency || ' loan (' || v_lender.display_name || ' → ' || v_borrower.display_name || ').');
END;
$$;

-- J. Record Loan Repayment
CREATE OR REPLACE FUNCTION public.record_roomsplit_loan_repayment(
  p_loan_id UUID,
  p_amount NUMERIC,
  p_repayment_date DATE,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_loan public.personal_loans%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_repay NUMERIC(14,2) := round(coalesce(p_amount, 0), 2);
  v_new_remaining NUMERIC(14,2);
  v_is_settled BOOLEAN;
  v_note TEXT := coalesce(nullif(left(regexp_replace(trim(coalesce(p_note, '')), '[<>]', '', 'g'), 200), ''), 'Cash repayment');
BEGIN
  SELECT * INTO v_loan FROM public.personal_loans WHERE id = p_loan_id FOR UPDATE;
  IF v_loan.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Loan contract not found.');
  END IF;

  IF NOT (public.is_group_admin_or_co_admin(v_loan.group_id) OR v_uid = v_loan.lender_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Only the lender or an Admin/Co-Admin can confirm a loan repayment.');
  END IF;
  IF v_loan.status = 'settled' OR v_loan.remaining_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'This loan has already been fully settled.');
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = v_loan.group_id;
  IF v_repay <= 0 OR v_repay > v_loan.remaining_amount + 0.005 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid repayment amount or exceeds remaining debt.');
  END IF;

  v_new_remaining := greatest(0, round(v_loan.remaining_amount - v_repay, 2));
  IF v_new_remaining < 0.01 THEN
    v_new_remaining := 0;
  END IF;
  v_is_settled := (v_new_remaining = 0);

  INSERT INTO public.loan_repayments (loan_id, group_id, amount, repayment_date, note, remaining_after, confirmed_by_id)
  VALUES (v_loan.id, v_loan.group_id, v_repay, coalesce(p_repayment_date, CURRENT_DATE), v_note, v_new_remaining, v_uid);

  UPDATE public.personal_loans
  SET remaining_amount = v_new_remaining,
      status = CASE WHEN v_is_settled THEN 'settled' ELSE 'partially_repaid' END
  WHERE id = v_loan.id;

  INSERT INTO public.activities (group_id, type, title, description, amount, actor_name, target_name, activity_date)
  VALUES (
    v_loan.group_id,
    'loan_repayment',
    CASE WHEN v_is_settled THEN 'Personal Loan Fully Settled' ELSE 'Partial Loan Repayment' END,
    v_loan.borrower_name || ' returned ' || v_repay::TEXT || ' ' || v_group.currency || ' to ' || v_loan.lender_name,
    v_repay,
    v_loan.borrower_name,
    v_loan.lender_name,
    coalesce(p_repayment_date, CURRENT_DATE)::TEXT
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', CASE WHEN v_is_settled THEN 'Loan fully settled (' || v_repay::TEXT || ' ' || v_group.currency || ')!' ELSE 'Repayment of ' || v_repay::TEXT || ' ' || v_group.currency || ' recorded!' END
  );
END;
$$;

-- K. Record Peer Settlement Payment
CREATE OR REPLACE FUNCTION public.record_roomsplit_settlement(
  p_group_id UUID,
  p_from_member_id UUID,
  p_to_member_id UUID,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_group public.groups%ROWTYPE;
  v_from public.group_members%ROWTYPE;
  v_to public.group_members%ROWTYPE;
  v_amount NUMERIC(14,2) := round(coalesce(p_amount, 0), 2);
BEGIN
  IF NOT (public.is_group_admin_or_co_admin(p_group_id) OR v_uid = p_to_member_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Only the receiving member or an Admin/Co-Admin can mark this settlement as paid.');
  END IF;
  IF p_from_member_id = p_to_member_id OR v_amount <= 0 OR v_amount > 1000000000 THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Invalid settlement transfer.');
  END IF;

  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id;
  SELECT * INTO v_from FROM public.group_members WHERE group_id = p_group_id AND user_id = p_from_member_id;
  IF v_from.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Member not found in this group.');
  END IF;
  SELECT * INTO v_to FROM public.group_members WHERE group_id = p_group_id AND user_id = p_to_member_id;
  IF v_to.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'message', 'Member not found in this group.');
  END IF;

  INSERT INTO public.settlement_transfers (group_id, from_member_id, to_member_id, amount, recorded_by_id)
  VALUES (p_group_id, v_from.user_id, v_to.user_id, v_amount, v_uid);

  INSERT INTO public.activities (group_id, type, title, description, amount, actor_name, target_name, activity_date)
  VALUES (
    p_group_id,
    'settlement',
    'Peer Group Settlement Paid',
    v_from.display_name || ' paid ' || v_amount::TEXT || ' ' || v_group.currency || ' to ' || v_to.display_name || ' to settle balance',
    v_amount,
    v_from.display_name,
    v_to.display_name,
    CURRENT_DATE::TEXT
  );

  RETURN jsonb_build_object('success', TRUE, 'message', 'Recorded ' || v_amount::TEXT || ' ' || v_group.currency || ' settlement.');
END;
$$;

-- ============================================================================
-- PERMISSIONS & REALTIME PUBLICATION
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON
  public.groups,
  public.group_members,
  public.contributions,
  public.expenses,
  public.personal_loans,
  public.loan_repayments,
  public.settlement_transfers,
  public.activities
TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_requests TO authenticated;
REVOKE ALL ON public.group_secrets FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.is_group_member(UUID),
  public.is_group_admin_or_co_admin(UUID),
  public.is_group_main_admin(UUID),
  public.update_roomsplit_profile(TEXT, TEXT, TEXT),
  public.create_roomsplit_group(TEXT, TEXT, NUMERIC, TEXT, TEXT),
  public.join_roomsplit_group(TEXT, TEXT),
  public.update_roomsplit_group_settings(UUID, TEXT, TEXT, TEXT, NUMERIC),
  public.set_roomsplit_member_role(UUID, UUID, TEXT),
  public.confirm_roomsplit_contribution(UUID, UUID, NUMERIC, TEXT),
  public.approve_fund_request_atomic(UUID, TEXT),
  public.create_roomsplit_expense(UUID, NUMERIC, TEXT, DATE, UUID[], TEXT, NUMERIC, UUID, NUMERIC),
  public.create_roomsplit_loan(UUID, UUID, UUID, NUMERIC, TEXT, DATE),
  public.record_roomsplit_loan_repayment(UUID, NUMERIC, DATE, TEXT),
  public.record_roomsplit_settlement(UUID, UUID, UUID, NUMERIC)
TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE
    public.groups,
    public.group_members,
    public.contributions,
    public.fund_requests,
    public.expenses,
    public.personal_loans,
    public.loan_repayments,
    public.settlement_transfers,
    public.activities;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
