import { PWA } from '../config';
import { isIos, isStandalone } from '../lib/install';
import { disablePush, enablePush, pushConfigured, pushSupported } from '../lib/push';
import { getStoredFcmToken, isDiscreet, loadSession, setDiscreet, wipeLocalData } from '../lib/session';

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
};

const installState = $('install-state');
const installButton = $<HTMLButtonElement>('install-btn');
const iosHelp = $('ios-help');
const pushState = $('push-state');
const enableButton = $<HTMLButtonElement>('push-enable');
const disableButton = $<HTMLButtonElement>('push-disable');
const discreet = $<HTMLInputElement>('discreet');


function renderInstall(): void {
  installButton.hidden = true;
  iosHelp.hidden = true;
  if (isStandalone()) {
    installState.textContent = 'L’application est installée sur cet appareil.';
  } else if (window.__unsaInstall) {
    installState.textContent = 'Votre navigateur permet d’installer l’application en un geste.';
    installButton.hidden = false;
  } else if (isIos()) {
    installState.textContent = 'Sur iOS, l’installation se fait depuis Safari.';
    iosHelp.hidden = false;
  } else {
    installState.textContent =
      'Utilisez le menu de votre navigateur (« Installer l’application » ou « Ajouter à l’écran d’accueil »).';
  }
}

installButton.addEventListener('click', () => {
  const prompt = window.__unsaInstall;
  if (!prompt) return;
  void prompt.prompt().then(() => {
    window.__unsaInstall = null;
    renderInstall();
  });
});
document.addEventListener('unsa:install-available', renderInstall);
document.addEventListener('unsa:installed', renderInstall);
renderInstall();

function renderPush(message = '', kind: 'error' | 'ok' | '' = ''): void {
  enableButton.hidden = true;
  disableButton.hidden = true;
  if (kind) pushState.dataset['kind'] = kind;
  else delete pushState.dataset['kind'];

  if (!PWA.apiUrl || !pushConfigured()) {
    pushState.textContent = 'Les notifications ne sont pas encore disponibles.';
    return;
  }
  if (!pushSupported()) {
    pushState.textContent = isIos()
      ? 'Sur iOS, installez d’abord l’application sur l’écran d’accueil (voir ci-dessus), puis revenez ici.'
      : 'Ce navigateur ne permet pas les notifications.';
    return;
  }
  if (Notification.permission === 'denied') {
    pushState.textContent =
      'Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages de votre navigateur.';
    return;
  }
  const active = getStoredFcmToken() !== null && Notification.permission === 'granted';
  if (active) {
    pushState.textContent = message || 'Les notifications sont activées sur cet appareil.';
    disableButton.hidden = false;
  } else if (!loadSession()) {
    pushState.textContent = 'Connectez-vous d’abord à l’espace documents avec votre clé pour activer les notifications.';
  } else {
    pushState.textContent = message || 'Les notifications sont désactivées.';
    enableButton.hidden = false;
  }
}

enableButton.addEventListener('click', () => {
  const session = loadSession();
  if (!session) {
    renderPush();
    return;
  }
  enableButton.disabled = true;
  enablePush(session.token)
    .then((result) => {
      if (result === 'enabled') renderPush('Notifications activées.', 'ok');
      else if (result === 'denied') renderPush('Autorisation refusée.', 'error');
      else renderPush('Notifications non prises en charge ici.', 'error');
    })
    .catch(() => renderPush('Activation impossible pour le moment. Réessayez plus tard.', 'error'))
    .finally(() => {
      enableButton.disabled = false;
    });
});

disableButton.addEventListener('click', () => {
  disableButton.disabled = true;
  void disablePush(loadSession()?.token ?? null).then(() => {
    disableButton.disabled = false;
    renderPush('Notifications désactivées.', 'ok');
  });
});

discreet.addEventListener('change', () => void setDiscreet(discreet.checked));
void isDiscreet().then((value) => {
  discreet.checked = value;
});

$('wipe').addEventListener('click', () => {
  void disablePush(loadSession()?.token ?? null)
    .then(() => wipeLocalData())
    .then(() => {
      $('wipe-state').textContent = 'Session, notifications et documents hors connexion ont été effacés de cet appareil.';
      discreet.checked = false;
      renderPush();
    });
});

renderPush();
