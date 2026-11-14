-- Persist the precomputed Patent Library demo analytics across all Cloudflare
-- locations. Run once against the existing remote D1 database before deploying
-- the worker with analytics snapshot support.
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  cache_key TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
