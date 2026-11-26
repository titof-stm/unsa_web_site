// Registers the service worker (production only), shows "update available" and keeps the
// browser's install prompt so that the settings page can offer an "Install" button.

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

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.__unsaInstall = event as BeforeInstallPromptEvent;
  document.dispatchEvent(new CustomEvent('unsa:install-available'));
});

window.addEventListener('appinstalled', () => {
  window.__unsaInstall = null;
  document.dispatchEvent(new CustomEvent('unsa:installed'));
});

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
