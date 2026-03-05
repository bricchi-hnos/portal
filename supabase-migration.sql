-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS dashboard_uploads (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug               TEXT        NOT NULL,
  area               TEXT        NOT NULL,
  dashboard_type     TEXT        NOT NULL DEFAULT 'static',  -- 'static' | 'embed' | 'app'
  filename           TEXT        NOT NULL,
  uploader_email     TEXT        NOT NULL,
  uploader_name      TEXT        NOT NULL,
  github_commit_sha  TEXT        NOT NULL,
  dashboard_url      TEXT        NOT NULL,
  assets_count       INTEGER     DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_area    ON dashboard_uploads(area);
CREATE INDEX IF NOT EXISTS idx_uploads_email   ON dashboard_uploads(uploader_email);
CREATE INDEX IF NOT EXISTS idx_uploads_created ON dashboard_uploads(created_at DESC);

ALTER TABLE dashboard_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON dashboard_uploads
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
