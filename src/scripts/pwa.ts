// Registers the service worker (production only), shows "update available" and keeps the
// browser's install prompt to offer an "Install" banner, a menu button and a settings button.
import { canInstall, isIos, promptInstall } from '../lib/install';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __unsaInstall?: BeforeInstallPromptEvent | null;
  }
}

const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
const DISMISS_KEY = 'unsa.install.dismissed';
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

const recentlyDismissed = (): boolean => {
  const at = Number(localStorage.getItem(DISMISS_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS;
};

async function install(): Promise<void> {
  if (!(await promptInstall())) location.href = `${base}parametres/`;
}

function removeInstallBanner(): void {
  document.querySelector('.install-banner')?.remove();
}

function showInstallBanner(): void {
  if (document.querySelector('.install-banner') || recentlyDismissed()) return;
  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Installer l’application');
  const text = document.createElement('p');
  text.textContent = isIos()
    ? 'Installez l’application UNSA sur votre écran d’accueil pour y accéder en un geste.'
    : 'Installez l’application UNSA pour y accéder en un geste, même hors connexion.';
  const actions = document.createElement('div');
  actions.className = 'install-banner__actions';
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'button button--light button--small';
  accept.textContent = isIos() ? 'Voir comment' : 'Installer';
  accept.addEventListener('click', () => void install());
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'button button--outline-light button--small';
  later.textContent = 'Plus tard';
  later.addEventListener('click', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    removeInstallBanner();
  });
  actions.append(accept, later);
  banner.append(text, actions);
  document.body.append(banner);
}

/** Shows the menu button and the banner only when installing is actually possible. */
function refreshInstallUi(): void {
  const possible = canInstall();
  document.querySelectorAll<HTMLElement>('.nav-install').forEach((item) => {
    item.hidden = !possible;
  });
  if (!possible) removeInstallBanner();
  else if (!location.pathname.startsWith(`${base}parametres`)) showInstallBanner();
}

document.querySelectorAll<HTMLElement>('[data-install]').forEach((button) =>
  button.addEventListener('click', () => void install()),
);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.__unsaInstall = event as BeforeInstallPromptEvent;
  document.dispatchEvent(new CustomEvent('unsa:install-available'));
  refreshInstallUi();
});

window.addEventListener('appinstalled', () => {
  window.__unsaInstall = null;
  document.dispatchEvent(new CustomEvent('unsa:installed'));
  refreshInstallUi();
});

// iOS never fires beforeinstallprompt: check once the page is ready.
window.addEventListener('load', () => setTimeout(refreshInstallUi, 1500));

const markConnectivity = () => {
  document.documentElement.toggleAttribute('data-offline', !navigator.onLine);
};
window.addEventListener('online', markConnectivity);
window.addEventListener('offline', markConnectivity);
markConnectivity();

function showUpdateBanner(worker: ServiceWorker): void {
  if (document.querySelector('.update-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.setAttribute('role', 'status');
  const text = document.createElement('p');
  text.textContent = 'Une nouvelle version du site est disponible.';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--light button--small';
  button.textContent = 'Mettre à jour';
  button.addEventListener('click', () => worker.postMessage('SKIP_WAITING'));
  banner.append(text, button);
  document.body.append(banner);
}

async function register(): Promise<void> {
  const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
  const watch = (worker: ServiceWorker | null) => {
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
    });
  };
  if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration.waiting);
  registration.addEventListener('updatefound', () => watch(registration.installing));

  let reloading = false;
  const hadController = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The very first install also claims the page: no reload needed then.
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
  // Look for a new version when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
  });
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void register().catch(() => undefined);
  });
}

export {};
