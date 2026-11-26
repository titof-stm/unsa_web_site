# Site web UNSA

Site internet de la section UNSA, installable comme une **application (PWA)** : pages publiques
(accueil, présentation, actualités, adhésion, contact), espace **documents réservé aux adhérents et
invités** accessible avec une **clé d'accès anonyme**, et **notifications** à chaque nouveau document.

> Guide complet de la protection des données (RGPD / CNIL) : [docs/GESTION_MEMBRES_RGPD.md](docs/GESTION_MEMBRES_RGPD.md).
> À lire avant la première distribution de clés.

---

## Sommaire

1. [Comment ça fonctionne](#1-comment-ça-fonctionne)
2. [Accéder au site et installer l'application](#2-accéder-au-site-et-installer-lapplication)
3. [Première mise en ligne](#3-première-mise-en-ligne)
4. [Modifier le contenu du site](#4-modifier-le-contenu-du-site)
5. [Gérer les documents](#5-gérer-les-documents)
6. [Gérer les clés d'accès (adhérents et invités)](#6-gérer-les-clés-daccès-adhérents-et-invités)
7. [Notifications](#7-notifications)
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
| Application (PWA) | **Manifest** + **service worker** | Installation sur l'écran d'accueil, pages disponibles hors connexion, notifications |
| Publication | **GitHub Actions** | À chaque modification, le site est vérifié, testé puis republié automatiquement (2 à 3 minutes) |
| Documents | **Google Drive** | Les documents restent dans des dossiers Drive **privés** (jamais partagés par lien) |
| Accès aux documents | **Clés d'accès anonymes** + **Google Apps Script** | Le script vérifie la clé et sert les fichiers au site. Aucun compte Google n'est demandé aux utilisateurs |
| Gestion des clés | **Google Sheet** privé + menu « UNSA clés » | Génération de lots de clés (cartes à imprimer), révocation, purge |
| Notifications | **Firebase Cloud Messaging** + Apps Script | Toutes les heures, le script repère les nouveaux fichiers et envoie une alerte générique aux appareils abonnés |
| Mises à jour de sécurité | **Dependabot** | Propose chaque semaine les mises à jour des composants du site |

```text
Téléphone / PC (PWA)  ──►  GitHub Pages (pages statiques, mises en cache par le service worker)
        │
        ├── clé d'accès ──►  Apps Script (web app) ──►  Google Sheet (hash des clés, lots)
        │                                          └─►  Google Drive (dossiers privés)
        └── notifications ◄─ Firebase Cloud Messaging ◄─ Apps Script (nouveaux fichiers)
```

> **Important :** le site GitHub Pages est **public**. Les documents ne sont **jamais** dans GitHub et
> leurs dossiers Drive ne sont partagés avec personne : seul le script (compte de la section) les lit.

---

## 2. Accéder au site et installer l'application

### Visiteurs

Le site est accessible à l'adresse :

**https://titof-stm.github.io/unsa_web_site/**

Si le compte ou le dépôt change, mettez l'adresse à jour partout (voir [3.4](#34-adapter-ladresse-du-site)).

### Installer l'application

Page **Application et notifications** du site (lien en bas de chaque page) :

| Appareil | Installation |
|---|---|
| Android (Chrome, Edge, Samsung Internet) | Bouton **Installer l'application**, ou menu du navigateur → *Installer l'application* |
| Windows / macOS (Chrome, Edge) | Bouton **Installer l'application**, ou icône d'installation dans la barre d'adresse |
| iPhone / iPad (iOS 16.4 ou plus) | Dans **Safari** : **Partager** → **Sur l'écran d'accueil**. Les notifications ne fonctionnent qu'une fois l'application ajoutée à l'écran d'accueil |

### Adhérents et invités (espace documents)

1. Recevoir une **carte** avec une clé d'accès, **en main propre** d'un représentant UNSA.
2. Page **Documents** : scanner le QR code de la carte, ou saisir la clé, puis **Accéder aux documents**.
3. Parcourir les dossiers, **Ouvrir** (aperçu PDF/image) ou **Télécharger**. Le bouton **Hors connexion**
   garde un fichier sur l'appareil.
4. Option : **Application et notifications** → activer les notifications (alerte à chaque nouveau document).
5. **Se déconnecter et effacer** supprime la session, les notifications et les fichiers hors connexion.

### Administrateurs

| Accès | Adresse | Pour quoi faire |
|---|---|---|
| Dépôt GitHub | https://github.com/titof-stm/unsa_web_site | Modifier le site, voir les publications |
| Google Drive | https://drive.google.com | Ajouter et organiser les documents |
| Google Sheet « UNSA clés » | https://sheets.google.com | Générer, révoquer et purger les clés |
| Apps Script | https://script.google.com | Code du script, déploiement, secrets |
| Console Firebase | https://console.firebase.google.com | Projet des notifications |

Utilisez **un compte Google dédié à la section** (par exemple `unsa.section@gmail.com`) qui possède le
dossier Drive, le Sheet et le script. Activez la **validation en 2 étapes** (ou une clé d'accès
« passkey ») sur ce compte et sur les comptes GitHub des administrateurs. Désignez un **suppléant**.

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

### 3.5 Configurer Google (documents, clés, notifications)

Voir les sections [5](#5-gérer-les-documents), [6](#6-gérer-les-clés-daccès-adhérents-et-invités) et
[7](#7-notifications). Dans l'ordre : créer les **dossiers Drive**, puis le **Sheet et le script** (6.1),
puis le **projet Firebase** (7.1), et enfin renseigner `PWA` dans [src/config.ts](src/config.ts).

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
| Logo / icône | [public/img/logo.png](public/img/logo.png) |

Modifiez uniquement le texte entre les balises (`<p>…</p>`, `<h2>…</h2>`, etc.). Pour les images,
déposez-les dans `public/` et référencez-les sans adresse externe (voir [Règles de sécurité](#10-règles-de-sécurité)).

---

## 5. Gérer les documents

### 5.1 Mise en place (une seule fois)

1. Avec le compte Google de la section, dans **Google Drive**, créer un dossier par **ensemble de
   documents** (par exemple `Comptes rendus`, `Accords`, `Guides adhérents`, `Invités`), avec des
   sous-dossiers si besoin (jusqu'à 5 niveaux).
2. **Ne partager ces dossiers avec personne** (accès général : **Limité**), sauf les personnes qui
   publient, avec le rôle **Éditeur**. Les utilisateurs n'ont pas besoin de droits Drive : le script
   lit les fichiers avec le compte de la section et les leur transmet après vérification de leur clé.
   Ne **jamais** choisir « Tous les utilisateurs qui ont le lien ».
3. Récupérer l'**identifiant du dossier** : c'est la fin de son adresse,
   `https://drive.google.com/drive/folders/`**`1AbC…xyz`**.
4. Le reporter dans la feuille **`Ensembles`** du Sheet des clés (colonne `dossierDriveId`, voir 6.1).

### 5.2 Ajouter un document

- **Glisser-déposer** le fichier dans le dossier Drive (ou un sous-dossier), ou **créer** un Google Doc
  directement dedans. Il apparaît tout de suite dans l'application (parfois après une minute).
- Les appareils abonnés reçoivent une alerte dans l'heure qui suit.
- **PDF et images** s'ouvrent dans l'aperçu ; les autres formats se téléchargent. Les Google Docs,
  Sheets et Slides sont convertis en **PDF**. Taille maximale : **20 Mo** par fichier.

> ⚠️ Un fichier **déplacé** depuis un autre endroit du Drive garde sa date de création d'origine et
> **ne déclenche pas** de notification. Utilisez plutôt **Fichier → Créer une copie** ou téléversez-le.

> ⚠️ Relisez les documents avant dépôt : un compte rendu peut contenir des noms de salariés. Les
> données personnelles d'un document sont un traitement distinct, à limiter au nécessaire.

### 5.3 Ajouter un ensemble de documents

Ajouter une ligne dans la feuille **`Ensembles`** (identifiant court sans espace, titre, description,
ID du dossier). Un **lot de clés** donne accès à un ou plusieurs ensembles (voir 6.2).

### 5.4 Retirer ou archiver un document

- **Supprimer** : clic droit → **Placer dans la corbeille** (récupérable pendant 30 jours). Un fichier
  en corbeille n'est plus servi par le script.
- **Archiver** : créer un dossier `Archives` **hors** des ensembles et y déplacer le document.

### 5.5 Sauvegarde

Une fois par trimestre, faire **Google Takeout** (https://takeout.google.com) du Drive, ou télécharger les
dossiers (clic droit → **Télécharger**) et les conserver sur un support sûr. Faire aussi une copie du
Sheet des clés (**Fichier → Créer une copie**) : sans lui, les cartes distribuées ne fonctionnent plus.

---

## 6. Gérer les clés d'accès (adhérents et invités)

**Principe : on ne sait jamais qui détient quelle clé.** Une clé est un secret aléatoire de 140 bits,
sans nom ni email ; seule son empreinte est enregistrée. Il n'y a ni liste d'adhérents ni compte. Le
détail (RGPD, durées, droits) est dans [docs/GESTION_MEMBRES_RGPD.md](docs/GESTION_MEMBRES_RGPD.md).

| Notion | Signification |
|---|---|
| **Clé** | Code `ABCD-EFGH-…` imprimé sur une carte avec un QR code. Donne accès aux ensembles de son lot |
| **Lot** | Groupe de clés créées ensemble (ex. `2026-A`) : même type, mêmes ensembles, même date d'expiration |
| **Ensemble** | Un dossier Drive montré aux utilisateurs (ex. « Comptes rendus ») |
| **Type** | `membre` (adhérents, 365 jours) ou `invite` (invités, 7 à 30 jours) |

### 6.1 Installation (une seule fois)

1. Avec le compte de la section, créer un Google Sheet nommé `UNSA clés`. **Ne pas le partager.**
2. **Extensions → Apps Script**. Renommer le projet `UNSA clés et documents`.
3. Reproduire les fichiers de [apps-script/](apps-script/) :
   - `Code.gs` : contenu de [apps-script/Code.gs](apps-script/Code.gs) ; vérifier `SITE_URL` ;
   - **+ → HTML** `Cards` : contenu de [apps-script/Cards.html](apps-script/Cards.html) ;
   - **+ → HTML** `QrLib` : contenu de [apps-script/QrLib.html](apps-script/QrLib.html)
     (bibliothèque QR code `qrcode-generator`, licence MIT) ;
   - **Paramètres du projet** ⚙️ → cocher **Afficher le fichier manifeste « appsscript.json »**, puis
     remplacer son contenu par [apps-script/appsscript.json](apps-script/appsscript.json).
4. Recharger le Sheet : un menu **UNSA clés** apparaît. **UNSA clés → Initialiser**, accepter les
   autorisations (si Google affiche « Application non validée » : **Paramètres avancés → Accéder au
   projet**, c'est normal pour un script personnel). Cela crée les feuilles `Ensembles`, `Lots`, `Cles`,
   `JournalAdmin`, `Stats`, les secrets (`PEPPER`, `SESSION_SECRET`) et le déclencheur horaire.
5. Remplir la feuille **`Ensembles`** : `id` (court, ex. `cr`), `titre`, `description`, `dossierDriveId`.
6. **Déployer → Nouveau déploiement → Application Web** :
   - **Exécuter en tant que : Moi** ;
   - **Qui a accès : Tout le monde** (l'adresse est publique, mais chaque action exige une clé ou une
     session valide) ;
   - copier l'URL qui finit par `/exec`.
7. La reporter dans [src/config.ts](src/config.ts) (`PWA.apiUrl`), puis publier le site.
8. Après chaque modification de `Code.gs` : **Déployer → Gérer les déploiements → ✏️ → Nouvelle version**.

> Les secrets (`PEPPER`, `SESSION_SECRET`, `FCM_SERVICE_ACCOUNT`) vivent uniquement dans
> **Paramètres du projet → Propriétés du script**. Ne jamais les copier dans GitHub.

### 6.2 Distribuer des clés (adhésion, renouvellement, invités)

1. Menu **UNSA clés → Générer un lot de clés**. Répondre aux questions : identifiant du lot
   (`2026-A`), type (`membre` ou `invite`), ensembles (identifiants séparés par des virgules), durée en
   jours, nombre de clés (prévoir environ 10 % de marge).
2. La fenêtre des **cartes** s'affiche. **C'est la seule fois où les clés sont visibles.**
   **Imprimer** sur une imprimante **locale**, puis fermer. Ne pas enregistrer de PDF.
3. Découper et **mélanger** les cartes. Les remettre **en main propre**, une par personne.
4. **Ne rien noter** : ni qui a reçu quelle carte, ni liste de remise. C'est ce qui garantit l'anonymat.
5. Consigne à donner : « Gardez cette carte pour vous. Si vous la perdez, donnez-nous le numéro imprimé,
   sans votre nom. »

### 6.3 Renouveler, retirer, révoquer

| Situation | Action |
|---|---|
| **Renouvellement annuel** | Générer un nouveau lot (`2027-A`), le distribuer, puis laisser l'ancien lot expirer (le **prolonger** de quelques semaines pour la transition si besoin : **Prolonger un lot**) |
| **Départ d'un adhérent** | Aucune action individuelle (anonymat) : l'accès s'arrête à l'expiration du lot |
| **Carte perdue ou volée** | **Révoquer une clé** avec le **numéro** de la carte (`2026-A-0042`) |
| **Fuite d'une clé ou d'un lot** | **Révoquer un lot**, puis générer et redistribuer un nouveau lot |
| **Compte administrateur compromis** | **Changer les secrets** : toutes les clés et sessions deviennent invalides ; regénérer les lots. Voir aussi la procédure de violation dans le guide RGPD |
| **Ménage** | **Purger les lots expirés** (supprime les lots et clés expirés ou révoqués depuis plus de 30 jours) : à faire chaque trimestre |

La révocation d'un lot ou d'une clé est effective en **moins d'une minute** : les sessions déjà ouvertes
sont revérifiées à chaque requête.

### 6.4 Rôles

| Rôle | Où | Droits |
|---|---|---|
| Adhérent / invité | Porteur d'une carte | Lit les ensembles de son lot, reçoit les notifications |
| Publieur | Éditeur d'un dossier Drive | Ajoute, modifie, supprime des documents |
| Administrateur des clés | Propriétaire du Sheet et du script (2 personnes) | Génère, révoque, purge les clés ; voit les statistiques |
| Administrateur du site | Dépôt GitHub | Modifie le site et la configuration publique |

### 6.5 Vérification périodique

- Feuille **`Stats`** : connexions et échecs **par jour** (sans détail). Un pic d'échecs inhabituel
  signale une tentative d'intrusion : révoquer le lot si besoin.
- Chaque année : revue des accès (qui est propriétaire du Sheet, éditeur du Drive, administrateur
  GitHub), nouvelle distribution de clés, mise à jour du registre des traitements.

---

## 7. Notifications

Le script tourne **toutes les heures** (déclencheur créé par **Initialiser**). Il repère les fichiers
créés depuis son dernier passage dans chaque ensemble et envoie, via **Firebase Cloud Messaging**, une
alerte **générique** (« Nouveau contenu disponible ») au groupe de notification de chaque **lot actif**
qui a accès à cet ensemble. Les alertes ne contiennent **ni nom de fichier ni information personnelle**,
et le service ne sait pas à qui appartient un appareil abonné.

Côté utilisateur : **Application et notifications** → **Activer les notifications** (un clic, c'est le
consentement). Un **mode discret** retire le nom « UNSA » et le logo de l'écran de verrouillage.

### 7.1 Installation (une seule fois)

1. https://console.firebase.google.com → **Ajouter un projet** (Google Analytics : désactivé).
2. **Paramètres du projet → Général → Vos applications → Application Web** : l'enregistrer et noter
   `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId` (ces valeurs sont publiques).
3. **Paramètres du projet → Cloud Messaging → Configuration Web → Certificats Push Web** : **Générer
   une paire de clés**. La clé publique est la `vapidKey`.
4. **Paramètres du projet → Comptes de service → Générer une nouvelle clé privée** : un fichier JSON est
   téléchargé. Coller **tout son contenu** dans Apps Script (**Paramètres du projet → Propriétés du
   script**) sous le nom `FCM_SERVICE_ACCOUNT`, puis **supprimer le fichier téléchargé**.
5. Dans la console Google Cloud du projet : vérifier que l'API **Firebase Cloud Messaging API** est
   activée et **accepter le Cloud Data Processing Addendum** (Confidentialité et conformité).
6. Reporter les valeurs publiques dans [src/config.ts](src/config.ts) (`PWA.firebase`, y compris
   `vapidKey`), puis publier le site.

### 7.2 Tester

1. Installer l'application, se connecter avec une clé, **activer les notifications**.
2. Déposer un fichier de test dans un ensemble accessible par cette clé.
3. Dans l'éditeur Apps Script, exécuter **`checkNewDocuments`** : l'alerte arrive en quelques secondes.
4. Supprimer le fichier de test.

### 7.3 Suivre et ajuster

- **Exécutions** (icône ☰) : historique et erreurs. Google envoie un email au propriétaire en cas
  d'échec répété.
- **Changer la fréquence** : dans `initialize`, remplacer `everyHours(1)` par une autre valeur, puis
  relancer **UNSA clés → Initialiser** (les secrets existants sont conservés).
- **Changer le texte de l'alerte** : [public/sw.js](public/sw.js), fonction `showGenericNotification`.
  Il doit rester **générique**.
- **iPhone / iPad** : alertes possibles seulement avec iOS 16.4 ou plus **et** l'application ajoutée à
  l'écran d'accueil. Sur les autres appareils, consulter l'espace documents manuellement.
- **Limite connue** : la révocation d'**une seule** clé ne retire pas son appareil du groupe de
  notification du lot ; il peut encore recevoir l'alerte générique, mais plus lire de document.
- **Modifier le script** : toujours modifier [apps-script/Code.gs](apps-script/Code.gs) dans GitHub **et**
  la copie en ligne, pour qu'elles restent identiques. Les tests hors ligne s'exécutent avec
  `npm run test:apps-script`.

> Option avancée : `clasp` permet de publier le script depuis l'ordinateur
> (`npm i -g @google/clasp`, `clasp login`, `clasp create --type sheets --rootDir apps-script`,
> `clasp push`). Les fichiers `.clasp.json` et `.clasprc.json` ne doivent jamais être envoyés sur GitHub
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
- Apps Script → **Exécutions** : pas d'erreurs. Feuille `Stats` du Sheet : pas de pic d'échecs.
- Parcourir le site : liens des réseaux sociaux toujours valides ; ouvrir l'application installée et
  vérifier que la mise à jour s'applique (bandeau « Nouvelle version disponible »).

### 8.3 Chaque année

- Mettre à jour la date `Expires` dans [public/.well-known/security.txt](public/.well-known/security.txt)
  (un an plus tard) et vérifier l'email `Contact`.
- Vérifier les **mentions légales** (directeur de la publication, adresse).
- Revoir les accès : administrateurs GitHub, éditeurs Drive, propriétaires du Sheet des clés.
- Vérifier que la validation en 2 étapes est toujours active sur les comptes administrateurs.
- Renouveler les clés (nouveau lot) et relire le [guide RGPD](docs/GESTION_MEMBRES_RGPD.md) : registre
  des traitements, analyse d'impact, contrats Google.

### 8.4 Transmettre la gestion à une autre personne

1. GitHub : **Settings → Collaborators** → ajouter la personne (ou transférer le dépôt).
2. Google : transférer la **propriété** du Sheet `UNSA clés` (et donc du script) et des dossiers Drive au
   compte de la section ou à la personne, ou partager le mot de passe du compte de la section via un
   gestionnaire de mots de passe. Sans accès au Sheet, les cartes déjà distribuées ne peuvent plus être
   gérées.
3. Retirer les accès de l'ancien gestionnaire, puis **changer les secrets** (menu UNSA clés) si le départ
   n'est pas amical.

---

## 9. Travailler sur son ordinateur (optionnel)

Utile pour prévisualiser des changements importants avant de les publier.

**Prérequis :** [Node.js](https://nodejs.org) version 22 ou plus récente, et [Git](https://git-scm.com).

```powershell
npm ci               # installer les dépendances (la première fois)
npm run dev          # aperçu en direct sur http://localhost:4321/unsa_web_site/
npm run check        # vérifier le code (types, erreurs)
npm run test:apps-script  # tests hors ligne du script Google (clés, sessions, accès aux dossiers)
npm run build        # construire le site dans le dossier dist/
npm run preview      # tester le site construit (comme en ligne ; le service worker n'existe qu'ici)
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
- **Ne jamais mettre dans GitHub** : documents, clés d'accès, cartes imprimées, listes d'adhérents,
  secrets (`PEPPER`, `SESSION_SECRET`, `FCM_SERVICE_ACCOUNT`), fichiers `.env`, `.clasprc.json`.
  Les valeurs `PWA.firebase` de [src/config.ts](src/config.ts) sont publiques par conception ; la clé
  privée du compte de service ne l'est pas.
- **Ne jamais partager les dossiers Drive** avec « Tous les utilisateurs qui ont le lien » ni avec un
  groupe : seul le script les lit.
- **Ne jamais relier une clé à une personne** (liste de remise, note, tableur) : voir le
  [guide RGPD](docs/GESTION_MEMBRES_RGPD.md).
- Ne pas afficher le dossier Drive dans la page (iframe) : l'application passe par le script.
- La politique de sécurité autorise uniquement les échanges avec le script Google et Firebase
  (`connect-src` dans [src/layouts/Base.astro](src/layouts/Base.astro)). Toute nouvelle dépendance externe
  doit y être déclarée et justifiée (et mise à jour dans la page Confidentialité).

Limites de GitHub Pages : impossible d'ajouter des en-têtes HTTP personnalisés (HSTS, X-Frame-Options).
Si cela devient nécessaire, placer un service comme Cloudflare devant le site.

---

## 11. Dépannage

| Problème | Cause probable | Solution |
|---|---|---|
| Publication rouge ❌ dans **Actions** | Erreur dans un fichier modifié | Ouvrir le workflow → étape en rouge → lire le message. Souvent : en-tête d'actualité incomplet (`title`, `date`, `summary` obligatoires) ou balise mal fermée. Corriger ou annuler la dernière modification. |
| Le site ne change pas après une modification | Publication pas terminée ou cache du navigateur | Attendre le ✅ dans **Actions**, puis recharger avec **Ctrl + F5**. |
| Le site ne change pas sur un appareil où l'application est installée | Ancienne version en cache | Rouvrir l'application : un bandeau propose **Mettre à jour**. Sinon fermer complètement l'application et la rouvrir. |
| Page blanche ou sans mise en forme | Mauvais `site`/`base` dans `astro.config.mjs` | Vérifier la section [3.4](#34-adapter-ladresse-du-site). |
| « Clé invalide, expirée ou révoquée » | Faute de saisie, lot expiré ou révoqué | Retaper la clé (ou scanner le QR code). Vérifier dans le Sheet (feuilles `Lots` et `Cles`) que le lot est actif. Le message est volontairement identique dans tous les cas. |
| « L'espace documents est en cours de mise en service » | `PWA.apiUrl` vide dans `src/config.ts` | Renseigner l'URL du déploiement Apps Script (6.1, étape 6-7). |
| Erreur après modification du script | Le déploiement n'utilise plus la dernière version | Apps Script → **Déployer → Gérer les déploiements → Nouvelle version**. |
| Un fichier ne s'ouvre pas | Fichier de plus de 20 Mo, ou en corbeille | Le réduire ou le découper ; vérifier qu'il est dans un dossier d'un ensemble. |
| Pas de notification | Déclencheur absent, notifications non activées sur l'appareil, iOS sans installation, `FCM_SERVICE_ACCOUNT` manquant | Apps Script → **Exécutions** et **Déclencheurs** ; relancer **Initialiser**. Sur iOS, ajouter l'application à l'écran d'accueil. Voir 5.2 pour les fichiers déplacés. |
| « Activation impossible » des notifications | Valeurs `PWA.firebase` incorrectes, API FCM désactivée | Vérifier 7.1 (étapes 2, 3 et 5) et la console du navigateur. |
| Erreur « Exception: No item with the given ID » | `dossierDriveId` incorrect dans la feuille `Ensembles` | Corriger l'ID du dossier. |
| Une pull request Dependabot est rouge | Mise à jour incompatible | Ne pas la fusionner. Lire l'erreur, ou attendre la version suivante. |

---

## 12. Organisation des fichiers

```text
├── .github/
│   ├── dependabot.yml          # mises à jour automatiques hebdomadaires
│   ├── skills/                 # instructions pour l'assistant IA (création du site)
│   └── workflows/deploy.yml    # vérification + publication sur GitHub Pages
├── apps-script/
│   ├── Code.gs                 # script Google : clés, API documents, notifications, menu admin
│   ├── Cards.html, QrLib.html  # fenêtre d'impression des cartes (QR code, bibliothèque MIT)
│   ├── Code.test.mjs           # tests hors ligne du script (npm run test:apps-script)
│   └── appsscript.json         # autorisations et déploiement du script
├── docs/
│   └── GESTION_MEMBRES_RGPD.md # ⭐ gestion des membres, anonymat, RGPD / CNIL
├── public/                     # fichiers copiés tels quels (icônes, images, sw.js, robots.txt, security.txt)
├── src/
│   ├── config.ts               # ⭐ nom, coordonnées, menu, réseaux sociaux, URL du script et Firebase (PWA)
│   ├── content/actualites/     # ⭐ une actualité = un fichier .md
│   ├── components/             # éléments réutilisables (réseaux sociaux, liste d'actualités)
│   ├── integrations/pwa.mjs    # injecte la liste de fichiers et la version dans le service worker
│   ├── layouts/Base.astro      # en-tête, menu, pied de page, sécurité (CSP), manifeste
│   ├── lib/                    # accès à l'API, session locale, hors connexion, notifications
│   ├── pages/                  # une page du site = un fichier (dont manifest.webmanifest.ts)
│   ├── scripts/                # scripts des pages (installation, documents, paramètres)
│   └── styles/global.css       # couleurs et mise en page
├── astro.config.mjs            # adresse du site et options de construction
└── package.json                # dépendances et commandes npm
```

Les fichiers marqués ⭐ sont ceux que vous modifierez le plus souvent.
