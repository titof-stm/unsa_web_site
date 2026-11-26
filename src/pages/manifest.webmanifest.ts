import type { APIRoute } from 'astro';
import { SITE, url } from '../config';

// Generated at build time so that every path follows the deployment base (e.g. /unsa_web_site/).
export const GET: APIRoute = () => {
  const manifest = {
    id: url(),
    name: SITE.title,
    short_name: SITE.shortTitle,
    description: SITE.description,
    lang: SITE.lang,
    dir: 'ltr',
    start_url: url(),
    scope: url(),
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#102058',
    categories: ['news', 'productivity'],
    icons: [
      { src: url('img/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: url('img/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: url('img/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Documents', url: url('documents/'), icons: [{ src: url('img/icon-192.png'), sizes: '192x192' }] },
      { name: 'Actualités', url: url('actualites/'), icons: [{ src: url('img/icon-192.png'), sizes: '192x192' }] },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
