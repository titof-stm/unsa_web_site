import { PRIVATE_CACHE } from './session';

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const prefix = (): string => `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}__offline/`;

export interface OfflineFile {
  readonly id: string;
  readonly name: string;
  readonly mime: string;
  readonly savedAt: number;
}

export const offlineSupported = (): boolean => 'caches' in window;

export async function saveOffline(id: string, name: string, mime: string, blob: Blob): Promise<void> {
  const cache = await caches.open(PRIVATE_CACHE);
  await cache.put(
    prefix() + encodeURIComponent(id),
    new Response(blob, {
      headers: { 'Content-Type': mime, 'X-Name': encodeURIComponent(name), 'X-Saved': String(Date.now()) },
    }),
  );
}

export async function removeOffline(id: string): Promise<void> {
  if (!offlineSupported()) return;
  await (await caches.open(PRIVATE_CACHE)).delete(prefix() + encodeURIComponent(id));
}

export async function isSavedOffline(id: string): Promise<boolean> {
  if (!offlineSupported()) return false;
  return (await (await caches.open(PRIVATE_CACHE)).match(prefix() + encodeURIComponent(id))) !== undefined;
}

/** Lists the files saved on this device and silently deletes those older than 30 days. */
export async function listOffline(): Promise<OfflineFile[]> {
  if (!offlineSupported()) return [];
  const cache = await caches.open(PRIVATE_CACHE);
  const files: OfflineFile[] = [];
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (!response) continue;
    const savedAt = Number(response.headers.get('X-Saved'));
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE_MS) {
      await cache.delete(request);
      continue;
    }
    files.push({
      id: decodeURIComponent(new URL(request.url).pathname.slice(prefix().length)),
      name: decodeURIComponent(response.headers.get('X-Name') ?? ''),
      mime: response.headers.get('Content-Type') ?? 'application/octet-stream',
      savedAt,
    });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function readOffline(id: string): Promise<Blob | null> {
  if (!offlineSupported()) return null;
  const response = await (await caches.open(PRIVATE_CACHE)).match(prefix() + encodeURIComponent(id));
  return response ? response.blob() : null;
}
