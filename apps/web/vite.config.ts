/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const background = '#181818';

export default defineConfig({
  plugins: [
    react(),
    // Installable app that opens offline (spec installable-app, design D1-D3, D8).
    VitePWA({
      strategies: 'generateSW',
      // A new version waits until the player taps "Actualizar" in the menu or reopens the game.
      registerType: 'prompt',
      // Registered from src/pwa/updates.ts.
      injectRegister: null,
      // A service worker in `pnpm dev` would keep serving old code: test it with build + preview.
      devOptions: { enabled: false },
      // globPatterns already covers the icons and the plugin adds the manifest: no duplicate precache entries.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        start_url: '/',
        scope: '/',
        name: 'Mind Racer',
        short_name: 'Mind Racer',
        description: 'Mind Racer: carreras de cálculo mental. Cada respuesta correcta acelera tu auto.',
        lang: 'es',
        dir: 'ltr',
        display: 'standalone',
        theme_color: background,
        background_color: background,
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // Any page of the site, with or without ?sala=, answers with the cached app (design D2).
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    passWithNoTests: true,
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
