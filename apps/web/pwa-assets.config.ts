import { defineConfig } from '@vite-pwa/assets-generator/config';

const background = '#181818';

/**
 * Generates the app icons from public/icons/icon.svg (design D7): `pnpm --filter web icons`.
 * The PNGs are committed, so the build and CI never run this.
 */
export default defineConfig({
  images: ['public/icons/icon.svg'],
  preset: {
    transparent: { sizes: [192, 512], favicons: [] },
    // The whole square is painted, with the × well inside the 80 % safe zone.
    maskable: { sizes: [512], padding: 0, resizeOptions: { background } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background } },
  },
});
