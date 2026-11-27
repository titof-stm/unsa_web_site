export const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** True when the browser offers one-tap installation, or on iOS where it is done by hand from Safari. */
export const canInstall = (): boolean => !isStandalone() && (window.__unsaInstall != null || isIos());

/** Starts the native install dialog when available. Returns false when the manual (iOS) guide is needed. */
export async function promptInstall(): Promise<boolean> {
  const event = window.__unsaInstall;
  if (!event) return false;
  await event.prompt();
  window.__unsaInstall = null;
  return true;
}
