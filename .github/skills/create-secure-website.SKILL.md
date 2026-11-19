---
name: create-secure-website
description: "Create a secure, modern static website (Astro + TypeScript + modern CSS) with a strict Content-Security-Policy and Dependabot, publish it on GitHub Pages via GitHub Actions, and add a members' documents area backed by Google Drive (Google login + Google Group access) with automatic email notifications via Google Apps Script."
argument-hint: "Optional: site name, GitHub owner/repo, target folder, Google Drive folder ID, members' Google Group email"
user-invocable: true
---

# Create a secure website published on GitHub Pages

Scaffold a static website with up-to-date tooling, harden it, and publish it on GitHub Pages.

**Stack:** Astro 7 (latest) · TypeScript (`strictest`) · modern CSS (`light-dark()`, nesting,
`clamp()`, `prefers-reduced-motion`) · GitHub Actions → GitHub Pages ·
Google Drive + Google Groups (documents, login, access rights) · Google Apps Script (notifications).

GitHub Pages serves **static files only**. There is no server-side code (no Java, PHP, or Node
server). Interactivity must be client-side TypeScript bundled into external files (never inline)
so it passes the CSP.

**Architecture of the members' area:**

| Need | Handled by |
|---|---|
| Public pages | Astro on GitHub Pages |
| Documents | A Google Drive folder (with sub-folders), shared **only** with a Google Group |
| Login + access rights | Google accounts. Google checks group membership when a member opens a Drive link |
| Notifications | A Google Apps Script with an hourly trigger that emails the group about new files |

The site only contains **links** to the Drive folders, so it stores no personal data, needs no
backend, and keeps the strict CSP unchanged. Never put private documents in the Git repository:
a GitHub Pages site is public even when the repository is private.

## Procedure

### 1. Check prerequisites
Run `node --version`, `npm --version`, `git --version`, `gh --version`.
- Node >= 22 (an active LTS or newer). If it's missing, point the user to https://nodejs.org.
- `gh` is optional. If it's missing, suggest `winget install GitHub.cli` and use the manual steps in step 8.

### 2. Gather inputs (ask once, use defaults)
- `SITE_TITLE`: human title (default: folder name).
- `OWNER`: GitHub user or org (`gh api user --jq .login` when `gh` is authenticated).
- `REPO`: if it is `<OWNER>.github.io`, this is a **user site**: `BASE=/`. Otherwise `BASE=/<REPO>`.
- `TARGET_DIR`: default is the current directory.
- `CONTACT_EMAIL`: for `security.txt` (default `security@example.com`, then tell the user to change it).
- `DRIVE_FOLDER_ID`: ID of the root Google Drive documents folder (the part after `/folders/` in its URL).
  If the user doesn't have one yet, use `REPLACE_WITH_FOLDER_ID` and list it in the report as a remaining step.
- `MEMBERS_GROUP`: the members' Google Group email (for example `adherents-xyz@googlegroups.com`).
  If the user doesn't have one yet, use `members@example.com` and list it in the report as a remaining step.

### 3. Scaffold with the latest Astro
```powershell
npm create astro@latest <TARGET_DIR> -- --template minimal --no-git --install --yes
cd <TARGET_DIR>
npm install --save-dev @astrojs/check typescript
npm pkg set scripts.check="astro check" scripts.audit="npm audit --omit=dev --audit-level=high"
```
If `TARGET_DIR` is not empty, scaffold into a temp folder and copy the result in, keeping the existing `.github` folder.

### 4. Write the files below (overwrite the scaffold files)
Replace the placeholders first: `__SITE_URL__` = `https://<OWNER>.github.io`, `__BASE__` = `/` or `/<REPO>`,
`__SITE_TITLE__`, `__CONTACT_EMAIL__`, `__EXPIRES__` = ISO date one year from today,
`__DRIVE_FOLDER_ID__`, `__MEMBERS_GROUP__`, `__DOCUMENTS_URL__` = `https://<OWNER>.github.io/documents/` for a
user site or `https://<OWNER>.github.io/<REPO>/documents/` otherwise.

**`astro.config.mjs`**
```js
// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: '__SITE_URL__',
  base: '__BASE__',
  output: 'static',
  build: {
    // Keep CSS external so the strict CSP (style-src 'self') is honoured.
    inlineStylesheets: 'never',
  },
  markdown: {
    // Syntax highlighting writes inline style="" attributes, which the CSP blocks.
    syntaxHighlight: false,
  },
  vite: {
    build: {
      // Astro inlines small scripts by default; 0 forces external files (script-src 'self').
      assetsInlineLimit: 0,
    },
  },
});
```

**`tsconfig.json`**
```json
{
  "extends": "astro/tsconfigs/strictest",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "apps-script"]
}
```

**`src/layouts/Base.astro`**
```astro
---
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}

const { title, description = '__SITE_TITLE__' } = Astro.props;
const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');

const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content={csp} />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="description" content={description} />
    <link rel="icon" type="image/svg+xml" href={`${base}favicon.svg`} />
    <link rel="canonical" href={new URL(Astro.url.pathname, Astro.site)} />
    <title>{title}</title>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <a class="brand" href={base}>__SITE_TITLE__</a>
      <nav aria-label="Main">
        <a href={base}>Home</a>
        <a href={`${base}documents/`}>Documents</a>
      </nav>
    </header>
    <main id="main">
      <slot />
    </main>
    <footer class="site-footer">
      <p>&copy; {new Date().getFullYear()} __SITE_TITLE__</p>
    </footer>
  </body>
</html>
```

**`src/pages/index.astro`**
```astro
---
import Base from '../layouts/Base.astro';
---

<Base title="__SITE_TITLE__">
  <section class="hero">
    <h1>__SITE_TITLE__</h1>
    <p>A fast, accessible and secure static website.</p>
    <button type="button" id="theme-toggle" class="button">Toggle theme</button>
  </section>
</Base>

<script>
  // Astro bundles this into an external file, which keeps it CSP-compliant.
  const button = document.querySelector<HTMLButtonElement>('#theme-toggle');
  button?.addEventListener('click', () => {
    const root = document.documentElement;
    const current =
      root.dataset['theme'] ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.dataset['theme'] = current === 'dark' ? 'light' : 'dark';
  });
</script>
```

**`src/styles/global.css`**
```css
:root {
  --bg: light-dark(#ffffff, #0f1115);
  --fg: light-dark(#1b1f24, #e6e8eb);
  --muted: light-dark(#57606a, #9aa4af);
  --accent: light-dark(#0b5fff, #6ea8ff);
  --radius: 0.75rem;
  --space: clamp(1rem, 2.5vw, 2rem);
  color-scheme: light dark;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
}
:root[data-theme='light'] { color-scheme: light; }
:root[data-theme='dark'] { color-scheme: dark; }
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  background: var(--bg);
  color: var(--fg);
}
a {
  color: var(--accent);
  &:hover { text-decoration-thickness: 2px; }
}
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.skip-link {
  position: absolute;
  inset-inline-start: -999px;
  &:focus { inset-inline-start: 1rem; top: 1rem; }
}
.site-header, .site-footer, main { padding: var(--space); max-width: 70rem; width: 100%; margin-inline: auto; }
.site-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  nav { display: flex; gap: 1rem; }
}
.brand { font-weight: 700; text-decoration: none; color: var(--fg); }
.folders {
  list-style: none;
  padding: 0;
  display: grid;
  gap: var(--space);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
}
.folder {
  border: 1px solid color-mix(in srgb, var(--fg) 15%, transparent);
  border-radius: var(--radius);
  padding: var(--space);
  h2 { margin-top: 0; font-size: 1.25rem; }
  p { color: var(--muted); }
}
.note { color: var(--muted); font-size: 0.95rem; }
.hero {
  text-align: center;
  padding-block: calc(var(--space) * 3);
  h1 { font-size: clamp(2rem, 6vw, 3.5rem); margin: 0 0 0.5rem; }
  p { color: var(--muted); }
}
.button { font: inherit; padding: 0.6rem 1.2rem; border: 0; border-radius: var(--radius);
  background: var(--accent); color: var(--bg); cursor: pointer; }
.site-footer { color: var(--muted); font-size: 0.9rem; }
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
```

**`src/data/documents.ts`** (edit this list to add or rename folders. Use the share link of each Drive folder)
```ts
export interface DocumentFolder {
  readonly title: string;
  readonly description: string;
  readonly url: `https://drive.google.com/${string}`;
}

export const documentFolders: readonly DocumentFolder[] = [
  {
    title: 'Members’ documents',
    description: 'All documents reserved for members.',
    url: 'https://drive.google.com/drive/folders/__DRIVE_FOLDER_ID__',
  },
];
```

**`src/pages/documents.astro`**
```astro
---
import Base from '../layouts/Base.astro';
import { documentFolders } from '../data/documents';
---

<Base title="Documents — __SITE_TITLE__" description="Members’ documents">
  <h1>Documents</h1>
  <p class="note">
    Documents are stored in Google Drive and reserved for members. Google will ask you to sign in
    with the Google account registered with us. You also receive an email whenever a new document is added.
  </p>
  <ul class="folders">
    {
      documentFolders.map((folder) => (
        <li class="folder">
          <h2>{folder.title}</h2>
          <p>{folder.description}</p>
          <a class="button" href={folder.url} target="_blank" rel="noopener noreferrer">
            Open in Google Drive
          </a>
        </li>
      ))
    }
  </ul>
  <p class="note">
    No access? Ask an administrator to add your Google account to the members’ group.
  </p>
</Base>
```
Don't embed Drive in an `<iframe>`. It relies on third-party cookies, which browsers increasingly block,
and it would require loosening the CSP (`frame-src`).

**`apps-script/Code.gs`** (Google Apps Script notifier. It is **not** deployed with the site)
```js
const CONFIG = {
  FOLDER_ID: '__DRIVE_FOLDER_ID__',
  NOTIFY_TO: '__MEMBERS_GROUP__',
  SITE_DOCUMENTS_URL: '__DOCUMENTS_URL__',
  SUBJECT_PREFIX: '[__SITE_TITLE__]',
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
          ? `${CONFIG.SUBJECT_PREFIX} New document: ${newFiles[0].name}`
          : `${CONFIG.SUBJECT_PREFIX} ${newFiles.length} new documents`;
      MailApp.sendEmail({
        to: CONFIG.NOTIFY_TO,
        subject,
        body:
          `New document(s) are available:\n\n${lines.join('\n')}\n\n` +
          `All documents: ${CONFIG.SITE_DOCUMENTS_URL}\n`,
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
```
The email is plain text, so file names can't inject HTML. Files moved into the folder keep their original
creation date and are not reported. Tell the user to upload or copy new documents instead.

**`apps-script/appsscript.json`** (least-privilege scopes: Drive is read-only)
```json
{
  "timeZone": "Europe/Paris",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

**`public/robots.txt`**
```text
User-agent: *
Allow: /
```

**`public/.well-known/security.txt`**
```text
Contact: mailto:__CONTACT_EMAIL__
Expires: __EXPIRES__
Preferred-Languages: en, fr
```

**`public/.nojekyll`**: an empty file.

**`.gitignore`**
```text
node_modules/
dist/
.astro/
.env
.env.*
!.env.example
.clasp.json
.clasprc.json
```

**`.github/dependabot.yml`**
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      npm-dependencies:
        patterns: ["*"]
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

**`.github/workflows/deploy.yml`**
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: lts/*
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: npm audit --omit=dev --audit-level=high
      - run: npm run build
      - uses: actions/configure-pages@v6
        if: github.ref == 'refs/heads/main'
      - uses: actions/upload-pages-artifact@v5
        if: github.ref == 'refs/heads/main'
        with:
          path: dist

  deploy:
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```
Before writing this file, check the latest major tag of each action (for example `gh api repos/actions/checkout/releases/latest --jq .tag_name`) and update it if a newer one exists.

### 5. Set up Google Drive, the members' group and notifications (manual, in the Google account)
Guide the user through these steps. Use one dedicated Google account for the organisation, with
**2-step verification enabled**.
1. **Google Group** (https://groups.google.com): create the members' group (`MEMBERS_GROUP`).
   - Who can join: *Only invited users*. Who can view members: *Group managers*.
   - Who can post: *Group managers only* (the script's account must be a manager). This prevents spam to members.
   - Add members by their Google account email. Any email address can be turned into a Google account.
2. **Google Drive**: create the documents folder (and sub-folders). Then go to **Share**:
   - Add `MEMBERS_GROUP` as **Viewer**. Add editors individually.
   - General access: **Restricted**. Never use *Anyone with the link*.
   - Optional: in the share settings, untick *Viewers can download, print and copy*.
   - Copy the folder ID into `src/data/documents.ts` and `apps-script/Code.gs`.
3. **Apps Script** (https://script.google.com, signed in with the account that owns the folder):
   - New project → paste `apps-script/Code.gs`. In *Project Settings*, tick *Show "appsscript.json"* and
     paste `apps-script/appsscript.json`.
   - Run `install` once and accept the permissions. Then run `checkNewDocuments` once to test it.
   - Alternatively, deploy with `clasp` (`npm i -g @google/clasp`, `clasp login`, `clasp create --rootDir apps-script`,
     `clasp push`). Keep `.clasp.json` out of Git.
   - Quota: a consumer Gmail account can send about 100 emails/day with `MailApp`. One email to the group counts as one.
4. Membership changes happen **only in the Google Group**. Access to documents follows automatically.

### 6. Security rules (keep them when you edit the site later)
- **No inline `<script>`, no `is:inline`, no `style="..."` attributes and no inline event handlers.** Astro bundles
  component `<script>` tags into external files only because `vite.build.assetsInlineLimit` is `0`
  (otherwise small scripts are inlined and blocked by the CSP). `inlineStylesheets: 'never'` keeps the CSS external.
  After each build, `dist/**/*.html` must contain no `<script>` without `src` and no `style="`.
- Self-host fonts and images. If a third-party resource is unavoidable, add its exact origin to the CSP
  and use `integrity` (SRI) + `crossorigin="anonymous"`.
- External links use `rel="noopener noreferrer"`.
- **Don't call the Google Drive API from the site** to list files. Drive scopes are sensitive or restricted and
  require a lengthy Google app verification. Plain links plus Google's own sign-in are enough.
- Never commit Google credentials, `.clasprc.json`, or private documents to the repository.
- **GitHub Pages limits:** it can't set custom HTTP headers (HSTS, `X-Frame-Options`), and a meta CSP ignores
  `frame-ancestors`. If you need those, put a proxy or CDN (e.g. Cloudflare) in front or use a host with a `_headers` file.
- Tell the user to enable Dependabot alerts and security updates (Settings → Code security), **Enforce HTTPS**
  (Settings → Pages), and a ruleset on `main` requiring the `build` check.

### 7. Validate locally (all must pass)
```powershell
npm run check
npm run build
npm run audit
npm run preview
```
Open the preview URL (including `BASE`) in a browser. Confirm that the page renders, the theme toggle works and
the console shows **no CSP violations**. Open `documents/` and check that the Drive link opens in a new tab.
In a private window (not signed in), the Drive link must ask for a Google sign-in and must **not** show the files.
Signed in with a member account, the files must be visible.

### 8. Publish on GitHub
```powershell
git init -b main
git add .
git commit -m "Initial secure website"
```
**With `gh`:**
```powershell
gh auth status
gh repo create <OWNER>/<REPO> --public --source . --remote origin --push
gh api -X POST repos/<OWNER>/<REPO>/pages -f build_type=workflow
gh run watch --exit-status
```
(If Pages is already enabled, use `-X PUT` instead of `-X POST`.)

**Without `gh`:** create an empty repo on github.com, then run
`git remote add origin https://github.com/<OWNER>/<REPO>.git; git push -u origin main`. Then go to
Settings → Pages → Source: **GitHub Actions** and watch the Actions tab.

### 9. Report
Give the user the site URL `https://<OWNER>.github.io<BASE>`, the files you created, the validation results,
the GitHub Pages limits from step 6, and any remaining Google steps from step 5 (placeholder folder ID or
group email, Apps Script `install` not run yet).
