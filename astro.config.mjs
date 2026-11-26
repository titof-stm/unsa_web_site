// @ts-check
import { defineConfig } from 'astro/config';
import pwa from './src/integrations/pwa.mjs';

// SITE and BASE: change these if the GitHub account or repository name changes.
export default defineConfig({
  site: 'https://titof-stm.github.io',
  base: '/unsa_web_site',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [pwa()],
  build: {
    // Keep CSS external so the strict CSP (style-src 'self') is honoured.
    inlineStylesheets: 'never',
  },
  markdown: {
    // Syntax highlighting writes inline style="" attributes, which the CSP blocks.
    syntaxHighlight: false,
  },
  vite: {
    build: {
      // Astro inlines small scripts by default; 0 forces external files (script-src 'self').
      assetsInlineLimit: 0,
    },
  },
});