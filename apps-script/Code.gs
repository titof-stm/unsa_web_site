const CONFIG = {
  FOLDER_ID: 'REPLACE_WITH_FOLDER_ID',
  NOTIFY_TO: 'adherents@googlegroups.com',
  SITE_DOCUMENTS_URL: 'https://titof-stm.github.io/unsa_web_site/documents/',
  SUBJECT_PREFIX: '[UNSA]',
  MAX_DEPTH: 5,
};

/** Run once by hand: creates the hourly trigger and records the starting point. */
function install() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'checkNewDocuments')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkNewDocuments').timeBased().everyHours(1).create();
  PropertiesService.getScriptProperties().setProperty('lastCheck', new Date().toISOString());
}

function checkNewDocuments() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const now = new Date();
    const lastCheck = new Date(props.getProperty('lastCheck') || now.toISOString());

    const newFiles = [];
    collectNewFiles_(DriveApp.getFolderById(CONFIG.FOLDER_ID), '', lastCheck, now, 0, newFiles);

    if (newFiles.length > 0) {
      const lines = newFiles.map((f) => `- ${f.path}${f.name}\n  ${f.url}`);
      const subject =
        newFiles.length === 1
          ? `${CONFIG.SUBJECT_PREFIX} Nouveau document : ${newFiles[0].name}`
          : `${CONFIG.SUBJECT_PREFIX} ${newFiles.length} nouveaux documents`;
      MailApp.sendEmail({
        to: CONFIG.NOTIFY_TO,
        subject,
        body:
          `Bonjour,\n\nDe nouveaux documents sont disponibles :\n\n${lines.join('\n')}\n\n` +
          `Tous les documents : ${CONFIG.SITE_DOCUMENTS_URL}\n`,
      });
    }
    // Only advance the checkpoint after a successful run, so failures are retried next hour.
    props.setProperty('lastCheck', now.toISOString());
  } finally {
    lock.releaseLock();
  }
}

function collectNewFiles_(folder, path, since, until, depth, out) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const created = file.getDateCreated();
    if (created > since && created <= until && !file.isTrashed()) {
      out.push({ name: file.getName(), path, url: file.getUrl() });
    }
  }
  if (depth >= CONFIG.MAX_DEPTH) return;
  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const sub = folders.next();
    collectNewFiles_(sub, `${path}${sub.getName()}/`, since, until, depth + 1, out);
  }
}
