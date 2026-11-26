import type { Session } from './api';

const KEY = 'unsa.session';
const FCM_KEY = 'unsa.fcm';
const PREFS_CACHE = 'unsa-prefs';
export const PRIVATE_CACHE = 'unsa-private';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (typeof session.token !== 'string' || typeof session.exp !== 'number') return null;
    if (session.exp * 1000 < Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

/** Push token of this device, kept only to be able to unsubscribe it later. */
export const getStoredFcmToken = (): string | null => localStorage.getItem(FCM_KEY);
export const storeFcmToken = (token: string): void => localStorage.setItem(FCM_KEY, token);
export const clearFcmToken = (): void => localStorage.removeItem(FCM_KEY);

/** Removes every private trace of the user on this device: session, push token, offline files, preferences. */
export async function wipeLocalData(): Promise<void> {
  localStorage.removeItem(KEY);
  localStorage.removeItem(FCM_KEY);
  if ('caches' in window) {
    await caches.delete(PRIVATE_CACHE);
    await caches.delete(PREFS_CACHE);
  }
}

/** The service worker reads this preference from the Cache API (it has no access to localStorage). */
export async function setDiscreet(discreet: boolean): Promise<void> {
  if (!('caches' in window)) return;
  const cache = await caches.open(PREFS_CACHE);
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  await cache.put(
    `${base}__prefs`,
    new Response(JSON.stringify({ discreet }), { headers: { 'Content-Type': 'application/json' } }),
  );
}

export async function isDiscreet(): Promise<boolean> {
  if (!('caches' in window)) return false;
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const response = await (await caches.open(PREFS_CACHE)).match(`${base}__prefs`);
  if (!response) return false;
  const prefs = (await response.json()) as { discreet?: boolean };
  return prefs.discreet === true;
}
