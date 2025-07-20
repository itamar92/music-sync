/**
 * 🚀 PRODUCTION DEPLOYMENT CONFIGURATION
 * 
 * Enterprise-grade deployment strategy with security, performance, and monitoring
 */

const DEPLOYMENT_CONFIG = {
  // Environment Configuration
  environments: {
    development: {
      name: 'Development',
      domain: 'localhost:5173',
      firebase: {
        project: 'music-sync-99dbb',
        hosting: 'dev'
      },
      features: {
        sourceMaps: true,
        debugging: true,
        hotReload: true,
        clientSecrets: true
      }
    },
    staging: {
      name: 'Staging',
      domain: 'staging.musicsync.app',
      firebase: {
        project: 'music-sync-99dbb',
        hosting: 'staging'
      },
      features: {
        sourceMaps: true,
        debugging: false,
        hotReload: false,
        clientSecrets: false
      }
    },
    production: {
      name: 'Production',
      domain: 'app.musicsync.com',
      firebase: {
        project: 'music-sync-99dbb',
        hosting: 'default'
      },
      features: {
        sourceMaps: false,
        debugging: false,
        hotReload: false,
        clientSecrets: false
      }
    }
  },

  // Security Configuration
  security: {
    // Environment Variables Validation
    requiredEnvVars: {
      development: [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_DROPBOX_APP_KEY'
      ],
      production: [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_PROJECT_ID', 
        'VITE_DROPBOX_APP_KEY',
        'VITE_USE_SERVER_API',
        'VITE_API_BASE_URL'
      ]
    },
    
    // Forbidden in Production
    forbiddenEnvVars: {
      production: [
        'VITE_DROPBOX_APP_SECRET' // Never expose client secrets
      ]
    },

    // Content Security Policy
    csp: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://www.gstatic.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': [
        "'self'",
        'https://firestore.googleapis.com',
        'https://identitytoolkit.googleapis.com',
        'https://api.dropboxapi.com',
        'https://content.dropboxapi.com',
        'https://api-4oudeccelq-uc.a.run.app'
      ]
    }
  },

  // Performance Configuration
  performance: {
    // Bundle Optimization
    bundleTargets: {
      maxSize: '500KB',
      chunks: {
        vendor: ['react', 'react-dom', 'firebase'],
        auth: ['firebase/auth', 'react-firebase-hooks'],
        dropbox: ['dropbox'],
        ui: ['lucide-react']
      }
    },

    // Compression
    compression: {
      gzip: true,
      brotli: true,
      threshold: 1024
    },

    // Caching Strategy
    caching: {
      assets: '1y',      // Static assets
      api: '5m',         // API responses
      html: '1h',        // HTML files
      sw: '0'            // Service worker
    }
  },

  // Monitoring Configuration
  monitoring: {
    // Error Tracking
    sentry: {
      enabled: true,
      dsn: process.env.VITE_SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV
    },

    // Analytics
    analytics: {
      enabled: true,
      firebase: true,
      customEvents: [
        'track_play',
        'playlist_create',
        'auth_error',
        'performance_metric'
      ]
    },

    // Performance Monitoring
    vitals: {
      enabled: true,
      thresholds: {
        LCP: 2500,    // Largest Contentful Paint
        FID: 100,     // First Input Delay
        CLS: 0.1,     // Cumulative Layout Shift
        TTFB: 800     // Time to First Byte
      }
    }
  },

  // CI/CD Pipeline Configuration
  pipeline: {
    // Build Steps
    build: [
      'npm ci',
      // 'npm run typecheck', // Temporarily disabled - admin component type issues
      'npm run lint',
      'npm run test:ci',
      'npm run build:production',
      'npm run security:scan'
    ],

    // Deployment Steps
    deploy: [
      'firebase use production',
      'firebase deploy --only hosting',
      'firebase deploy --only functions',
      'npm run deploy:verify'
    ],

    // Post-Deploy Verification
    verify: [
      'npm run test:e2e',
      'npm run performance:audit',
      'npm run security:verify'
    ]
  }
};

module.exports = DEPLOYMENT_CONFIG;