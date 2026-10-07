-- Zero-retention privacy: page-view counts only; no visitor addresses anywhere.
-- Replaces per-visit analytics (hashed IPs, referrers, unique-IP counts), IP
-- bans, and the address/user-agent columns on audit, form and abuse tables.
CREATE TABLE IF NOT EXISTS site_page_views (site_id integer NOT NULL REFERENCES sites(id) ON DELETE CASCADE, path text NOT NULL, day date NOT NULL, views integer NOT NULL DEFAULT 0, PRIMARY KEY (site_id, path, day));
DROP TABLE IF EXISTS analytics_buffer;
DROP TABLE IF EXISTS site_analytics;
ALTER TABLE admin_audit_log DROP COLUMN IF EXISTS ip_address, DROP COLUMN IF EXISTS ip, DROP COLUMN IF EXISTS user_agent;
ALTER TABLE form_submissions DROP COLUMN IF EXISTS ip_hash, DROP COLUMN IF EXISTS user_agent;
ALTER TABLE abuse_reports DROP COLUMN IF EXISTS reporter_ip;
DROP TABLE IF EXISTS ip_bans;
