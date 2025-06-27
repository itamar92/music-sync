# MusicSync - Dropbox Music Player

A web application that syncs with your Dropbox account to create playlists from your music folders. Perfect for music producers who want to stay updated with their latest mixdowns and share music with clients.

## Features

- 🎵 **Dropbox Integration**: Automatically sync music folders from your Dropbox
- 📁 **Folder-based Playlists**: Create playlists from any Dropbox folder
- 🎧 **Audio Player**: Built-in music player with controls and progress tracking
- 🔄 **Real-time Sync**: Stay updated with the latest files in your synced folders
- 📤 **Easy Sharing**: Share individual tracks or entire playlists
- 🎨 **Custom Album Art**: Upload custom covers for your playlists
- 🌙 **Dark Mode**: Beautiful dark interface similar to Samply

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd music-sync
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Dropbox App

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Click "Create app"
3. Choose "Scoped access"
4. Choose "Full Dropbox" access
5. Name your app (e.g., "MusicSync")
6. Copy the App key and App secret

### 4. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Dropbox credentials:
   ```
   VITE_DROPBOX_APP_KEY=your_dropbox_app_key_here
   VITE_DROPBOX_APP_SECRET=your_dropbox_app_secret_here
   ```

### 5. Configure Dropbox App Settings

In your Dropbox app settings:

1. **Redirect URIs**: Add `http://localhost:3000/auth`
2. **Permissions**: Enable the following scopes:
   - `files.metadata.read`
   - `files.content.read`
   - `sharing.read`

### 6. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## How to Use

### First Time Setup

1. **Connect to Dropbox**: Click "Connect to Dropbox" and authorize the app
2. **Select Folders**: Use "Manage Folders" to choose which Dropbox folders to sync
3. **Start Listening**: Click on any synced folder to view and play tracks

### Managing Music

- **Sync Folders**: Add or remove folders from the "Manage Folders" dialog
- **Upload Cover Art**: Hover over the album cover in playlist view to upload custom art
- **Share Music**: Use the share button to generate links for tracks or playlists
- **Refresh**: Click refresh to check for new files in your Dropbox folders

### Supported Audio Formats

- MP3
- WAV
- FLAC
- M4A
- AAC
- OGG

## Project Structure

```
src/
├── components/          # React components
│   ├── AudioPlayer.tsx
│   ├── TrackList.tsx
│   ├── FolderList.tsx
│   ├── ConnectionStatus.tsx
│   └── Modal.tsx
├── hooks/              # Custom React hooks
│   ├── useDropbox.ts
│   └── useAudioPlayer.ts
├── services/           # API services
│   └── dropboxService.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── utils/              # Utility functions
│   ├── formatTime.ts
│   └── shareUtils.ts
└── App.tsx             # Main application component
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

### Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Dropbox API** - File integration
- **Lucide React** - Icons

## Deployment

### Build for Production

```bash
npm run build
```

### Environment Variables for Production

Make sure to set the following environment variables in your production environment:

- `VITE_DROPBOX_APP_KEY` - Your Dropbox app key
- `VITE_DROPBOX_APP_SECRET` - Your Dropbox app secret

Update the redirect URI in your Dropbox app settings to match your production domain.

## Troubleshooting

### Common Issues

1. **"Not authenticated" errors**: Make sure your Dropbox app credentials are correct
2. **Redirect URI mismatch**: Ensure the redirect URI in Dropbox matches your domain
3. **No audio playback**: Check browser permissions and supported audio formats
4. **Empty folder lists**: Verify Dropbox permissions and folder structure

### Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT License - feel free to use this project for your own music sharing needs!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.