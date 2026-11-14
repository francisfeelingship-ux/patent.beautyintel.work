-- Private registration-application workflow; separate from patent records.
CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT NOT NULL,
  use_case TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_email
  ON access_requests (email COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_access_requests_status_created
  ON access_requests (status, created_at DESC);
