import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          map:     ['leaflet', 'react-leaflet'],
          query:   ['@tanstack/react-query'],
        },
      },
    },
  },
})
