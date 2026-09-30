import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point at TS source, not the CJS dist build — avoids Rollup's export-star/CJS
      // interop issues with workspace packages and lets edits show up without a rebuild.
      '@taskapp/shared-types': fileURLToPath(new URL('../../packages/shared-types/src/index.ts', import.meta.url)),
      '@taskapp/api-client': fileURLToPath(new URL('../../packages/api-client/src/index.ts', import.meta.url)),
    },
  },
  build: {
    // Raise the warning threshold — the app legitimately uses many libraries.
    // Manual chunks split the big vendor dependencies so users cache them independently.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — most stable, best to cache long-term.
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching + state.
          'vendor-query': ['@tanstack/react-query', 'zustand'],
          // Tiptap editor — large, but only loaded when editing tasks.
          'vendor-tiptap': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-mention', '@tiptap/extension-placeholder'],
          // DnD kit — used by Kanban.
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          // Firebase auth + messaging.
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/messaging'],
          // Charts / UI utilities.
          'vendor-misc': ['tippy.js'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'https://taskapp-api-jnimlvkvmq-uc.a.run.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
