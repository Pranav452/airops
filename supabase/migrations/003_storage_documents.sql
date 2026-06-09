-- ─── Storage: Job Documents Bucket ─────────────────────────────────────────
-- Run in Supabase Dashboard → SQL Editor

-- Create the bucket (public = false, so files require signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-documents',
  'job-documents',
  false,
  20971520, -- 20 MB per file
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Anon can upload (shipper form is public)
CREATE POLICY "job_docs_anon_insert" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'job-documents');

-- Authenticated users can read, insert, update, delete
CREATE POLICY "job_docs_auth_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'job-documents')
  WITH CHECK (bucket_id = 'job-documents');
