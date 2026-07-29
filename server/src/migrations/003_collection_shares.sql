-- Collection share links: the "only people with the link" tier.
--
-- A collection is otherwise all-or-nothing — listed on the home page for
-- everyone, or invisible to everyone but the admin. A row here grants read +
-- stream access to exactly one collection, to whoever holds the token.
--
-- Deliberately one row per link rather than a column on collections: revoking
-- keeps the row (so the audit trail survives), regenerating is revoke + insert,
-- and a future members tier is this same table plus `label`, `invitee_email`
-- and `role` columns — one row per person is already the right shape.

CREATE TABLE IF NOT EXISTS collection_shares (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  -- 32 crypto-random bytes, base64url (~43 chars). Unique is enforced here so
  -- a collision is a failed insert rather than two collections sharing a link.
  token         text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Null means active. Set, never unset — a revoked link stays dead.
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS collection_shares_collection_idx
  ON collection_shares (collection_id);
