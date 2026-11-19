# Site web UNSA

Site internet de la section UNSA : pages publiques (accueil, présentation, actualités, adhésion,
contact), espace **documents réservé aux adhérents** et **notification automatique par email** à
chaque nouveau document.

---

## Sommaire

1. [Comment ça fonctionne](#1-comment-ça-fonctionne)
2. [Accéder au site](#2-accéder-au-site)
3. [Première mise en ligne](#3-première-mise-en-ligne)
4. [Modifier le contenu du site](#4-modifier-le-contenu-du-site)
5. [Gérer les documents](#5-gérer-les-documents)
6. [Gérer les utilisateurs (adhérents)](#6-gérer-les-utilisateurs-adhérents)
7. [Notifications automatiques](#7-notifications-automatiques)
8. [Maintenance](#8-maintenance)
9. [Travailler sur son ordinateur (optionnel)](#9-travailler-sur-son-ordinateur-optionnel)
10. [Règles de sécurité](#10-règles-de-sécurité)
11. [Dépannage](#11-dépannage)
12. [Organisation des fichiers](#12-organisation-des-fichiers)

---

## 1. Comment ça fonctionne

| Élément | Outil | Rôle |
|---|---|---|
| Site public | **Astro** publié sur **GitHub Pages** | Pages du site, gratuites, sans serveur à gérer |
| Publication | **GitHub Actions** | À chaque modification, le site est vérifié puis republié automatiquement (2 à 3 minutes) |
| Documents | **Google Drive** | Les documents sont stockés dans un dossier Drive partagé |
| Login et droits | **Comptes Google** + **Google Group** | Google vérifie que la personne fait partie du groupe des adhérents |
| Notifications | **Google Apps Script** | Toutes les heures, un script repère les nouveaux documents et envoie un email au groupe |
| Mises à jour de sécurité | **Dependabot** | Propose chaque semaine les mises à jour des composants du site |

> **Important :** le site GitHub Pages est **public**. Il ne contient que des **liens** vers Google
> Drive. Les documents eux-mêmes ne sont **jamais** mis dans GitHub.

---

## 2. Accéder au site

### Visiteurs

Le site est accessible à l'adresse :

**https://titof-stm.github.io/unsa_web_site/**

Si le compte ou le dépôt change, mettez l'adresse à jour partout (voir [3.4](#34-adapter-ladresse-du-site)).

### Adhérents (espace documents)

1. Aller sur la page **Documents** du site.
2. Cliquer sur **Ouvrir dans Google Drive**.
3. Se connecter avec le **compte Google** communiqué lors de l'adhésion.
4. Les documents s'affichent. Sans autorisation, Google affiche « Vous avez besoin d'une autorisation ».

### Administrateurs

| Accès | Adresse | Pour quoi faire |
|---|---|---|
| Dépôt GitHub | https://github.com/titof-stm/unsa_web_site | Modifier le site, voir les publications |
| Google Drive | https://drive.google.com | Ajouter et organiser les documents |
| Google Groups | https://groups.google.com | Ajouter et retirer des adhérents |
| Apps Script | https://script.google.com | Gérer les notifications |

Utilisez **un compte Google dédié à la section** (par exemple `unsa.section@gmail.com`) qui possède le
dossier Drive, le groupe et le script. Activez la **validation en 2 étapes** sur ce compte et sur les
comptes GitHub des administrateurs.

---

## 3. Première mise en ligne

### 3.1 Créer le dépôt GitHub

1. Créer (ou utiliser) le compte GitHub de la section, avec la validation en 2 étapes.
2. Créer un dépôt **public** nommé `unsa_web_site` (bouton **New repository**), **sans** README.
3. Depuis ce dossier, sur l'ordinateur :

   ```powershell
   git init -b main
   git add .
   git commit -m "Première version du site"
   git remote add origin https://github.com/<COMPTE>/unsa_web_site.git
   git push -u origin main
   ```

### 3.2 Activer GitHub Pages

1. Dans le dépôt : **Settings → Pages**.
2. **Source** : choisir **GitHub Actions**.
3. Cocher **Enforce HTTPS**.
4. Onglet **Actions** : attendre que le workflow « Deploy to GitHub Pages » soit vert ✅.

### 3.3 Activer les protections

- **Settings → Code security** : activer **Dependabot alerts** et **Dependabot security updates**.
- **Settings → Rules → Rulesets** : créer une règle sur la branche `main` qui exige que la vérification
  `build` réussisse avant toute fusion.

### 3.4 Adapter l'adresse du site

Si le nom du compte ou du dépôt change, modifier :

| Fichier | Ligne à modifier |
|---|---|
| [astro.config.mjs](astro.config.mjs) | `site: 'https://<COMPTE>.github.io'` et `base: '/<DÉPÔT>'` |
| [apps-script/Code.gs](apps-script/Code.gs) | `SITE_DOCUMENTS_URL` |
| ce README | les adresses de la section 2 |

> Si le dépôt s'appelle `<COMPTE>.github.io`, le site est à la racine : mettre `base: '/'`.

### 3.5 Configurer Google (documents, groupe, notifications)

Voir les sections [5](#5-gérer-les-documents), [6](#6-gérer-les-utilisateurs-adhérents) et
[7](#7-notifications-automatiques). Dans l'ordre : créer le **groupe**, puis le **dossier Drive**, puis
installer le **script**.

---

## 4. Modifier le contenu du site

Tout peut se faire **depuis le navigateur**, sans rien installer :

1. Ouvrir le fichier sur GitHub.
2. Cliquer sur l'icône ✏️ (**Edit this file**).
3. Modifier le texte, puis **Commit changes**.
4. Le site est republié automatiquement en 2 à 3 minutes (onglet **Actions**).

> Si le workflow devient rouge ❌, le site en ligne **n'est pas modifié**. Ouvrir le workflow pour lire
> l'erreur (voir [Dépannage](#11-dépannage)).

### 4.1 Nom, coordonnées, menu, réseaux sociaux

Tout est dans [src/config.ts](src/config.ts) :

- `SITE` : nom, description, email, téléphone, adresse, lien du formulaire d'adhésion
  (`membershipFormUrl`, par exemple un Google Form ; laisser `''` pour masquer le bouton) ;
- `NAV` : les entrées du menu ;
- `SOCIALS` : les réseaux sociaux. **Remplacer chaque `url` par la vraie page**. Supprimer une ligne
  pour masquer un réseau.

### 4.2 Publier une actualité

1. Aller dans [src/content/actualites/](src/content/actualites/).
2. **Add file → Create new file**, nommé par exemple `2026-12-01-assemblee-generale.md`
   (ce nom devient l'adresse de la page).
3. Contenu :

   ```markdown
   ---
   title: Assemblée générale
   date: 2026-12-01
   summary: Résumé affiché dans la liste des actualités.
   ---

   Texte de l'actualité. **Gras**, *italique*, [lien](https://exemple.fr), listes avec « - ».
   ```

4. **Commit changes**. L'actualité apparaît sur l'accueil (les 3 plus récentes) et sur la page
   Actualités.

- Pour préparer une actualité sans la publier : ajouter `draft: true` dans l'en-tête.
- Pour supprimer une actualité : supprimer le fichier (menu `…` → **Delete file**).

### 4.3 Modifier les autres pages

| Page | Fichier |
|---|---|
| Accueil | [src/pages/index.astro](src/pages/index.astro) |
| Qui sommes-nous | [src/pages/qui-sommes-nous.astro](src/pages/qui-sommes-nous.astro) |
| Documents | [src/pages/documents.astro](src/pages/documents.astro) |
| Adhérer | [src/pages/adherer.astro](src/pages/adherer.astro) |
| Contact | [src/pages/contact.astro](src/pages/contact.astro) |
| Mentions légales | [src/pages/mentions-legales.astro](src/pages/mentions-legales.astro) (**à compléter** : directeur de la publication) |
| Couleurs, mise en page | [src/styles/global.css](src/styles/global.css) (couleur principale : `--accent`) |
| Logo / icône | [public/favicon.svg](public/favicon.svg) |

Modifiez uniquement le texte entre les balises (`<p>…</p>`, `<h2>…</h2>`, etc.). Pour les images,
déposez-les dans `public/` et référencez-les sans adresse externe (voir [Règles de sécurité](#10-règles-de-sécurité)).

---

## 5. Gérer les documents

### 5.1 Mise en place (une seule fois)

1. Avec le compte Google de la section, dans **Google Drive**, créer un dossier, par exemple
   `UNSA - Documents adhérents`, et des sous-dossiers si besoin (`Comptes rendus`, `Accords`, `Guides`…).
2. Clic droit sur le dossier → **Partager** :
   - ajouter l'adresse du groupe `adherents@googlegroups.com` avec le rôle **Lecteur** ;
   - ajouter individuellement les personnes qui publient, avec le rôle **Éditeur** ;
   - **Accès général : Limité** (« Restricted »). Ne **jamais** choisir « Tous les utilisateurs qui ont le lien ».
   - Optionnel : roue dentée ⚙️ → décocher « Les lecteurs peuvent télécharger, imprimer et copier ».
3. Récupérer l'**identifiant du dossier** : c'est la fin de son adresse,
   `https://drive.google.com/drive/folders/`**`1AbC…xyz`**.
4. Le reporter dans :
   - [src/data/documents.ts](src/data/documents.ts) (remplacer `REPLACE_WITH_FOLDER_ID`) ;
   - [apps-script/Code.gs](apps-script/Code.gs) (`FOLDER_ID`), puis dans le script en ligne (section 7).

### 5.2 Ajouter un document

- **Glisser-déposer** le fichier dans le dossier Drive (ou un sous-dossier), ou **créer** un Google Doc
  directement dedans.
- Les adhérents reçoivent l'email dans l'heure qui suit.

> ⚠️ Un fichier **déplacé** depuis un autre endroit du Drive garde sa date de création d'origine et
> **ne déclenche pas** de notification. Utilisez plutôt **Fichier → Créer une copie** ou téléversez-le.

### 5.3 Afficher plusieurs dossiers sur le site

Pour afficher un bouton par dossier (par exemple un dossier « Accords » séparé), ajouter un bloc dans
[src/data/documents.ts](src/data/documents.ts) :

```ts
{
  title: 'Accords d’entreprise',
  description: 'Les accords signés et en cours de négociation.',
  url: 'https://drive.google.com/drive/folders/<ID_DU_SOUS_DOSSIER>',
},
```

Les sous-dossiers héritent des droits du dossier principal. Le script de notification les surveille
automatiquement (jusqu'à 5 niveaux).

### 5.4 Retirer ou archiver un document

- **Supprimer** : clic droit → **Placer dans la corbeille** (récupérable pendant 30 jours).
- **Archiver** : créer un dossier `Archives` **hors** du dossier partagé, et y déplacer le document.
  Les adhérents n'y ont plus accès.

### 5.5 Sauvegarde

Une fois par trimestre, faire **Google Takeout** (https://takeout.google.com) du Drive, ou télécharger le
dossier (clic droit → **Télécharger**) et le conserver sur un support sûr.

---

## 6. Gérer les utilisateurs (adhérents)

L'accès aux documents se gère **uniquement par le Google Group**. Il n'y a pas de mot de passe propre
au site : chaque adhérent utilise son compte Google.

### 6.1 Créer le groupe (une seule fois)

1. Sur https://groups.google.com, avec le compte de la section : **Créer un groupe**.
2. Nom : `Adhérents UNSA`, adresse : `adherents@googlegroups.com` (ou celle disponible).
3. Paramètres de confidentialité :
   - **Qui peut rechercher le groupe** : membres du groupe uniquement ;
   - **Qui peut rejoindre** : **sur invitation uniquement** ;
   - **Qui peut voir les membres** : **gestionnaires du groupe** ;
   - **Qui peut publier** : **gestionnaires du groupe** (le compte de la section doit être
     gestionnaire ou propriétaire, car c'est lui qui envoie les notifications).
4. Si l'adresse du groupe est différente, la reporter dans [apps-script/Code.gs](apps-script/Code.gs)
   (`NOTIFY_TO`).

### 6.2 Ajouter un adhérent

1. Récupérer l'adresse du **compte Google** de l'adhérent.
   - Il n'a pas de Gmail ? Il peut créer un compte Google **avec son adresse email actuelle** :
     https://accounts.google.com/signup → « Utiliser mon adresse email actuelle ».
2. Google Groups → le groupe → **Membres → Ajouter des membres**.
3. Saisir l'adresse, cocher **Ajouter directement** (plutôt qu'inviter) si disponible, et **Ajouter**.
4. L'adhérent a immédiatement accès aux documents et recevra les notifications.

### 6.3 Retirer un adhérent (départ, non-renouvellement)

1. Google Groups → le groupe → **Membres**.
2. Cocher la personne → **Retirer du groupe**.
3. Son accès aux documents et les notifications s'arrêtent immédiatement.

> Si la personne était **Éditeur** du dossier Drive, la retirer aussi dans **Partager** du dossier.

### 6.4 Rôles

| Rôle | Où | Droits |
|---|---|---|
| Adhérent | Membre du Google Group | Lit les documents, reçoit les notifications |
| Publieur | Éditeur du dossier Drive | Ajoute, modifie, supprime des documents |
| Gestionnaire | Gestionnaire du Google Group | Ajoute ou retire des adhérents |
| Administrateur | Propriétaire du compte Google de la section et du dépôt GitHub | Tout |

### 6.5 Vérification périodique

Chaque trimestre (ou à chaque renouvellement des adhésions) : comparer la liste des membres du groupe
avec la liste des adhérents à jour, et retirer les personnes qui ne sont plus adhérentes.

---

## 7. Notifications automatiques

Le script [apps-script/Code.gs](apps-script/Code.gs) tourne **toutes les heures** dans le compte Google de
la section. Il liste les fichiers créés depuis son dernier passage (dossier principal et sous-dossiers)
et envoie **un seul email** au groupe, avec le nom et le lien de chaque nouveau document.

### 7.1 Installation (une seule fois)

1. Ouvrir https://script.google.com avec le **compte qui possède le dossier Drive**.
2. **Nouveau projet**, le renommer `Notifications documents UNSA`.
3. Remplacer le contenu de `Code.gs` par celui de [apps-script/Code.gs](apps-script/Code.gs).
   Vérifier `FOLDER_ID`, `NOTIFY_TO` et `SITE_DOCUMENTS_URL`.
4. **Paramètres du projet** ⚙️ → cocher **Afficher le fichier manifeste « appsscript.json »**, puis
   remplacer son contenu par celui de [apps-script/appsscript.json](apps-script/appsscript.json).
5. Revenir à `Code.gs`, choisir la fonction **`install`** dans la liste, cliquer **Exécuter**, et
   accepter les autorisations (lecture seule de Drive, envoi d'emails, déclencheurs).
   - Si Google affiche « Application non validée » : **Paramètres avancés → Accéder au projet**. C'est
     normal pour un script personnel.
6. Vérifier dans **Déclencheurs** ⏰ qu'un déclencheur `checkNewDocuments` toutes les heures existe.

### 7.2 Tester

1. Déposer un fichier de test dans le dossier Drive.
2. Dans l'éditeur, exécuter **`checkNewDocuments`**.
3. Vérifier la réception de l'email sur une adresse membre du groupe, puis supprimer le fichier de test.

### 7.3 Suivre et ajuster

- **Exécutions** (icône ☰) : historique des passages et erreurs éventuelles. Google envoie aussi un
  email au propriétaire en cas d'échec répété.
- **Changer la fréquence** : dans `install`, remplacer `everyHours(1)` par `everyHours(6)` ou
  `everyDays(1)`, puis relancer `install`.
- **Changer le texte de l'email** : modifier `subject` et `body` dans `checkNewDocuments`.
- **Quota** : environ **100 emails par jour** avec un compte Gmail gratuit. Un email au groupe compte
  pour **un seul** envoi, quel que soit le nombre d'adhérents.
- **Modifier le script** : toujours modifier [apps-script/Code.gs](apps-script/Code.gs) dans GitHub **et**
  la copie en ligne, pour qu'elles restent identiques.

> Option avancée : `clasp` permet de publier le script depuis l'ordinateur
> (`npm i -g @google/clasp`, `clasp login`, `clasp create --rootDir apps-script`, `clasp push`).
> Les fichiers `.clasp.json` et `.clasprc.json` ne doivent jamais être envoyés sur GitHub
> (ils sont déjà exclus par `.gitignore`).

---

## 8. Maintenance

### 8.1 Chaque semaine : mises à jour Dependabot

Dependabot ouvre des **Pull requests** (onglet **Pull requests**) pour mettre à jour les composants.

1. Ouvrir la pull request.
2. Attendre que la vérification **build** soit verte ✅.
3. Cliquer **Merge pull request**. Le site est republié automatiquement.
4. Si la vérification est rouge ❌ : ne pas fusionner, voir [Dépannage](#11-dépannage) ou demander à un
   développeur.

Les pull requests marquées **security** sont prioritaires.

### 8.2 Chaque mois

- Onglet **Actions** : vérifier que les dernières publications sont vertes.
- **Security → Dependabot alerts** : aucune alerte ouverte.
- Apps Script → **Exécutions** : pas d'erreurs.
- Parcourir le site : liens des réseaux sociaux et de Drive toujours valides.

### 8.3 Chaque année

- Mettre à jour la date `Expires` dans [public/.well-known/security.txt](public/.well-known/security.txt)
  (un an plus tard) et vérifier l'email `Contact`.
- Vérifier les **mentions légales** (directeur de la publication, adresse).
- Revoir les accès : administrateurs GitHub, éditeurs Drive, gestionnaires du groupe.
- Vérifier que la validation en 2 étapes est toujours active sur les comptes administrateurs.

### 8.4 Transmettre la gestion à une autre personne

1. GitHub : **Settings → Collaborators** → ajouter la personne (ou transférer le dépôt).
2. Google : partager le mot de passe du compte de la section via un gestionnaire de mots de passe, ou
   ajouter la personne comme **gestionnaire** du groupe et **éditeur** du dossier.
3. Retirer les accès de l'ancien gestionnaire.

---

## 9. Travailler sur son ordinateur (optionnel)

Utile pour prévisualiser des changements importants avant de les publier.

**Prérequis :** [Node.js](https://nodejs.org) version 22 ou plus récente, et [Git](https://git-scm.com).

```powershell
npm ci               # installer les dépendances (la première fois)
npm run dev          # aperçu en direct sur http://localhost:4321/unsa_web_site/
npm run check        # vérifier le code (types, erreurs)
npm run build        # construire le site dans le dossier dist/
npm run preview      # tester le site construit (comme en ligne)
npm run audit        # vérifier les failles de sécurité connues
```

Avant de publier, `npm run check` et `npm run build` doivent réussir. Ensuite :

```powershell
git add .
git commit -m "Description du changement"
git push
```

Mettre à jour les composants à la main (si besoin) : `npm update`, puis `npm run check` et
`npm run build`.

---

## 10. Règles de sécurité

Le site applique une **politique de sécurité stricte** (Content-Security-Policy) qui interdit tout
contenu venant d'autres sites. Pour ne pas la casser :

- **Pas de code collé depuis d'autres sites** (widgets Facebook/X, scripts de statistiques, polices
  Google Fonts…). Les réseaux sociaux sont de simples liens.
- **Pas de `<script>` dans les pages, pas d'attribut `style="…"`, pas de `onclick="…"`.** Les styles vont
  dans [src/styles/global.css](src/styles/global.css).
- **Images** : les déposer dans `public/` (par exemple `public/images/photo.jpg`) et les utiliser avec un
  chemin local.
- **Ne jamais mettre dans GitHub** : documents des adhérents, listes d'adhérents, mots de passe, fichiers
  `.env`, `.clasprc.json`.
- **Ne jamais partager le dossier Drive** avec « Tous les utilisateurs qui ont le lien ».
- Ne pas afficher le dossier Drive dans la page (iframe) : utilisez des liens.

Limites de GitHub Pages : impossible d'ajouter des en-têtes HTTP personnalisés (HSTS, X-Frame-Options).
Si cela devient nécessaire, placer un service comme Cloudflare devant le site.

---

## 11. Dépannage

| Problème | Cause probable | Solution |
|---|---|---|
| Publication rouge ❌ dans **Actions** | Erreur dans un fichier modifié | Ouvrir le workflow → étape en rouge → lire le message. Souvent : en-tête d'actualité incomplet (`title`, `date`, `summary` obligatoires) ou balise mal fermée. Corriger ou annuler la dernière modification. |
| Le site ne change pas après une modification | Publication pas terminée ou cache du navigateur | Attendre le ✅ dans **Actions**, puis recharger avec **Ctrl + F5**. |
| Page blanche ou sans mise en forme | Mauvais `site`/`base` dans `astro.config.mjs` | Vérifier la section [3.4](#34-adapter-ladresse-du-site). |
| Un adhérent n'a pas accès | Mauvais compte Google, ou absent du groupe | Vérifier son adresse dans le groupe. Lui demander de se déconnecter des autres comptes Google ou d'utiliser une fenêtre privée. |
| Pas d'email de notification | Déclencheur absent, quota atteint, fichier déplacé | Apps Script → **Exécutions** et **Déclencheurs**. Relancer `install`. Voir 5.2 pour les fichiers déplacés. |
| Notification reçue en spam | Premier envoi depuis ce compte | Demander aux adhérents de marquer l'email « Non spam » et d'ajouter l'expéditeur à leurs contacts. |
| Erreur « Exception: No item with the given ID » | `FOLDER_ID` incorrect | Corriger `FOLDER_ID` dans le script en ligne. |
| Une pull request Dependabot est rouge | Mise à jour incompatible | Ne pas la fusionner. Lire l'erreur, ou attendre la version suivante. |

---

## 12. Organisation des fichiers

```text
├── .github/
│   ├── dependabot.yml          # mises à jour automatiques hebdomadaires
│   ├── skills/                 # instructions pour l'assistant IA (création du site)
│   └── workflows/deploy.yml    # vérification + publication sur GitHub Pages
├── apps-script/
│   ├── Code.gs                 # script de notification (à copier dans script.google.com)
│   └── appsscript.json         # autorisations du script
├── public/                     # fichiers copiés tels quels (icône, images, robots.txt, security.txt)
├── src/
│   ├── config.ts               # ⭐ nom, coordonnées, menu, réseaux sociaux
│   ├── data/documents.ts       # ⭐ liens vers les dossiers Google Drive
│   ├── content/actualites/     # ⭐ une actualité = un fichier .md
│   ├── components/             # éléments réutilisables (réseaux sociaux, liste d'actualités)
│   ├── layouts/Base.astro      # en-tête, menu, pied de page, sécurité (CSP)
│   ├── pages/                  # une page du site = un fichier
│   └── styles/global.css       # couleurs et mise en page
├── astro.config.mjs            # adresse du site et options de construction
└── package.json                # dépendances et commandes npm
```

Les fichiers marqués ⭐ sont ceux que vous modifierez le plus souvent.
