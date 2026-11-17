import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React + Router - must be in vendor to avoid React DOM being split across chunks
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'axios', 'zustand', 'socket.io-client', 'react-hot-toast'],
          // Map libraries - only leaflet and react-leaflet
          maps: ['leaflet', 'react-leaflet'],
          // Radix UI primitives + icons
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select', '@radix-ui/react-label', '@radix-ui/react-popover', '@radix-ui/react-separator', '@radix-ui/react-slider', '@radix-ui/react-tabs', '@radix-ui/react-tooltip', 'lucide-react'],
          // Date utilities - used everywhere, keep in vendor or separate small chunk
          utils: ['date-fns', 'clsx'],
        },
      },
    },
  },
  plugins: [
    react(),
    visualizer({
      filename: 'bundle-analysis.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
