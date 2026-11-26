import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXCLUDED = new Set(['sw.js', 'robots.txt', '404.html']);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/**
 * Astro integration: after the build, injects the list of files to precache and a content-based
 * version into dist/sw.js (copied from public/sw.js). Any change in the site changes the version,
 * which makes browsers install the new service worker and refresh their cache.
 */
export default function pwa() {
  let base = '/';
  return {
    name: 'unsa-pwa-precache',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base.replace(/\/?$/, '/');
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const swPath = join(root, 'sw.js');
        const hash = createHash('sha256');
        const urls = [];
        const files = (await walk(root)).sort();
        for (const file of files) {
          const rel = relative(root, file).split(sep).join('/');
          if (EXCLUDED.has(rel) || rel.endsWith('.map') || rel.split('/').some((part) => part.startsWith('.'))) continue;
          hash.update(rel).update(await readFile(file));
          if (rel === 'index.html') urls.push(base);
          else if (rel.endsWith('/index.html')) urls.push(`${base}${rel.slice(0, -'index.html'.length)}`);
          else urls.push(`${base}${rel}`);
        }
        const version = hash.digest('hex').slice(0, 12);
        const source = await readFile(swPath, 'utf8');
        const output = source
          .replace('__VERSION__', version)
          .replace('__BASE__', base)
          .replace('/*__PRECACHE__*/ []', JSON.stringify(urls));
        await writeFile(swPath, output);
        logger.info(`service worker ${version}: ${urls.length} files precached`);
      },
    },
  };
}
