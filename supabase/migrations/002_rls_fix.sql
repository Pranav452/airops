-- RLS fix: drop overly-strict policies and replace with simple open ones.
-- For a team internal tool, authenticated = trusted. Tighten later per-column.

-- Drop existing job policies
DROP POLICY IF EXISTS "airops_jobs_insert_anon" ON airops_jobs;
DROP POLICY IF EXISTS "airops_jobs_insert_auth" ON airops_jobs;
DROP POLICY IF EXISTS "airops_jobs_select" ON airops_jobs;
DROP POLICY IF EXISTS "airops_jobs_update" ON airops_jobs;

-- New: authenticated users can do everything; anon can insert (shipper form)
CREATE POLICY "airops_jobs_all_auth" ON airops_jobs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "airops_jobs_insert_anon" ON airops_jobs
  FOR INSERT TO anon WITH CHECK (true);

-- Same for vessels + containers (drop + recreate as full permissive for authenticated)
DROP POLICY IF EXISTS "airops_vessels_select" ON airops_vessels;
DROP POLICY IF EXISTS "airops_vessels_insert" ON airops_vessels;
DROP POLICY IF EXISTS "airops_vessels_update" ON airops_vessels;
DROP POLICY IF EXISTS "airops_vessels_delete" ON airops_vessels;

CREATE POLICY "airops_vessels_all_auth" ON airops_vessels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "airops_containers_select" ON airops_containers;
DROP POLICY IF EXISTS "airops_containers_insert" ON airops_containers;
DROP POLICY IF EXISTS "airops_containers_update" ON airops_containers;
DROP POLICY IF EXISTS "airops_containers_delete" ON airops_containers;

CREATE POLICY "airops_containers_all_auth" ON airops_containers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "airops_comments_select" ON airops_comments;
DROP POLICY IF EXISTS "airops_comments_insert" ON airops_comments;

CREATE POLICY "airops_comments_all_auth" ON airops_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
