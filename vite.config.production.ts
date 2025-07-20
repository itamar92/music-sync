import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  // Production build optimization
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable source maps in production
    minify: 'esbuild',
    target: 'es2020',
    
    // Bundle optimization
    rollupOptions: {
      output: {
        // Chunk splitting for better caching
        manualChunks: {
          // Vendor chunks (rarely change)
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-auth': ['react-firebase-hooks'],
          'vendor-dropbox': ['dropbox'],
          'vendor-ui': ['lucide-react'],
          'vendor-router': ['react-router-dom']
        },
        
        // Asset naming for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const extType = info[info.length - 1];
          
          if (/\.(png|jpe?g|svg|gif|webp|ico)$/i.test(assetInfo.name || '')) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.(css)$/i.test(assetInfo.name || '')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    
    // Chunk size warning threshold
    chunkSizeWarningLimit: 500, // 500KB warning
  },
  
  // Define environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __ENVIRONMENT__: JSON.stringify('production')
  },
  
  // CSS optimization
  css: {
    devSourcemap: false
  },
  
  // Asset optimization
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg', '**/*.webp'],
  
  // Server configuration for preview
  preview: {
    port: 4173,
    host: true
  },
  
  // Base path for deployment
  base: '/',
  
  // Experimental features
  experimental: {
    renderBuiltUrl: (filename, { hostType }) => {
      if (hostType === 'js') {
        // Use CDN or optimized paths for JS assets
        return `/${filename}`;
      }
      return `/${filename}`;
    }
  }
})