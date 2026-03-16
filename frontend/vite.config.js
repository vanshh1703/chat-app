import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'OrgChat App',
        short_name: 'OrgChat',
        description: 'A modern chat application',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    // Use esbuild for faster, reliable minification
    minify: 'esbuild',
    // Target modern browsers — enables smaller output via modern syntax
    target: 'es2020',
    // Enable CSS code split to prevent full CSS from loading upfront
    cssCodeSplit: true,
    // Inline assets smaller than 4kb directly to avoid extra requests
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Avoid emitting very small chunks (less than 10kb)
        experimentalMinChunkSize: 10000,
        manualChunks(id) {
          // Core React framework — always needed
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }
          // Router — needed only for navigation
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-router')) {
            return 'router'
          }
          // Socket.IO
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/engine.io-client')) {
            return 'socket'
          }
          // Axios
          if (id.includes('node_modules/axios')) {
            return 'axios'
          }
          // Emoji picker — loaded on demand but still benefits from its own chunk
          if (id.includes('node_modules/emoji-picker-react')) {
            return 'emoji-picker'
          }
          // Face API — should be loaded dynamically, but if included, isolate it
          if (id.includes('node_modules/@vladmandic')) {
            return 'face-api'
          }
          // html5-qrcode — isolate into own chunk
          if (id.includes('node_modules/html5-qrcode')) {
            return 'qr-scanner'
          }
        }
      },
      // Mark large, rarely-used packages as external if dynamically loaded
      // (only if they are truly lazy-loaded via dynamic import())
    }
  },
  // Esbuild tuning — drop console.log in production
  esbuild: {
    drop: ['debugger'],
    legalComments: 'none'
  }
})

