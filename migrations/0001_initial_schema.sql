-- Migration: initial flag_definitions schema (snake_case columns)
CREATE TABLE IF NOT EXISTS flag_definitions (
    key TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'boolean',
    default_value TEXT NOT NULL DEFAULT 'true',
    enabled INTEGER NOT NULL DEFAULT 1,
    environments TEXT,
    targeting TEXT,
    tags TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default watchlist feature flags (boolean, env fallbacks apply if rows missing / RPC fails)
INSERT OR IGNORE INTO flag_definitions (key, name, description, type, default_value, enabled, environments, targeting, tags, created_at, updated_at)
VALUES
    ('watchlist-pep-search', 'Watchlist PEP search', 'Enable PEP list search in watchlist', 'boolean', 'true', 1, NULL, NULL, '["watchlist"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('watchlist-pep-grok', 'Watchlist PEP Grok', 'Enable Grok-based PEP enrichment', 'boolean', 'true', 1, NULL, NULL, '["watchlist"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('watchlist-adverse-media', 'Watchlist adverse media', 'Enable adverse media screening', 'boolean', 'true', 1, NULL, NULL, '["watchlist"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
