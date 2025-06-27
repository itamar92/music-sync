# Database Schema for MusicSync

This document outlines the database schema design for when MusicSync is connected to a backend database.

## Overview

The current application uses localStorage for data persistence. When migrating to a database, the following schema should be implemented to support multi-user functionality and cloud synchronization.

## Tables

### users
Primary table for user management.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  dropbox_user_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### folder_syncs
Tracks which Dropbox folders each user has synced.

```sql
CREATE TABLE folder_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id VARCHAR(500) NOT NULL, -- Dropbox folder path
  folder_path VARCHAR(1000) NOT NULL,
  folder_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255), -- Custom name set by user
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, folder_id)
);
```

### playlists
User's playlists (both folder-based and custom).

```sql
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255), -- Custom name set by user
  folder_id VARCHAR(500), -- References folder_syncs.folder_id for folder-based playlists
  folder_path VARCHAR(1000),
  type VARCHAR(20) NOT NULL CHECK (type IN ('folder', 'custom')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### tracks
Individual audio tracks with metadata and aliases.

```sql
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255), -- Custom name alias set by user
  artist VARCHAR(255) NOT NULL,
  display_artist VARCHAR(255), -- Custom artist alias set by user
  duration VARCHAR(20) NOT NULL, -- Formatted duration (e.g., "3:45")
  duration_seconds INTEGER NOT NULL,
  file_path VARCHAR(1000) NOT NULL, -- Dropbox file path
  folder_id VARCHAR(500) NOT NULL,
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, file_path)
);
```

### playlist_tracks
Junction table for custom playlists (many-to-many relationship).

```sql
CREATE TABLE playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(playlist_id, track_id),
  UNIQUE(playlist_id, position)
);
```

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_folder_syncs_user_id ON folder_syncs(user_id);
CREATE INDEX idx_folder_syncs_folder_id ON folder_syncs(folder_id);
CREATE INDEX idx_playlists_user_id ON playlists(user_id);
CREATE INDEX idx_playlists_folder_id ON playlists(folder_id);
CREATE INDEX idx_tracks_user_id ON tracks(user_id);
CREATE INDEX idx_tracks_folder_id ON tracks(folder_id);
CREATE INDEX idx_tracks_playlist_id ON tracks(playlist_id);
CREATE INDEX idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX idx_playlist_tracks_track_id ON playlist_tracks(track_id);
```

## API Endpoints

When implementing the backend, these REST endpoints should be created:

### Authentication
- `POST /auth/login` - Authenticate with Dropbox
- `POST /auth/logout` - Logout and clear session
- `GET /auth/me` - Get current user info

### Folder Management
- `GET /api/folders/synced` - Get user's synced folders
- `POST /api/folders/sync` - Sync a new folder
- `DELETE /api/folders/{folderId}/sync` - Unsync a folder
- `PUT /api/folders/{folderId}/display-name` - Update folder display name

### Playlist Management
- `GET /api/playlists` - Get user's playlists
- `POST /api/playlists` - Create a new playlist
- `GET /api/playlists/{playlistId}` - Get specific playlist
- `PUT /api/playlists/{playlistId}` - Update playlist
- `DELETE /api/playlists/{playlistId}` - Delete playlist
- `PUT /api/playlists/{playlistId}/display-name` - Update playlist display name

### Track Management
- `GET /api/playlists/{playlistId}/tracks` - Get tracks in playlist
- `POST /api/tracks` - Add track to playlist
- `PUT /api/tracks/{trackId}/alias` - Update track name/artist alias
- `DELETE /api/tracks/{trackId}` - Remove track from playlist

### Sync Operations
- `POST /api/sync/folder/{folderId}` - Sync folder tracks from Dropbox
- `GET /api/sync/status/{folderId}` - Get last sync status

## Migration Strategy

1. **Phase 1**: Implement backend API with database
2. **Phase 2**: Add user authentication and multi-tenancy
3. **Phase 3**: Create migration script to move data from localStorage to database
4. **Phase 4**: Update frontend to use API instead of localStorage
5. **Phase 5**: Add real-time sync and conflict resolution

## Data Migration

The `MigrationService` class in `databaseService.ts` provides a framework for migrating existing localStorage data to the database:

1. Extract synced folders from localStorage
2. Extract track aliases and playlist aliases
3. Extract custom playlists
4. Create corresponding database records
5. Clear localStorage after successful migration

## Environment Variables

```env
# Database connection
DATABASE_URL=postgresql://username:password@localhost:5432/musicsync
DATABASE_SSL=true

# API configuration
API_BASE_URL=https://api.musicsync.com
API_VERSION=v1

# Dropbox integration
DROPBOX_APP_KEY=your_dropbox_app_key
DROPBOX_APP_SECRET=your_dropbox_app_secret

# Authentication
JWT_SECRET=your_jwt_secret
SESSION_TIMEOUT=86400
```

## Security Considerations

1. **User Isolation**: All queries must include user_id to prevent data leakage
2. **Input Validation**: Validate all user inputs, especially file paths
3. **Rate Limiting**: Implement rate limiting for API endpoints
4. **Encryption**: Encrypt sensitive data at rest
5. **Audit Logging**: Log all data modifications for security auditing
6. **Dropbox Token Security**: Store Dropbox access tokens securely (encrypted)

## Performance Considerations

1. **Database Indexing**: Proper indexes on foreign keys and query columns
2. **Caching**: Implement Redis cache for frequently accessed data
3. **Pagination**: Paginate large result sets (playlists, tracks)
4. **Background Jobs**: Use queue system for Dropbox sync operations
5. **CDN**: Consider CDN for audio file streaming optimization