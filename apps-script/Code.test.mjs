// Offline tests for apps-script/Code.gs: the script runs in a Node VM with in-memory stand-ins for
// the Google services. Run with: npm run test:apps-script
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');

const signed = (buffer) => Array.from(buffer, (b) => (b > 127 ? b - 256 : b));
const unsigned = (bytes) => Buffer.from(bytes.map((b) => b & 0xff));
const toBuffer = (input) => (typeof input === 'string' ? Buffer.from(input, 'utf8') : unsigned(input));
const webSafe = (buffer) => buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

/** Builds a fresh script instance with fake Drive tree, sheets and services. */
function setup() {
  const tables = { Ensembles: [], Lots: [], Cles: [], JournalAdmin: [], Stats: [] };
  const cache = new Map();
  const properties = new Map();
  const fetches = [];
  const prompts = [];
  const dialogs = [];

  const drive = {};
  const addNode = (id, name, parentIds = [], { trashed = false, content = 'data', mime = 'application/pdf' } = {}) => {
    drive[id] = { id, name, parentIds, trashed, content, mime, isFolder: mime === 'folder' };
  };
  const wrap = (node) => ({
    getId: () => node.id,
    getName: () => node.name,
    isTrashed: () => node.trashed,
    getParents: () => iterator(node.parentIds.map((p) => wrap(drive[p]))),
    getFolders: () => iterator(Object.values(drive).filter((n) => n.isFolder && n.parentIds.includes(node.id)).map(wrap)),
    getFiles: () => iterator(Object.values(drive).filter((n) => !n.isFolder && n.parentIds.includes(node.id)).map(wrap)),
    getMimeType: () => node.mime,
    getSize: () => Buffer.byteLength(node.content),
    getLastUpdated: () => new Date('2026-01-02T03:04:05Z'),
    getDateCreated: () => node.created ?? new Date('2026-01-01T00:00:00Z'),
    getBlob: () => ({ getBytes: () => signed(Buffer.from(node.content)), getContentType: () => node.mime }),
    getAs: () => ({ getBytes: () => signed(Buffer.from(`pdf:${node.content}`)), getContentType: () => 'application/pdf' }),
  });
  const iterator = (items) => {
    let i = 0;
    return { hasNext: () => i < items.length, next: () => items[i++] };
  };

  const context = {
    console,
    Utilities: {
      Charset: { UTF_8: 'UTF_8' },
      computeHmacSha256Signature: (message, secret) => signed(createHmac('sha256', toBuffer(secret)).update(toBuffer(message)).digest()),
      computeRsaSha256Signature: () => [1, 2, 3],
      base64EncodeWebSafe: (input) => webSafe(toBuffer(input)),
      base64DecodeWebSafe: (text) => signed(Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      base64Encode: (bytes) => unsigned(bytes).toString('base64'),
      newBlob: (bytes) => ({ getDataAsString: () => unsigned(bytes).toString('utf8') }),
      getUuid: () => randomUUID(),
      sleep: () => undefined,
      formatDate: (date, _zone, pattern) => {
        const iso = new Date(date).toISOString();
        return pattern === 'dd/MM/yyyy' ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso.slice(0, 10);
      },
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => cache.get(key) ?? null,
        put: (key, value) => void cache.set(key, value),
        remove: (key) => void cache.delete(key),
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties.get(key) ?? null,
        setProperty: (key, value) => void properties.set(key, value),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    DriveApp: {
      getFolderById: (id) => wrap(drive[id]),
      getFileById: (id) => wrap(drive[id]),
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        fetches.push({ url, options });
        const body = url.includes('oauth2') ? { access_token: 'access' } : url.includes('iid') ? { results: [{}] } : {};
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(body) };
      },
    },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => undefined },
    HtmlService: {
      createTemplateFromFile: () => ({
        evaluate() {
          dialogs.push(this.data);
          return { setWidth() { return this; }, setHeight() { return this; } };
        },
      }),
    },
    SpreadsheetApp: {
      getUi: () => ({
        ButtonSet: { OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
        Button: { OK: 'OK', YES: 'YES' },
        prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => prompts.shift() }),
        alert: () => 'YES',
        showModalDialog: () => undefined,
      }),
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  // Replace the sheet layer with in-memory tables.
  const nameOf = (def) => def.name;
  context.table_ = (def) => tables[nameOf(def)].map((row) => [...row]);
  context.appendRows_ = (def, rows) => void tables[nameOf(def)].push(...rows.map((row) => [...row]));
  context.setCell_ = (def, row, column, value) => void (tables[nameOf(def)][row][column] = value);
  context.deleteRows_ = (def, indexes) => indexes.slice().sort((a, b) => b - a).forEach((i) => tables[nameOf(def)].splice(i, 1));
  context.ensureHeaders_ = () => undefined;

  properties.set('PEPPER', 'pepper-for-tests');
  properties.set('SESSION_SECRET', 'session-secret-for-tests');
  properties.set('FCM_SERVICE_ACCOUNT', JSON.stringify({ client_email: 'sa@example.iam', private_key: 'x', project_id: 'demo' }));

  addNode('root-a', 'Comptes rendus', [], { mime: 'folder' });
  addNode('sub-a', '2026', ['root-a'], { mime: 'folder' });
  addNode('file-a', 'cr.pdf', ['sub-a'], { content: 'hello' });
  addNode('root-b', 'Prive', [], { mime: 'folder' });
  addNode('file-b', 'secret.pdf', ['root-b']);
  addNode('file-trashed', 'old.pdf', ['root-a'], { trashed: true });
  tables.Ensembles.push(['A', 'Comptes rendus', 'Réunions', 'root-a'], ['B', 'Privé', 'Bureau', 'root-b']);

  const call = (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  const addLot = (lot, sets, { expires = Date.now() + 86_400_000, revoked = false } = {}) =>
    tables.Lots.push([lot, 'membre', sets, new Date(expires), revoked, new Date(), '']);
  const addKey = (lot, number, key) => {
    tables.Cles.push([context.hmacHex_('pepper-for-tests', key), number, lot, false]);
    context.invalidateState_();
  };
  return { context, tables, call, addLot, addKey, addNode, fetches, prompts, dialogs, cache };
}

const KEY = 'ABCDEFGHJKMNPQRSTVWXYZ234567'; // 28 characters of the alphabet

test('generated keys have 140 bits of entropy in a readable alphabet and never repeat', () => {
  const { context } = setup();
  const seen = new Set();
  for (let i = 0; i < 2000; i += 1) {
    const key = context.randomKey_();
    assert.match(key, /^[0-9A-HJKMNP-TV-Z]{28}$/);
    seen.add(key);
  }
  assert.equal(seen.size, 2000);
  assert.match(context.formatKey_(KEY), /^([0-9A-Z]{4}-){6}[0-9A-Z]{4}$/);
});

test('key normalization tolerates formatting and look-alike characters only', () => {
  const { context } = setup();
  assert.equal(context.normalizeKey_(context.formatKey_(KEY).toLowerCase()), KEY);
  assert.equal(context.normalizeKey_('  ' + KEY.replace(/0/g, 'O') + ' '), KEY.replace(/O/g, '0'));
  assert.equal(context.normalizeKey_(KEY.slice(1)), '');
  assert.equal(context.normalizeKey_(KEY.slice(0, 27) + 'U'), '');
});

test('login: valid key gives a session for the lot sets only', () => {
  const { call, addLot, addKey } = setup();
  addLot('2026-A', 'A');
  addKey('2026-A', '2026-A-0001', KEY);
  const response = call({ action: 'login', key: KEY, remember: false });
  assert.equal(response.ok, true);
  assert.deepEqual(response.sets.map((s) => s.id), ['A']);
  assert.ok(response.exp * 1000 - Date.now() <= 12 * 3600 * 1000 + 5000);
  assert.equal(JSON.stringify(response).includes('root-a'), false, 'drive folder ids must not leak');
});

test('login: unknown, expired and revoked keys get the same answer', () => {
  const { call, addLot, addKey, tables, context } = setup();
  addLot('old', 'A', { expires: Date.now() - 1000 });
  addLot('dead', 'A', { revoked: true });
  addLot('live', 'A');
  const keys = ['0'.repeat(28), '1'.repeat(28), '2'.repeat(28), '3'.repeat(28)];
  addKey('old', 'old-1', keys[0]);
  addKey('dead', 'dead-1', keys[1]);
  addKey('live', 'live-1', keys[2]);
  addKey('live', 'live-2', keys[3]);
  tables.Cles[3][3] = true; // single key revoked
  context.invalidateState_();
  for (const key of [keys[0], keys[1], keys[3], '4'.repeat(28), 'nonsense']) {
    assert.deepEqual(call({ action: 'login', key }), { ok: false, error: 'auth' });
  }
  assert.equal(call({ action: 'login', key: keys[2] }).ok, true);
});

test('login is rate limited globally after too many failures', () => {
  const { call, addLot, addKey } = setup();
  addLot('L', 'A');
  addKey('L', 'L-1', KEY);
  for (let i = 0; i < 60; i += 1) call({ action: 'login', key: 'WRONG' });
  assert.deepEqual(call({ action: 'login', key: KEY }), { ok: false, error: 'rate' });
});

test('sessions: tampering, expiry and revocation are rejected immediately', () => {
  const { call, addLot, addKey, tables, context } = setup();
  addLot('L', 'A');
  addKey('L', 'L-1', KEY);
  const { token } = call({ action: 'login', key: KEY, remember: true });
  assert.equal(call({ action: 'list', token, setId: 'A' }).ok, true);

  const [body, signature] = token.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ n: 'L-1', l: 'L', e: 9_999_999_999 })).toString('base64url');
  assert.equal(call({ action: 'list', token: `${forgedPayload}.${signature}`, setId: 'A' }).error, 'auth');
  assert.equal(call({ action: 'list', token: `${body}.AAAA`, setId: 'A' }).error, 'auth');
  assert.equal(call({ action: 'list', token: 'garbage', setId: 'A' }).error, 'auth');

  tables.Cles[0][3] = true;
  context.invalidateState_();
  assert.equal(call({ action: 'list', token, setId: 'A' }).error, 'auth');
  tables.Cles[0][3] = false;
  tables.Lots[0][4] = true;
  context.invalidateState_();
  assert.equal(call({ action: 'list', token, setId: 'A' }).error, 'auth');
});

test('documents: access is limited to the folders of the lot sets', () => {
  const { call, addLot, addKey } = setup();
  addLot('L', 'A');
  addKey('L', 'L-1', KEY);
  const { token } = call({ action: 'login', key: KEY });

  const root = call({ action: 'list', token, setId: 'A' });
  assert.deepEqual(root.folders, [{ id: 'sub-a', name: '2026' }]);
  assert.deepEqual(root.files, [], 'trashed files are hidden');
  assert.equal(call({ action: 'list', token, setId: 'A', folderId: 'sub-a' }).files[0].id, 'file-a');

  assert.equal(call({ action: 'list', token, setId: 'B' }).error, 'forbidden');
  assert.equal(call({ action: 'list', token, setId: 'A', folderId: 'root-b' }).error, 'forbidden');
  assert.equal(call({ action: 'file', token, setId: 'A', fileId: 'file-b' }).error, 'forbidden');
  assert.equal(call({ action: 'file', token, setId: 'A', fileId: 'file-trashed' }).error, 'forbidden');

  const file = call({ action: 'file', token, setId: 'A', fileId: 'file-a' });
  assert.equal(Buffer.from(file.base64, 'base64').toString(), 'hello');
});

test('push: devices are subscribed to the lot topic and nothing is stored', () => {
  const { call, addLot, addKey, fetches, tables } = setup();
  addLot('L', 'A');
  addKey('L', 'L-1', KEY);
  const { token } = call({ action: 'login', key: KEY });
  const before = JSON.stringify(tables);
  assert.equal(call({ action: 'subscribe', token, fcmToken: 'x'.repeat(40) }).ok, true);
  const request = fetches.find((f) => f.url.includes('batchAdd'));
  assert.equal(JSON.parse(request.options.payload).to, '/topics/lot-L');
  assert.equal(call({ action: 'unsubscribe', token, fcmToken: 'x'.repeat(40) }).ok, true);
  assert.ok(fetches.some((f) => f.url.includes('batchRemove')));
  assert.equal(call({ action: 'subscribe', token, fcmToken: 'bad token!' }).error, 'bad-request');
  assert.equal(JSON.stringify(tables), before, 'sheets unchanged by push calls');
});

test('notifications: only lots that can see a changed set are notified, with a generic message', () => {
  const { context, addLot, addNode, fetches, tables } = setup();
  addLot('with-a', 'A');
  addLot('only-b', 'B');
  addLot('revoked', 'A', { revoked: true });
  context.invalidateState_();
  addNode('fresh', 'new.pdf', ['root-a'], {});
  // New file created after the last check.
  const created = new Date(Date.now() - 60_000);
  context.DriveApp.getFileById = ((original) => (id) => {
    const node = original(id);
    return id === 'fresh' ? Object.assign(node, { getDateCreated: () => created }) : node;
  })(context.DriveApp.getFileById);
  const props = context.PropertiesService.getScriptProperties();
  props.setProperty('lastCheck', new Date(Date.now() - 3_600_000).toISOString());
  context.DriveApp.getFolderById = ((original) => (id) => {
    const folder = original(id);
    const files = folder.getFiles;
    folder.getFiles = () => {
      const it = files();
      const items = [];
      while (it.hasNext()) {
        const file = it.next();
        items.push(file.getId() === 'fresh' ? Object.assign(file, { getDateCreated: () => created }) : Object.assign(file, { getDateCreated: () => new Date('2026-01-01') }));
      }
      let i = 0;
      return { hasNext: () => i < items.length, next: () => items[i++] };
    };
    return folder;
  })(context.DriveApp.getFolderById);

  context.checkNewDocuments();
  const sends = fetches.filter((f) => f.url.includes('messages:send')).map((f) => JSON.parse(f.options.payload).message);
  assert.deepEqual(sends.map((m) => m.topic), ['lot-with-a']);
  assert.deepEqual(sends[0].data, { type: 'new' });
  assert.equal(JSON.stringify(sends[0]).includes('new.pdf'), false);
  assert.equal(tables.Lots.length, 3);
});

test('generateLot stores only hashes, logs no key and shows each key exactly once', () => {
  const { context, tables, prompts, dialogs, call } = setup();
  prompts.push('2026-B', 'membre', 'A,B', '365', '5');
  context.generateLot();
  assert.equal(tables.Cles.length, 5);
  const everything = JSON.stringify([tables.Cles, tables.Lots, tables.JournalAdmin, tables.Stats]);
  const data = JSON.parse(dialogs[0].replace(/\\u003c/g, '<'));
  assert.equal(data.cards.length, 5);
  for (const card of data.cards) {
    assert.equal(everything.includes(card.key.replace(/-/g, '')), false, 'clear key must not be stored');
    assert.match(card.key, /^([0-9A-Z]{4}-){6}[0-9A-Z]{4}$/);
  }
  assert.equal(tables.Cles.every((row) => /^[0-9a-f]{64}$/.test(row[0])), true);
  assert.equal(call({ action: 'login', key: data.cards[0].key }).ok, true);
});

test('revokeLot, revokeKey and purgeExpired update access and delete old data', () => {
  const { context, tables, prompts, call, addLot, addKey } = setup();
  addLot('L', 'A');
  addKey('L', 'L-0001', KEY);
  addKey('L', 'L-0002', 'Z'.repeat(28));
  prompts.push('L-0001');
  context.revokeKey();
  assert.equal(call({ action: 'login', key: KEY }).error, 'auth');
  assert.equal(call({ action: 'login', key: 'Z'.repeat(28) }).ok, true);
  prompts.push('L');
  context.revokeLot();
  assert.equal(call({ action: 'login', key: 'Z'.repeat(28) }).error, 'auth');

  tables.Lots[0][6] = new Date(Date.now() - 40 * 86_400_000);
  context.purgeExpired();
  assert.equal(tables.Lots.length, 0);
  assert.equal(tables.Cles.length, 0);
});

test('hash and secrets: rotating the pepper invalidates old keys', () => {
  const { context, call, addLot, addKey } = setup();
  addLot('L', 'A');
  addKey('L', 'L-1', KEY);
  assert.equal(call({ action: 'login', key: KEY }).ok, true);
  context.PropertiesService.getScriptProperties().setProperty('PEPPER', createHash('sha256').update('other').digest('hex'));
  assert.equal(call({ action: 'login', key: KEY }).error, 'auth');
});

test('unknown actions and malformed bodies are rejected', () => {
  const { context, call } = setup();
  assert.equal(call({ action: 'nope' }).error, 'bad-request');
  assert.equal(JSON.parse(context.doPost({ postData: { contents: 'not json' } }).text).error, 'bad-request');
});
