import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// Dev-server API target; override to point at another backend (default: local API on :5000).
const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://localhost:5000';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/socket.io': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[/\\]node_modules[/\\](react|react-dom|react-router-dom|@tanstack\/react-query|axios|zustand|socket\.io-client|react-hot-toast)[/\\]/.test(id)) {
            return 'vendor';
          }
          if (/[/\\]node_modules[/\\](leaflet|react-leaflet)[/\\]/.test(id)) {
            return 'maps';
          }
          if (/[/\\]node_modules[/\\](@radix-ui\/|lucide-react[/\\])/.test(id)) {
            return 'ui';
          }
          if (/[/\\]node_modules[/\\](date-fns|clsx)[/\\]/.test(id)) {
            return 'utils';
          }
          return undefined;
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
