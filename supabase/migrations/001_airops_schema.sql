-- AirOps Schema — Phase 1
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)

-- ─── Statuses (board columns) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS airops_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color_hex text NOT NULL DEFAULT 'a3a3a3',
  display_order int NOT NULL DEFAULT 0
);

-- Seed the 27 pipeline columns
INSERT INTO airops_statuses (name, color_hex, display_order) VALUES
  ('Booking Request',     '6366f1', 1),
  ('Vessel Planning',     '8b5cf6', 2),
  ('Consignee Approval',  'f59e0b', 3),
  ('Container Planning',  '3b82f6', 4),
  ('Carrier Booking',     '06b6d4', 5),
  ('Stuffing Finalisation','10b981', 6),
  ('SI Filing',           '84cc16', 7),
  ('Booking Released',    '22c55e', 8),
  ('Container Lifted',    '16a34a', 9),
  ('Clearance',           '0d9488', 10),
  ('SI Filing Done',      '14b8a6', 11),
  ('Gate In',             '0ea5e9', 12),
  ('Bill of Lading',      '2563eb', 13),
  ('Billing',             '7c3aed', 14),
  ('Console',             'a855f7', 15),
  ('ETA',                 'ec4899', 16),
  ('Container Release',   'f43f5e', 17),
  ('RDV',                 'ef4444', 18),
  ('ODT',                 'f97316', 19),
  ('Instructions Douane', 'eab308', 20),
  ('FACTURE',             'ca8a04', 21),
  ('Arrival Notice',      '78716c', 22),
  ('CPU/SCR',             '64748b', 23),
  ('ATA',                 '475569', 24),
  ('T1/IMA',              '334155', 25),
  ('MBL/HBL',             '1e293b', 26),
  ('Completed',           '15803d', 27)
ON CONFLICT (name) DO NOTHING;

-- ─── Vessels ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS airops_vessels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  etd date,
  eta date,
  pol text,
  pod text,
  port_cutoff timestamptz,
  si_cutoff timestamptz,
  docs_cutoff timestamptz,
  vgm_cutoff timestamptz,
  cargo_handover_cutoff timestamptz,
  canvas_x float8 DEFAULT 0,
  canvas_y float8 DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ─── Containers ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS airops_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid REFERENCES airops_vessels(id) ON DELETE SET NULL,
  container_number text,
  container_type text,
  seal_no text,
  max_volume float8,
  canvas_x float8 DEFAULT 0,
  canvas_y float8 DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ─── Jobs ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS airops_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid REFERENCES airops_statuses(id) ON DELETE SET NULL,
  container_id uuid REFERENCES airops_containers(id) ON DELETE SET NULL,
  console_no text,
  cross_verified boolean DEFAULT false,
  column_order float8 DEFAULT 0,
  canvas_x float8 DEFAULT 0,
  canvas_y float8 DEFAULT 0,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS airops_jobs_status_order ON airops_jobs(status_id, column_order);
CREATE INDEX IF NOT EXISTS airops_jobs_container ON airops_jobs(container_id);

-- ─── Comments ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS airops_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES airops_jobs(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS airops_comments_job ON airops_comments(job_id, created_at);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE airops_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE airops_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE airops_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE airops_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE airops_comments ENABLE ROW LEVEL SECURITY;

-- Statuses: read-only for all authenticated users
CREATE POLICY "airops_statuses_select" ON airops_statuses
  FOR SELECT TO authenticated USING (true);

-- Vessels: authenticated CRUD
CREATE POLICY "airops_vessels_select" ON airops_vessels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "airops_vessels_insert" ON airops_vessels
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "airops_vessels_update" ON airops_vessels
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "airops_vessels_delete" ON airops_vessels
  FOR DELETE TO authenticated USING (true);

-- Containers: authenticated CRUD
CREATE POLICY "airops_containers_select" ON airops_containers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "airops_containers_insert" ON airops_containers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "airops_containers_update" ON airops_containers
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "airops_containers_delete" ON airops_containers
  FOR DELETE TO authenticated USING (true);

-- Jobs: authenticated read/update; anon insert (shipper form)
CREATE POLICY "airops_jobs_select" ON airops_jobs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "airops_jobs_insert_anon" ON airops_jobs
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "airops_jobs_insert_auth" ON airops_jobs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "airops_jobs_update" ON airops_jobs
  FOR UPDATE TO authenticated USING (true);

-- Comments: authenticated CRUD
CREATE POLICY "airops_comments_select" ON airops_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "airops_comments_insert" ON airops_comments
  FOR INSERT TO authenticated WITH CHECK (true);

-- ─── Updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER airops_jobs_updated_at
  BEFORE UPDATE ON airops_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
