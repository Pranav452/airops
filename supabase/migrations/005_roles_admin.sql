-- ═══════════════════════════════════════════════════════════════════════════
-- 005_roles_admin.sql — Roles, admin panel, column permissions,
-- required-field gating, and auto-progression (adapted from Bajaj, single-board)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Users registry + approval + role
CREATE TABLE IF NOT EXISTS airops_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL UNIQUE,
  full_name   text,
  team        text,
  role        text DEFAULT 'user' CHECK (role IN ('superadmin','admin','user')),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  approved_by text,
  approved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Per-status column assignments
CREATE TABLE IF NOT EXISTS airops_column_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id   uuid REFERENCES airops_statuses(id) ON DELETE CASCADE,
  user_email  text NOT NULL,
  can_edit    bool NOT NULL DEFAULT true,
  can_move    bool NOT NULL DEFAULT true,
  can_assign  bool NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, user_email)
);

-- 3. Required fields per column
CREATE TABLE IF NOT EXISTS airops_column_required_fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id   uuid NOT NULL REFERENCES airops_statuses(id) ON DELETE CASCADE,
  field_key   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, field_key)
);

-- 4. Auto-progression rules
CREATE TABLE IF NOT EXISTS airops_auto_progression (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_field      text NOT NULL,
  target_status_id   uuid NOT NULL REFERENCES airops_statuses(id) ON DELETE CASCADE,
  description        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trigger_field, target_status_id)
);

-- 5. Audit log
CREATE TABLE IF NOT EXISTS airops_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email text,
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE airops_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE airops_column_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE airops_column_required_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE airops_auto_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE airops_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['airops_users','airops_column_assignments','airops_column_required_fields','airops_auto_progression','airops_audit_logs']
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)', t||'_sel', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true)', t||'_ins', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true)', t||'_upd', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true)', t||'_del', t);
  END LOOP;
END $$;

-- Seed: pranav = superadmin (fallback), exportsea3 = approved user
INSERT INTO airops_users (user_id, email, role, status, approved_at, approved_by)
SELECT id, email, 'superadmin', 'approved', now(), 'system'
FROM auth.users WHERE email = 'pranavnairop090@gmail.com'
ON CONFLICT (email) DO UPDATE SET role='superadmin', status='approved';

INSERT INTO airops_users (user_id, email, role, status, approved_at, approved_by)
SELECT id, email, 'user', 'approved', now(), 'system'
FROM auth.users WHERE email = 'exportsea3.mum@manilal.com'
ON CONFLICT (email) DO UPDATE SET status='approved';
