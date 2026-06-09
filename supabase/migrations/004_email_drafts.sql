-- ─── Email Drafts (Stuffing Finalisation emails) ────────────────────────────

CREATE TABLE IF NOT EXISTS airops_email_drafts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      uuid REFERENCES airops_jobs(id) ON DELETE CASCADE,
  "to"        text NOT NULL,
  cc          text,
  subject     text NOT NULL,
  body        text NOT NULL,
  sent        boolean DEFAULT false,
  sent_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS airops_email_drafts_job ON airops_email_drafts(job_id, created_at);

ALTER TABLE airops_email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "airops_email_drafts_all_auth" ON airops_email_drafts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
