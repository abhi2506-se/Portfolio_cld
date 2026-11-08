-- Visitor Management — per-section access granted by admin (ADDITIVE, not applied yet).
-- Missing row or granted = FALSE  => section stays locked until admin enables it.
BEGIN;
CREATE TABLE IF NOT EXISTS visitor_feature_access (
  visitor_id  TEXT NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL CHECK (feature IN ('explorer','demo_chat')),
  granted     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, feature)
);
COMMIT;
