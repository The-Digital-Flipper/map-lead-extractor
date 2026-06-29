-- Saved Lead Collections — migration 0001
--
-- Dev workflow uses `pnpm --filter @workspace/db run push` (drizzle-kit push),
-- which derives this from src/schema/collections.ts. This hand-written, fully
-- idempotent migration is provided for production/manual application.

CREATE TABLE IF NOT EXISTS collections (
  id            serial PRIMARY KEY,
  clerk_user_id text        NOT NULL,
  name          text        NOT NULL,
  color         text,
  archived      boolean     NOT NULL DEFAULT false,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_user ON collections (clerk_user_id);

CREATE TABLE IF NOT EXISTS collection_leads (
  id            serial PRIMARY KEY,
  collection_id integer     NOT NULL,
  lead_id       integer     NOT NULL,
  clerk_user_id text        NOT NULL,
  added_at      timestamptz DEFAULT now(),
  CONSTRAINT uniq_collection_lead UNIQUE (collection_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_leads_collection ON collection_leads (collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_leads_user ON collection_leads (clerk_user_id);
