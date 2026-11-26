/**
 * UNSA documents area: anonymous access keys, document API and push notifications.
 *
 * Container-bound script: create it from the admin Google Sheet (Extensions > Apps Script).
 * See docs/GESTION_MEMBRES_RGPD.md for the privacy design and README.md for the set-up.
 *
 * Privacy rules enforced by this code:
 *  - a key is random and linked to nothing: no name, no email, no usage history per key;
 *  - keys are never stored in clear: only an HMAC-SHA256 hash (with a secret "pepper");
 *  - devices are never stored: push tokens are subscribed to a per-lot FCM topic and forgotten;
 *  - the key is never logged and never sent in a URL.
 */

const CONFIG = {
  SITE_URL: 'https://titof-stm.github.io/unsa_web_site/',
  MAX_DEPTH: 5,
  KEY_CHARS: 28, // 28 x 5 bits = 140 bits of randomness
  KEY_ALPHABET: '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
  SESSION_TTL_SHORT_S: 12 * 60 * 60,
  SESSION_TTL_LONG_S: 30 * 24 * 60 * 60,
  MAX_FILE_BYTES: 20 * 1024 * 1024,
  MAX_LISTING: 500,
  PURGE_GRACE_DAYS: 30,
  STATS_KEEP_DAYS: 366,
  FAILURE_WINDOW_S: 600,
  FAILURE_LIMIT: 60,
  STATE_CACHE_S: 60,
};

const SHEETS = {
  SETS: { name: 'Ensembles', header: ['id', 'titre', 'description', 'dossierDriveId'] },
  LOTS: { name: 'Lots', header: ['lot', 'type', 'ensembles', 'expireLe', 'revoque', 'creeLe', 'revoqueLe'] },
  KEYS: { name: 'Cles', header: ['keyHash', 'numero', 'lot', 'revoquee'] },
  LOG: { name: 'JournalAdmin', header: ['date', 'action', 'detail'] },
  STATS: { name: 'Stats', header: ['jour', 'connexions', 'echecs'] },
};

class ApiError_ extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/* Sheet access (the only place that touches the spreadsheet)          */
/* ------------------------------------------------------------------ */

function sheet_(def) {
  const book = SpreadsheetApp.getActive();
  return book.getSheetByName(def.name) || book.insertSheet(def.name);
}

/** Rows without the header line. */
function table_(def) {
  const sheet = sheet_(def);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, def.header.length).getValues();
}

function appendRows_(def, rows) {
  if (rows.length === 0) return;
  const sheet = sheet_(def);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, def.header.length).setValues(rows);
}

/** `rowIndex` is the 0-based index in table_() output. */
function setCell_(def, rowIndex, columnIndex, value) {
  sheet_(def).getRange(rowIndex + 2, columnIndex + 1).setValue(value);
}

/** Deletes rows (0-based indexes in table_() output), from the bottom up. */
function deleteRows_(def, rowIndexes) {
  const sheet = sheet_(def);
  rowIndexes.slice().sort((a, b) => b - a).forEach((i) => sheet.deleteRow(i + 2));
}

/* ------------------------------------------------------------------ */
/* Crypto helpers                                                      */
/* ------------------------------------------------------------------ */

function props_() {
  return PropertiesService.getScriptProperties();
}

function secret_(name) {
  const value = props_().getProperty(name);
  if (!value) throw new Error(`Secret manquant : ${name}. Lancez le menu « UNSA clés > Initialiser ».`);
  return value;
}

function toHex_(bytes) {
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function hmacHex_(secret, message) {
  return toHex_(Utilities.computeHmacSha256Signature(message, secret));
}

function b64urlBytes_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function b64urlText_(text) {
  return Utilities.base64EncodeWebSafe(text, Utilities.Charset.UTF_8).replace(/=+$/, '');
}

function fromB64urlText_(value) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(value)).getDataAsString('UTF-8');
}

/**
 * Cryptographically strong random bits. Apps Script has no crypto.getRandomValues, but
 * Utilities.getUuid() is a version-4 UUID from a secure generator: 30 of its 32 hex digits are
 * fully random (digits 12 and 16 hold the version and variant).
 */
function randomBits_(count) {
  let bits = '';
  while (bits.length < count) {
    const uuid = Utilities.getUuid().replace(/-/g, '');
    const usable = uuid.slice(0, 12) + uuid.slice(13, 16) + uuid.slice(17);
    for (const digit of usable) bits += ('000' + parseInt(digit, 16).toString(2)).slice(-4);
  }
  return bits.slice(0, count);
}

function randomSecret_() {
  return toHex_(randomBits_(256).match(/.{8}/g).map((b) => parseInt(b, 2)));
}

function randomKey_() {
  const bits = randomBits_(CONFIG.KEY_CHARS * 5);
  let key = '';
  for (let i = 0; i < CONFIG.KEY_CHARS; i += 1) {
    key += CONFIG.KEY_ALPHABET.charAt(parseInt(bits.slice(i * 5, i * 5 + 5), 2));
  }
  return key;
}

/** Groups of 4 for readability: ABCD-EFGH-... */
function formatKey_(key) {
  return key.match(/.{1,4}/g).join('-');
}

/** Returns the normalized key or '' when the input cannot be a key. Tolerates typing mistakes (O/0, I/L/1). */
function normalizeKey_(raw) {
  const key = String(raw)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (key.length !== CONFIG.KEY_CHARS) return '';
  for (const c of key) if (CONFIG.KEY_ALPHABET.indexOf(c) < 0) return '';
  return key;
}

function sameString_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

function signSession_(payload) {
  const body = b64urlText_(JSON.stringify(payload));
  return `${body}.${b64urlBytes_(Utilities.computeHmacSha256Signature(body, secret_('SESSION_SECRET')))}`;
}

function readSession_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new ApiError_('auth');
  const expected = b64urlBytes_(Utilities.computeHmacSha256Signature(parts[0], secret_('SESSION_SECRET')));
  if (!sameString_(expected, parts[1])) throw new ApiError_('auth');
  let payload;
  try {
    payload = JSON.parse(fromB64urlText_(parts[0]));
  } catch (error) {
    throw new ApiError_('auth');
  }
  if (!payload || typeof payload.e !== 'number' || payload.e * 1000 < Date.now()) throw new ApiError_('auth');
  return payload;
}

function isTrue_(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

/** Lots, sets and revoked keys, cached for a minute so that every API call can re-check revocation cheaply. */
function loadState_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('state');
  if (cached) return JSON.parse(cached);
  const lots = {};
  table_(SHEETS.LOTS).forEach((row) => {
    if (!row[0]) return;
    lots[String(row[0])] = {
      sets: String(row[2]).split(',').map((s) => s.trim()).filter(Boolean),
      exp: row[3] ? new Date(row[3]).getTime() : null,
      revoked: isTrue_(row[4]),
    };
  });
  const sets = {};
  table_(SHEETS.SETS).forEach((row) => {
    if (!row[0]) return;
    sets[String(row[0])] = {
      id: String(row[0]),
      title: String(row[1]),
      description: String(row[2]),
      folderId: String(row[3]),
    };
  });
  const revokedKeys = table_(SHEETS.KEYS)
    .filter((row) => isTrue_(row[3]))
    .map((row) => `${row[2]}|${row[1]}`);
  const state = { lots, sets, revokedKeys };
  cache.put('state', JSON.stringify(state), CONFIG.STATE_CACHE_S);
  return state;
}

function invalidateState_() {
  CacheService.getScriptCache().remove('state');
}

function isLotActive_(lot, now) {
  return Boolean(lot) && !lot.revoked && (lot.exp === null || lot.exp > now);
}

/** Verifies the token AND that the lot and key are still valid: revocation is immediate (within the cache delay). */
function requireSession_(token) {
  const payload = readSession_(token);
  const state = loadState_();
  const lot = state.lots[payload.l];
  if (!isLotActive_(lot, Date.now()) || state.revokedKeys.indexOf(`${payload.l}|${payload.n}`) >= 0) {
    throw new ApiError_('auth');
  }
  const sets = lot.sets.map((id) => state.sets[id]).filter(Boolean);
  return { lot: payload.l, number: payload.n, sets };
}

function requireSet_(session, setId) {
  const set = session.sets.filter((s) => s.id === String(setId))[0];
  if (!set) throw new ApiError_('forbidden');
  return set;
}

/* ------------------------------------------------------------------ */
/* Aggregated statistics only (no per-key data)                        */
/* ------------------------------------------------------------------ */

function bumpStat_(column) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const today = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
    const rows = table_(SHEETS.STATS);
    let index = -1;
    rows.forEach((row, i) => {
      const day = row[0] instanceof Date ? Utilities.formatDate(row[0], 'Europe/Paris', 'yyyy-MM-dd') : String(row[0]);
      if (day === today) index = i;
    });
    if (index < 0) {
      const fresh = [today, 0, 0];
      fresh[column] += 1;
      appendRows_(SHEETS.STATS, [fresh]);
    } else {
      setCell_(SHEETS.STATS, index, column, Number(rows[index][column]) + 1);
    }
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Web app                                                             */
/* ------------------------------------------------------------------ */

function doGet() {
  return ContentService.createTextOutput('UNSA API');
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (error) {
    return json_({ ok: false, error: 'bad-request' });
  }
  try {
    return json_(Object.assign({ ok: true }, dispatch_(body)));
  } catch (error) {
    if (error instanceof ApiError_) return json_({ ok: false, error: error.code });
    // Never log the request: it may contain a key or a token.
    console.error(String(error && error.message));
    return json_({ ok: false, error: 'server' });
  }
}

function dispatch_(body) {
  switch (body.action) {
    case 'login':
      return login_(body);
    case 'list':
      return list_(body);
    case 'file':
      return file_(body);
    case 'subscribe':
      return subscription_(body, 'batchAdd');
    case 'unsubscribe':
      return subscription_(body, 'batchRemove');
    default:
      throw new ApiError_('bad-request');
  }
}

/* ---- login ---- */

function loginAllowed_() {
  return Number(CacheService.getScriptCache().get('failures') || 0) < CONFIG.FAILURE_LIMIT;
}

function recordFailure_() {
  const cache = CacheService.getScriptCache();
  const failures = Number(cache.get('failures') || 0) + 1;
  cache.put('failures', String(failures), CONFIG.FAILURE_WINDOW_S);
  bumpStat_(2);
  Utilities.sleep(Math.min(3000, 100 * failures)); // slows down guessing without storing who guessed
}

function findKey_(hash) {
  const rows = table_(SHEETS.KEYS);
  for (let i = 0; i < rows.length; i += 1) {
    if (String(rows[i][0]) === hash) return { number: String(rows[i][1]), lot: String(rows[i][2]) };
  }
  return null;
}

function login_(body) {
  if (!loginAllowed_()) throw new ApiError_('rate');
  const key = normalizeKey_(body.key);
  const found = key ? findKey_(hmacHex_(secret_('PEPPER'), key)) : null;
  const state = loadState_();
  const lot = found ? state.lots[found.lot] : null;
  // Same answer for unknown, expired and revoked keys: nothing to learn from the error.
  if (!found || !isLotActive_(lot, Date.now()) || state.revokedKeys.indexOf(`${found.lot}|${found.number}`) >= 0) {
    recordFailure_();
    throw new ApiError_('auth');
  }
  const ttl = body.remember === true ? CONFIG.SESSION_TTL_LONG_S : CONFIG.SESSION_TTL_SHORT_S;
  let exp = Math.floor(Date.now() / 1000) + ttl;
  if (lot.exp !== null) exp = Math.min(exp, Math.floor(lot.exp / 1000));
  bumpStat_(1);
  return {
    token: signSession_({ n: found.number, l: found.lot, e: exp }),
    exp,
    sets: lot.sets
      .map((id) => state.sets[id])
      .filter(Boolean)
      .map((s) => ({ id: s.id, title: s.title, description: s.description })),
  };
}

/* ---- documents ---- */

function isInside_(item, rootId) {
  let level = [item];
  for (let depth = 0; depth <= CONFIG.MAX_DEPTH + 1 && level.length > 0; depth += 1) {
    const next = [];
    level.forEach((current) => {
      const parents = current.getParents();
      while (parents.hasNext()) next.push(parents.next());
    });
    if (next.some((parent) => parent.getId() === rootId)) return true;
    level = next;
  }
  return false;
}

function assertAllowed_(item, rootId) {
  if (item.isTrashed()) throw new ApiError_('forbidden');
  if (item.getId() !== rootId && !isInside_(item, rootId)) throw new ApiError_('forbidden');
}

function list_(body) {
  const session = requireSession_(body.token);
  const set = requireSet_(session, body.setId);
  const folder = DriveApp.getFolderById(body.folderId ? String(body.folderId) : set.folderId);
  assertAllowed_(folder, set.folderId);
  const folders = [];
  const subfolders = folder.getFolders();
  while (subfolders.hasNext() && folders.length < CONFIG.MAX_LISTING) {
    const sub = subfolders.next();
    if (!sub.isTrashed()) folders.push({ id: sub.getId(), name: sub.getName() });
  }
  const files = [];
  const children = folder.getFiles();
  while (children.hasNext() && files.length < CONFIG.MAX_LISTING) {
    const file = children.next();
    if (file.isTrashed()) continue;
    files.push({
      id: file.getId(),
      name: file.getName(),
      mime: file.getMimeType(),
      size: file.getSize(),
      modified: file.getLastUpdated().toISOString(),
    });
  }
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
  return { folders: folders.sort(byName), files: files.sort(byName) };
}

function file_(body) {
  const session = requireSession_(body.token);
  const set = requireSet_(session, body.setId);
  const file = DriveApp.getFileById(String(body.fileId));
  assertAllowed_(file, set.folderId);
  const mime = file.getMimeType();
  let blob;
  let name = file.getName();
  if (mime.indexOf('application/vnd.google-apps.') === 0) {
    if (mime === 'application/vnd.google-apps.folder') throw new ApiError_('forbidden');
    blob = file.getAs('application/pdf'); // Docs, Sheets and Slides are exported as PDF
    name += '.pdf';
  } else {
    if (file.getSize() > CONFIG.MAX_FILE_BYTES) throw new ApiError_('too-large');
    blob = file.getBlob();
  }
  const bytes = blob.getBytes();
  if (bytes.length > CONFIG.MAX_FILE_BYTES) throw new ApiError_('too-large');
  return { name, mime: blob.getContentType(), base64: Utilities.base64Encode(bytes) };
}

/* ------------------------------------------------------------------ */
/* Push notifications (Firebase Cloud Messaging, one topic per lot)    */
/* ------------------------------------------------------------------ */

const topicOf_ = (lot) => `lot-${lot}`;

function serviceAccount_() {
  return JSON.parse(secret_('FCM_SERVICE_ACCOUNT'));
}

function fcmAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('fcm-access');
  if (cached) return cached;
  const account = serviceAccount_();
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64urlText_(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) +
    '.' +
    b64urlText_(
      JSON.stringify({
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
  const assertion = `${unsigned}.${b64urlBytes_(Utilities.computeRsaSha256Signature(unsigned, account.private_key))}`;
  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('FCM authentication failed');
  const token = JSON.parse(response.getContentText()).access_token;
  cache.put('fcm-access', token, 3000);
  return token;
}

/** Adds or removes a device token to/from the topic of the caller's lot. The token is not kept. */
function subscription_(body, operation) {
  const session = requireSession_(body.token);
  const fcmToken = String(body.fcmToken || '');
  if (!/^[\w:.\-]{20,4096}$/.test(fcmToken)) throw new ApiError_('bad-request');
  const response = UrlFetchApp.fetch(`https://iid.googleapis.com/iid/v1:${operation}`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${fcmAccessToken_()}`, access_token_auth: 'true' },
    payload: JSON.stringify({ to: `/topics/${topicOf_(session.lot)}`, registration_tokens: [fcmToken] }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new ApiError_('push');
  const result = (JSON.parse(response.getContentText()).results || [])[0] || {};
  if (result.error) throw new ApiError_('push');
  return {};
}

function sendToTopic_(topic) {
  const account = serviceAccount_();
  const response = UrlFetchApp.fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${fcmAccessToken_()}` },
    // Data-only and generic: the service worker shows a fixed text. No document name travels through FCM.
    payload: JSON.stringify({
      message: { topic, data: { type: 'new' }, webpush: { headers: { TTL: '86400', Urgency: 'normal' } } },
    }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error(`FCM send failed (${response.getResponseCode()})`);
}

/** Hourly trigger: notifies, per lot, when a set it can access received new files. */
function checkNewDocuments() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) return;
  try {
    const now = new Date();
    const lastCheck = new Date(props_().getProperty('lastCheck') || now.toISOString());
    const state = loadState_();
    const changedSets = {};
    Object.keys(state.sets).forEach((id) => {
      const found = [];
      collectNewFiles_(DriveApp.getFolderById(state.sets[id].folderId), lastCheck, now, 0, found);
      if (found.length > 0) changedSets[id] = true;
    });
    const topics = {};
    Object.keys(state.lots).forEach((lotId) => {
      const lot = state.lots[lotId];
      if (isLotActive_(lot, now.getTime()) && lot.sets.some((id) => changedSets[id])) topics[topicOf_(lotId)] = true;
    });
    Object.keys(topics).forEach(sendToTopic_);
    // Only advance the checkpoint after a successful run, so failures are retried next hour.
    props_().setProperty('lastCheck', now.toISOString());
  } finally {
    lock.releaseLock();
  }
}

function collectNewFiles_(folder, since, until, depth, out) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const created = file.getDateCreated();
    if (created > since && created <= until && !file.isTrashed()) out.push(file.getId());
  }
  if (depth >= CONFIG.MAX_DEPTH) return;
  const folders = folder.getFolders();
  while (folders.hasNext()) collectNewFiles_(folders.next(), since, until, depth + 1, out);
}

/* ------------------------------------------------------------------ */
/* Admin menu (Google Sheet)                                           */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('UNSA clés')
    .addItem('Initialiser', 'initialize')
    .addSeparator()
    .addItem('Générer un lot de clés (cartes à imprimer)', 'generateLot')
    .addItem('Prolonger un lot', 'extendLot')
    .addItem('Révoquer un lot', 'revokeLot')
    .addItem('Révoquer une clé (n° de carte)', 'revokeKey')
    .addSeparator()
    .addItem('Purger les lots expirés', 'purgeExpired')
    .addItem('Changer les secrets (invalide toutes les clés)', 'rotateSecrets')
    .addToUi();
}

function adminLog_(action, detail) {
  appendRows_(SHEETS.LOG, [[new Date(), action, detail]]);
}

function ensureHeaders_() {
  Object.keys(SHEETS).forEach((name) => {
    const def = SHEETS[name];
    const sheet = sheet_(def);
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, def.header.length).setValues([def.header]).setFontWeight('bold');
  });
}

/** Run once: creates the sheets, the secrets and the hourly trigger. */
function initialize() {
  ensureHeaders_();
  const props = props_();
  if (!props.getProperty('PEPPER')) props.setProperty('PEPPER', randomSecret_());
  if (!props.getProperty('SESSION_SECRET')) props.setProperty('SESSION_SECRET', randomSecret_());
  if (!props.getProperty('lastCheck')) props.setProperty('lastCheck', new Date().toISOString());
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'checkNewDocuments')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkNewDocuments').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert(
    'Initialisation terminée.\n\n' +
      '1. Renseignez la feuille « Ensembles » (id, titre, description, ID du dossier Drive).\n' +
      '2. Ajoutez la propriété de script FCM_SERVICE_ACCOUNT (Paramètres du projet > Propriétés du script) pour les notifications.\n' +
      '3. Déployez en application web : exécuter en tant que « Moi », accès « Tout le monde ».',
  );
}

function ask_(title, message, validate) {
  const ui = SpreadsheetApp.getUi();
  for (;;) {
    const answer = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
    if (answer.getSelectedButton() !== ui.Button.OK) return null;
    const value = answer.getResponseText().trim();
    const problem = validate(value);
    if (!problem) return value;
    ui.alert(problem);
  }
}

const integerBetween_ = (min, max) => (value) =>
  /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max ? '' : `Saisissez un nombre entre ${min} et ${max}.`;

function generateLot() {
  ensureHeaders_();
  const state = loadState_();
  const lotId = ask_('Identifiant du lot', 'Lettres, chiffres et tirets (ex. 2026-A). Un lot = une période de validité.', (v) =>
    /^[A-Za-z0-9_-]{1,40}$/.test(v) && !state.lots[v] ? '' : 'Identifiant invalide ou déjà utilisé.',
  );
  if (!lotId) return;
  const type = ask_('Type de lot', 'Saisissez : membre ou invite', (v) => (v === 'membre' || v === 'invite' ? '' : 'membre ou invite.'));
  if (!type) return;
  const available = Object.keys(state.sets).join(', ') || '(aucun : remplissez la feuille Ensembles)';
  const setIds = ask_('Ensembles de documents', `Identifiants séparés par des virgules. Disponibles : ${available}`, (v) => {
    const ids = v.split(',').map((s) => s.trim()).filter(Boolean);
    return ids.length > 0 && ids.every((id) => state.sets[id]) ? '' : 'Ensemble inconnu.';
  });
  if (!setIds) return;
  const days = ask_('Durée de validité (jours)', 'Adhérents : 365. Invités : 7 à 30.', integerBetween_(1, 400));
  if (!days) return;
  const count = ask_('Nombre de clés', 'Prévoyez environ 10 % de marge (maximum 500).', integerBetween_(1, 500));
  if (!count) return;

  const pepper = secret_('PEPPER');
  const now = new Date();
  const expires = new Date(now.getTime() + Number(days) * 24 * 60 * 60 * 1000);
  const cards = [];
  const rows = [];
  for (let i = 1; i <= Number(count); i += 1) {
    const key = randomKey_();
    const number = `${lotId}-${('0000' + i).slice(-4)}`;
    rows.push([hmacHex_(pepper, key), number, lotId, false]);
    cards.push({ number, key: formatKey_(key) });
  }
  appendRows_(SHEETS.KEYS, rows);
  appendRows_(SHEETS.LOTS, [[lotId, type, setIds.split(',').map((s) => s.trim()).join(','), expires, false, now, '']]);
  invalidateState_();
  adminLog_('generate-lot', `${lotId}: ${count} cles, ${type}, expire ${Utilities.formatDate(expires, 'Europe/Paris', 'yyyy-MM-dd')}`);

  // Shuffle so that print order never reveals the order in which cards were created.
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = parseInt(randomBits_(16), 2) % (i + 1);
    const swap = cards[i];
    cards[i] = cards[j];
    cards[j] = swap;
  }
  const template = HtmlService.createTemplateFromFile('Cards');
  template.data = JSON.stringify({
    cards,
    siteUrl: `${CONFIG.SITE_URL}documents/`,
    lot: lotId,
    expires: Utilities.formatDate(expires, 'Europe/Paris', 'dd/MM/yyyy'),
  }).replace(/</g, '\\u003c');
  SpreadsheetApp.getUi().showModalDialog(template.evaluate().setWidth(900).setHeight(700), `Cartes du lot ${lotId}`);
}

function findLotRow_(lotId) {
  const rows = table_(SHEETS.LOTS);
  for (let i = 0; i < rows.length; i += 1) if (String(rows[i][0]) === lotId) return i;
  return -1;
}

function askExistingLot_(title) {
  return ask_(title, 'Identifiant du lot', (v) => (findLotRow_(v) >= 0 ? '' : 'Lot introuvable.'));
}

function revokeLot() {
  const lotId = askExistingLot_('Révoquer un lot');
  if (!lotId) return;
  const row = findLotRow_(lotId);
  setCell_(SHEETS.LOTS, row, 4, true);
  setCell_(SHEETS.LOTS, row, 6, new Date());
  invalidateState_();
  adminLog_('revoke-lot', lotId);
  SpreadsheetApp.getUi().alert(`Lot ${lotId} révoqué : toutes ses clés sont désactivées.`);
}

function extendLot() {
  const lotId = askExistingLot_('Prolonger un lot');
  if (!lotId) return;
  const days = ask_('Nouvelle durée', 'Jours à partir d’aujourd’hui.', integerBetween_(1, 400));
  if (!days) return;
  const expires = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
  setCell_(SHEETS.LOTS, findLotRow_(lotId), 3, expires);
  invalidateState_();
  adminLog_('extend-lot', `${lotId}: +${days} jours`);
}

function revokeKey() {
  const number = ask_('Révoquer une clé', 'Numéro imprimé sur la carte (ex. 2026-A-0042)', () => '');
  if (!number) return;
  const rows = table_(SHEETS.KEYS);
  const index = rows.findIndex((row) => String(row[1]) === number);
  if (index < 0) {
    SpreadsheetApp.getUi().alert('Numéro introuvable.');
    return;
  }
  setCell_(SHEETS.KEYS, index, 3, true);
  invalidateState_();
  adminLog_('revoke-key', number);
  SpreadsheetApp.getUi().alert(`Clé ${number} révoquée.`);
}

/** Deletes lots (and their key hashes) expired or revoked for more than 30 days, and old statistics. */
function purgeExpired() {
  const limit = Date.now() - CONFIG.PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  const lots = table_(SHEETS.LOTS);
  const purged = {};
  const lotRows = [];
  lots.forEach((row, i) => {
    const ended = isTrue_(row[4]) ? new Date(row[6] || row[3]).getTime() : row[3] ? new Date(row[3]).getTime() : Infinity;
    if (ended < limit) {
      purged[String(row[0])] = true;
      lotRows.push(i);
    }
  });
  const keyRows = [];
  table_(SHEETS.KEYS).forEach((row, i) => {
    if (purged[String(row[2])]) keyRows.push(i);
  });
  deleteRows_(SHEETS.KEYS, keyRows);
  deleteRows_(SHEETS.LOTS, lotRows);

  const statsLimit = Date.now() - CONFIG.STATS_KEEP_DAYS * 24 * 60 * 60 * 1000;
  const oldStats = [];
  table_(SHEETS.STATS).forEach((row, i) => {
    if (new Date(row[0]).getTime() < statsLimit) oldStats.push(i);
  });
  deleteRows_(SHEETS.STATS, oldStats);
  const oldLog = [];
  table_(SHEETS.LOG).forEach((row, i) => {
    if (new Date(row[0]).getTime() < statsLimit) oldLog.push(i);
  });
  deleteRows_(SHEETS.LOG, oldLog);

  invalidateState_();
  adminLog_('purge', `${lotRows.length} lots, ${keyRows.length} cles`);
  SpreadsheetApp.getUi().alert(`${lotRows.length} lot(s) et ${keyRows.length} clé(s) supprimés.`);
}

/** After a suspected compromise: every key hash and every session becomes invalid. Generate new lots afterwards. */
function rotateSecrets() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert(
    'Changer les secrets',
    'TOUTES les clés et sessions actuelles deviendront invalides. Il faudra générer de nouveaux lots et redistribuer les cartes. Continuer ?',
    ui.ButtonSet.YES_NO,
  );
  if (answer !== ui.Button.YES) return;
  props_().setProperty('PEPPER', randomSecret_());
  props_().setProperty('SESSION_SECRET', randomSecret_());
  invalidateState_();
  adminLog_('rotate-secrets', '');
}
