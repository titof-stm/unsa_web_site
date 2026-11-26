import {
  ApiError,
  apiConfigured,
  getFile,
  listFolder,
  login,
  type FileEntry,
  type FolderEntry,
  type Session,
  type SetInfo,
} from '../lib/api';
import {
  isSavedOffline,
  listOffline,
  offlineSupported,
  readOffline,
  removeOffline,
  saveOffline,
  type OfflineFile,
} from '../lib/offline';
import { disablePush, refreshPushSubscription } from '../lib/push';
import { loadSession, saveSession, wipeLocalData } from '../lib/session';

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
};

// All server-provided text goes through textContent: never innerHTML.
function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function button(label: string, onClick: () => void, className = 'button button--small'): HTMLButtonElement {
  const element = node('button', className, label);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

const MESSAGES: Record<string, string> = {
  network: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  rate: 'Trop de tentatives. Réessayez dans quelques minutes.',
  'too-large': 'Ce fichier est trop volumineux pour être ouvert ici.',
  forbidden: 'Ce contenu n’est pas accessible avec votre clé.',
};
const messageFor = (error: unknown): string =>
  (error instanceof ApiError && MESSAGES[error.code]) || 'Une erreur est survenue. Réessayez plus tard.';

const loginSection = $('doc-login');
const appSection = $('doc-app');
const offlineSection = $('doc-offline');
const loginStatus = $('login-status');
const appStatus = $('app-status');
const setsList = $('sets');
const browser = $('browser');
const crumbs = $('crumbs');
const listing = $('listing');
const offlineList = $('offline-list');
const viewer = $<HTMLDialogElement>('viewer');
const viewerBody = $('viewer-body');

let session: Session | null = null;
let currentSet: SetInfo | null = null;
let trail: { id?: string; name: string }[] = [];

function setStatus(target: HTMLElement, text: string, kind: 'error' | 'ok' | '' = ''): void {
  target.textContent = text;
  if (kind) target.dataset['kind'] = kind;
  else delete target.dataset['kind'];
}

function showLogin(message = ''): void {
  session = null;
  appSection.hidden = true;
  loginSection.hidden = false;
  setStatus(loginStatus, message, message ? 'error' : '');
}

function showApp(active: Session): void {
  session = active;
  loginSection.hidden = true;
  appSection.hidden = false;
  browser.hidden = true;
  setStatus(appStatus, '');
  setsList.replaceChildren();
  for (const set of active.sets) {
    const card = node('li', 'card');
    card.append(node('h2', '', set.title), node('p', '', set.description));
    card.append(button('Ouvrir', () => void openSet(set), 'button'));
    setsList.append(card);
  }
  if (active.sets.length === 1 && active.sets[0]) void openSet(active.sets[0]);
}

function handleError(error: unknown): void {
  if (error instanceof ApiError && error.code === 'auth') {
    void wipeLocalData().then(() => showLogin('Votre accès a expiré ou a été révoqué. Saisissez une clé valide.'));
    return;
  }
  setStatus(appStatus, messageFor(error), 'error');
}

async function openSet(set: SetInfo): Promise<void> {
  currentSet = set;
  trail = [{ name: set.title }];
  await loadFolder();
}

async function navigateTo(index: number): Promise<void> {
  trail = trail.slice(0, index + 1);
  await loadFolder();
}

async function loadFolder(): Promise<void> {
  if (!session || !currentSet) return;
  const folderId = trail[trail.length - 1]?.id;
  setStatus(appStatus, 'Chargement…');
  try {
    const result = await listFolder(session.token, currentSet.id, folderId);
    setStatus(appStatus, '');
    renderListing(result.folders, result.files);
  } catch (error) {
    handleError(error);
  }
}

function renderCrumbs(): void {
  crumbs.replaceChildren();
  trail.forEach((step, index) => {
    if (index > 0) crumbs.append(node('span', '', '›'));
    if (index === trail.length - 1) crumbs.append(node('strong', '', step.name));
    else crumbs.append(button(step.name, () => void navigateTo(index), ''));
  });
}

const formatSize = (bytes: number): string =>
  bytes <= 0 ? '' : bytes < 1_048_576 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1_048_576).toFixed(1)} Mo`;
const formatDate = (iso: string): string => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '');

function renderListing(folders: readonly FolderEntry[], files: readonly FileEntry[]): void {
  browser.hidden = false;
  renderCrumbs();
  listing.replaceChildren();
  for (const folder of folders) {
    const item = node('li', 'doc-item');
    item.append(node('span', 'doc-item__name', `📁 ${folder.name}`));
    item.append(
      button('Ouvrir le dossier', () => {
        trail.push({ id: folder.id, name: folder.name });
        void loadFolder();
      }),
    );
    listing.append(item);
  }
  for (const file of files) listing.append(fileItem(file));
  if (folders.length + files.length === 0) listing.append(node('li', 'note', 'Ce dossier est vide.'));
}

function fileItem(file: FileEntry): HTMLElement {
  const item = node('li', 'doc-item');
  const name = node('span', 'doc-item__name', file.name);
  name.append(node('small', '', [formatDate(file.modified), formatSize(file.size)].filter(Boolean).join(' · ')));
  const actions = node('div', 'doc-item__actions');
  actions.append(
    button('Ouvrir', () => void openFile(file, 'view')),
    button('Télécharger', () => void openFile(file, 'download'), 'button button--ghost button--small'),
  );
  if (offlineSupported()) {
    const toggle = button('Hors connexion', () => void toggleOffline(file, toggle), 'button button--ghost button--small');
    toggle.setAttribute('aria-pressed', 'false');
    void isSavedOffline(file.id).then((saved) => markOffline(toggle, saved));
    actions.append(toggle);
  }
  item.append(name, actions);
  return item;
}

function markOffline(toggle: HTMLButtonElement, saved: boolean): void {
  toggle.setAttribute('aria-pressed', String(saved));
  toggle.textContent = saved ? '✓ Hors connexion' : 'Hors connexion';
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function fetchBlob(file: FileEntry): Promise<{ blob: Blob; name: string } | null> {
  const saved = await readOffline(file.id);
  if (saved) return { blob: saved, name: file.name };
  if (!session || !currentSet) return null;
  setStatus(appStatus, `Téléchargement de « ${file.name} »…`);
  try {
    const content = await getFile(session.token, currentSet.id, file.id);
    setStatus(appStatus, '');
    return { blob: base64ToBlob(content.base64, content.mime), name: content.name };
  } catch (error) {
    handleError(error);
    return null;
  }
}

async function openFile(file: FileEntry, mode: 'view' | 'download'): Promise<void> {
  const result = await fetchBlob(file);
  if (result) present(result.blob, result.name, mode);
}

function present(blob: Blob, name: string, mode: 'view' | 'download'): void {
  const objectUrl = URL.createObjectURL(blob);
  const viewable = blob.type === 'application/pdf' || blob.type.startsWith('image/');
  if (mode === 'view' && viewable) {
    $('viewer-title').textContent = name;
    viewerBody.replaceChildren();
    if (blob.type === 'application/pdf') {
      const frame = node('iframe');
      frame.title = name;
      frame.src = objectUrl;
      viewerBody.append(frame);
    } else {
      const image = node('img');
      image.alt = name;
      image.src = objectUrl;
      viewerBody.append(image);
    }
    viewer.dataset['url'] = objectUrl;
    viewer.showModal();
    return;
  }
  const link = node('a');
  link.href = objectUrl;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function closeViewer(): void {
  viewerBody.replaceChildren();
  const objectUrl = viewer.dataset['url'];
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  delete viewer.dataset['url'];
}
$('viewer-close').addEventListener('click', () => viewer.close());
viewer.addEventListener('close', closeViewer);

async function toggleOffline(file: FileEntry, toggle: HTMLButtonElement): Promise<void> {
  if (await isSavedOffline(file.id)) {
    await removeOffline(file.id);
    markOffline(toggle, false);
  } else {
    const result = await fetchBlob(file);
    if (!result) return;
    await saveOffline(file.id, file.name, result.blob.type || file.mime, result.blob);
    markOffline(toggle, true);
  }
  await renderOffline();
}

async function renderOffline(): Promise<void> {
  const files: OfflineFile[] = await listOffline();
  offlineSection.hidden = files.length === 0;
  offlineList.replaceChildren();
  for (const file of files) {
    const item = node('li', 'doc-item');
    item.append(node('span', 'doc-item__name', file.name));
    const actions = node('div', 'doc-item__actions');
    actions.append(
      button('Ouvrir', () => void readOffline(file.id).then((blob) => blob && present(blob, file.name, 'view'))),
      button(
        'Retirer',
        () => void removeOffline(file.id).then(() => renderOffline()),
        'button button--ghost button--small',
      ),
    );
    item.append(actions);
    offlineList.append(item);
  }
}

const form = $<HTMLFormElement>('login-form');
const keyInput = $<HTMLInputElement>('key');
$<HTMLInputElement>('show-key').addEventListener('change', (event) => {
  keyInput.type = (event.target as HTMLInputElement).checked ? 'text' : 'password';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const key = keyInput.value.trim();
  if (!key) {
    setStatus(loginStatus, 'Saisissez votre clé d’accès.', 'error');
    return;
  }
  const submit = form.querySelector<HTMLButtonElement>('button[type=submit]');
  if (submit) submit.disabled = true;
  setStatus(loginStatus, 'Vérification…');
  login(key, $<HTMLInputElement>('remember').checked)
    .then((active) => {
      keyInput.value = '';
      saveSession(active);
      showApp(active);
      void refreshPushSubscription(active.token);
    })
    .catch((error: unknown) => {
      const message =
        error instanceof ApiError && error.code === 'auth'
          ? 'Clé invalide, expirée ou révoquée.'
          : messageFor(error);
      setStatus(loginStatus, message, 'error');
    })
    .finally(() => {
      if (submit) submit.disabled = false;
    });
});

$('logout').addEventListener('click', () => {
  const token = session?.token ?? null;
  void disablePush(token)
    .then(() => wipeLocalData())
    .then(() => {
      showLogin('Vous êtes déconnecté. Les données de cet appareil ont été effacées.');
      offlineSection.hidden = true;
    });
});

async function init(): Promise<void> {
  void renderOffline();
  if (!apiConfigured()) {
    $('doc-unconfigured').hidden = false;
    return;
  }
  // A QR code opens /documents/#k=KEY. The fragment never reaches the server, and is removed from the URL.
  const match = /(?:^|[#&])k=([^&]+)/.exec(location.hash);
  if (match?.[1]) {
    history.replaceState(null, '', location.pathname + location.search);
    keyInput.value = decodeURIComponent(match[1]);
    showLogin();
    setStatus(loginStatus, 'Clé reconnue dans le QR code : appuyez sur « Accéder aux documents ».', 'ok');
    return;
  }
  const active = loadSession();
  if (active) showApp(active);
  else showLogin();
}

void init();
