-- MusicSync container-mode schema: collections -> playlists -> tracks,
-- plus shared key/value state (Dropbox access token) and the stream-link cache.

CREATE TABLE IF NOT EXISTS collections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  display_name    text,
  description     text,
  cover_image_url text,
  is_public       boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS playlists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   uuid REFERENCES collections(id) ON DELETE SET NULL,
  name            text NOT NULL,
  display_name    text,
  description     text,
  cover_image_url text,
  -- Dropbox folder this playlist mirrors; unique so re-syncing updates in place.
  folder_path     text UNIQUE,
  type            text NOT NULL DEFAULT 'folder',
  is_public       boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playlists_collection_idx ON playlists (collection_id);

CREATE TABLE IF NOT EXISTS tracks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id      uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  name             text NOT NULL,
  artist           text,
  display_name     text,
  display_artist   text,
  -- Dropbox path (path_lower); what the stream endpoints resolve.
  file_path        text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  track_number     integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, file_path)
);

CREATE INDEX IF NOT EXISTS tracks_playlist_idx  ON tracks (playlist_id, track_number);
CREATE INDEX IF NOT EXISTS tracks_file_path_idx ON tracks (file_path);

-- Shared mutable state. Holds the Dropbox access token so every replica and
-- every restart reuses one token instead of racing to mint their own.
CREATE TABLE IF NOT EXISTS app_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dropbox temporary links (~4h validity). Cached so repeat plays and
-- prefetched skips never wait on a Dropbox round-trip.
CREATE TABLE IF NOT EXISTS stream_links (
  file_path  text PRIMARY KEY,
  url        text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stream_links_expires_idx ON stream_links (expires_at);
