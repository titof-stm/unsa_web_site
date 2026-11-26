import { PWA } from '../config';
import { subscribe, unsubscribe } from './api';
import { clearFcmToken, getStoredFcmToken, storeFcmToken } from './session';

export const pushConfigured = (): boolean =>
  PWA.apiUrl !== '' && PWA.firebase.apiKey !== '' && PWA.firebase.projectId !== '' && PWA.firebase.vapidKey !== '';

export const pushSupported = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function messagingModules() {
  const [{ initializeApp, getApps }, messaging] = await Promise.all([
    import('@firebase/app'),
    import('@firebase/messaging'),
  ]);
  const { vapidKey: _vapidKey, ...options } = PWA.firebase;
  const app = getApps()[0] ?? initializeApp(options);
  return { messaging, instance: messaging.getMessaging(app) };
}

export type PushResult = 'enabled' | 'denied' | 'unsupported';

/** Must be called from a user gesture (a click): iOS refuses permission prompts otherwise. */
export async function enablePush(sessionToken: string): Promise<PushResult> {
  if (!pushConfigured() || !pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const { messaging, instance } = await messagingModules();
  if (!(await messaging.isSupported())) return 'unsupported';
  const registration = await navigator.serviceWorker.ready;
  const fcmToken = await messaging.getToken(instance, {
    vapidKey: PWA.firebase.vapidKey,
    serviceWorkerRegistration: registration,
  });
  // The server only subscribes the token to the topic of the user's lot. It never stores it.
  await subscribe(sessionToken, fcmToken);
  storeFcmToken(fcmToken);
  return 'enabled';
}

export async function disablePush(sessionToken: string | null): Promise<void> {
  const fcmToken = getStoredFcmToken();
  if (fcmToken && sessionToken) {
    try {
      await unsubscribe(sessionToken, fcmToken);
    } catch {
      // The server may be unreachable or the session expired: deleting the token below still stops delivery.
    }
  }
  try {
    const { messaging, instance } = await messagingModules();
    await messaging.deleteToken(instance);
  } catch {
    // Nothing to delete (push never enabled, or unsupported browser).
  }
  clearFcmToken();
}

/** After a new login (for example with a renewed key), moves this device to the topic of the new lot. */
export async function refreshPushSubscription(sessionToken: string): Promise<void> {
  const fcmToken = getStoredFcmToken();
  if (!fcmToken || !pushSupported() || Notification.permission !== 'granted') return;
  try {
    await subscribe(sessionToken, fcmToken);
  } catch {
    // Best effort: the user can re-enable notifications from the settings page.
  }
}
