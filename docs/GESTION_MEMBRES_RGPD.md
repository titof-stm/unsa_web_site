# Gestion des membres, des clés d'accès et protection des données (RGPD / CNIL)

Projet : `unsa_web_site` (PWA). Ce document décrit le fonctionnement **réel** du code (`apps-script/Code.gs`, `src/lib/*`, `public/sw.js`). Toute évolution du code qui touche aux données personnelles doit mettre ce document à jour.

> **Avertissement** : ce document est un guide technique et organisationnel, **pas un avis juridique**. Il doit être relu par le délégué à la protection des données (DPO) de la fédération UNSA ou par un juriste avant mise en production. Les points « à valider » sont listés en §15.

---

## 1. Principe directeur : « on ne peut pas savoir qui est adhérent »

L'appartenance syndicale est une donnée **sensible** (RGPD art. 9) : son traitement est interdit par principe, sauf exceptions encadrées. Plutôt que de bien protéger une liste de membres, le système est conçu pour **ne jamais en contenir** :

| Règle | Conséquence |
|---|---|
| Une **clé d'accès aléatoire** = un accès aux documents, **rien d'autre** | La clé ne contient ni nom, ni email, ni numéro d'adhérent |
| **Aucune table de correspondance** clé ↔ personne, nulle part | Personne (administrateur compris) ne peut dire qui détient quelle clé |
| **Aucune journalisation d'usage** liée à une clé | On ne sait pas qui a lu quoi, ni quand |
| **Remise de la clé en main propre** (carte / QR), jamais par un canal numérique | Aucune trace d'envoi |
| **Révocation par lot** | Pas besoin d'identifier un individu pour couper un accès |
| **Notifications rattachées à un ensemble de documents**, pas à une personne | Le serveur ne connaît pas les appareils des membres |

**Réalité à assumer** : certaines données techniques restent des données personnelles même sans nom (adresse IP vue par l'hébergeur, jeton d'appareil de notification). On applique donc le RGPD **comme s'il s'agissait de données personnelles** (information, droits, durées, sous-traitants) tout en les réduisant au strict minimum.

---

## 2. Qualification juridique (France)

| Sujet | Position retenue | Référence |
|---|---|---|
| Appartenance syndicale | Donnée sensible, art. 9.1 RGPD | RGPD art. 9 |
| Exception applicable | Art. 9.2.d : organisme à but non lucratif syndical, traitant les données de **ses membres, anciens membres ou personnes en contact régulier**, avec garanties appropriées, **sans communication hors de l'organisme sans consentement** | RGPD art. 9.2.d |
| Base légale (art. 6) | **Intérêt légitime** (gestion de l'accès des adhérents à leurs documents) ou exécution du lien d'adhésion. L'art. 9.2.d ne remplace pas une base légale art. 6 | RGPD art. 6 |
| Registre des traitements | **Obligatoire** : la dispense < 250 personnes ne s'applique pas aux données de l'art. 9 | RGPD art. 30.5 |
| Traceurs / push | Écriture/lecture dans le terminal : consentement requis sauf traceur **strictement nécessaire** (authentification, panier…). Le **push** n'est pas strictement nécessaire : consentement par acte positif | Loi Informatique et Libertés art. 82 ; délibération CNIL 2020-091 |
| Droit des personnes | Accès, rectification, effacement, opposition, limitation. Art. 11 : le responsable n'est **pas tenu de ré-identifier** une personne pour répondre | RGPD art. 11, 12, 15-21 |
| Violation de données | Notification CNIL sous **72 h** si risque ; information des personnes si risque élevé | RGPD art. 33, 34 |
| AIPD (analyse d'impact) | Données sensibles : une **AIPD simplifiée est documentée** (§12), même si l'échelle est réduite ; à confirmer par le DPO | RGPD art. 35 ; liste CNIL |
| Bonnes pratiques CNIL pour les syndicats | Politique d'habilitation, accès limité aux personnes ayant à en connaître, **chiffrement des échanges**, **traçabilité des accès aux données personnelles**, archivage intermédiaire des anciens adhérents | CNIL « Fichiers d'adhérents à un syndicat : quelles sont les bonnes pratiques ? » |

Sources : <https://www.cnil.fr/fr/fichiers-dadherents-un-syndicat-quelles-sont-les-bonnes-pratiques>, délibération 2020-091 sur Légifrance, texte du RGPD (EUR-Lex).

**Responsable de traitement** : l'UNSA STMicroelectronics (section/syndicat). **Sous-traitants** : Google (Apps Script, Drive, Sheets, Firebase Cloud Messaging), GitHub/Microsoft (hébergement du site statique).

### Deux traitements à ne jamais mélanger

| | Traitement A : fichier d'adhésion | Traitement B : accès numérique aux documents (ce système) |
|---|---|---|
| Contenu | Identité, coordonnées, cotisation | Clés hachées, lots, ensembles de documents, expirations |
| Lieu | Bulletin papier / formulaire géré hors du système B | Google Sheet « admin », Apps Script |
| Lien avec l'identité | Oui | **Aucun** |
| Statut | Soumis au RGPD (déjà existant, hors périmètre technique) | Anonyme par conception |

> Règle d'or : **ne jamais noter, ailleurs, à qui une clé a été remise.** Le jour où ce lien existe, le système B devient un traitement de données sensibles identifiantes.

---

## 3. Cartographie des données du système

| Donnée | Où | Personnelle ? | Durée | Remarque |
|---|---|---|---|---|
| Hash de clé (HMAC-SHA256) | Feuille `Cles` (colonnes `keyHash`, `numero`, `lot`, `revoquee`) | Non (aléatoire, non relié) | Durée du lot + 30 j | Clé en clair jamais stockée |
| Lot, type, ensembles, expiration, état | Feuille `Lots` ; ensembles et dossiers Drive dans `Ensembles` | Non | Idem | Aucune date de création, aucun usage **par clé** |
| Jeton de session (signé) | Appareil (stockage local) | Pseudonyme (technique) | 12 h, ou 30 j si « Rester connecté » ; borné par l'expiration du lot | « Strictement nécessaire » à l'authentification ; revérifié (lot, clé révoquée) à chaque appel |
| Jeton d'appareil FCM | Firebase (abonnement au *topic* du lot) ; **non stocké dans le Sheet** ; conservé sur l'appareil pour pouvoir se désabonner | **Oui** (identifiant d'appareil) | Jusqu'à désinscription / déconnexion | Consentement explicite requis |
| Cache hors-ligne de documents | Appareil | Contenu sensible | ≤ 30 j (purge automatique), effacé à la déconnexion | Désactivé par défaut : l'utilisateur choisit fichier par fichier |
| Adresse IP | GitHub Pages (hébergeur), Google (Apps Script, FCM) | **Oui** | Selon ces sous-traitants | Hors de notre contrôle ; à mentionner |
| Journal des actions d'administration | Feuille `JournalAdmin` (date, action, détail : n° de lot, nombre de clés) | Non nominatif (l'historique des versions Google identifie l'éditeur) | 12 mois | Aucune clé, aucun utilisateur final |
| Statistiques d'usage | Feuille `Stats` : connexions et échecs **par jour**, globaux | Non | 12 mois | Aucun détail par clé |

**À ne jamais collecter** : nom, email, téléphone, matricule, adresse IP applicative, user-agent, géolocalisation, horodatage de dernière connexion par clé, Google Analytics ou tout traceur tiers.

---

## 4. Cycle de vie d'une clé

```
Création (lot)  →  Impression  →  Remise en main propre  →  Utilisation  →  Expiration / Révocation du lot  →  Purge
```

1. **Création** : l'administrateur, depuis le menu « UNSA clés » du Sheet, génère un **lot** (ex. `2026-A`, 50 clés, type `membre`, ensembles, durée de validité). Chaque clé fait **140 bits d'aléa** (28 caractères d'un alphabet de 32 sans caractères ambigus, tirés d'un générateur cryptographique), affichée en 7 groupes de 4 : `ABCD-EFGH-JKMN-PQRS-TVWX-YZ23-4567`. À la saisie, minuscules, tirets, espaces et confusions `O`/`0`, `I`/`L`/`1` sont tolérés.
2. **Affichage unique** : la clé en clair n'apparaît **que** dans la boîte de dialogue de génération (cartes avec QR code, à imprimer). Elle n'est **jamais écrite** dans le Sheet ni dans un journal. Seul le hash est conservé.
3. **Impression** : sur une imprimante **locale** de l'administrateur (éviter les imprimantes réseau à historique). N'enregistrez pas de PDF ; s'il en existe un, supprimez-le et videz la corbeille.
4. **Mélange** : l'ordre d'affichage des cartes est **mélangé** par le programme ; mélangez-les encore après découpe. Les clés sont **aléatoires** : l'ordre ne doit jamais refléter l'ordre des adhésions.
5. **Remise en main propre** à l'adhérent (ou à l'invité), avec la mention d'information courte (§13). Pas de note, pas de liste de remise.
6. **Utilisation** : saisie de la clé ou scan du QR. Le QR encode `https://…/documents/#k=CLE` : le **fragment `#` n'est jamais envoyé au serveur** ni inscrit dans les journaux d'hébergement ; le script le lit, remplit le champ puis l'efface de l'URL (`history.replaceState`).
7. **Expiration / révocation** : par lot (§6). Les appareils perdent l'accès au prochain appel (délai maximal : 1 minute, durée du cache d'état).
8. **Purge** : le menu « Purger les lots expirés » **supprime** les lots (et leurs hash) expirés ou révoqués depuis plus de 30 jours, ainsi que les statistiques et journaux de plus de 12 mois.

**Quantités** : prévoir une marge raisonnable (ex. +10 %) et un lot « invités » distinct, à durée courte (ex. 7 à 30 jours).

---

## 5. Rôles et habilitations

| Rôle | Nombre | Droits | Mesures |
|---|---|---|---|
| **Administrateur de clés** | 2 (titulaire + suppléant) | Menu Sheet : générer, révoquer, prolonger, purger lots | Compte Google **dédié à l'organisation** (pas un compte personnel), **validation en 2 étapes / passkey**, mot de passe unique et fort |
| **Éditeur de documents** | 1 à 3 | Dépose des fichiers dans les dossiers Drive | Pas d'accès au Sheet des clés |
| **Éditeur du site** | selon besoin | Dépôt GitHub | 2FA GitHub obligatoire ; aucun secret dans Git |
| **Adhérent / invité** | n | Lecture des ensembles liés à sa clé | Aucun droit d'écriture |

- Le Sheet `Cles` est **non partagé** (propriétaire + 1 suppléant) ; désactiver « toute personne disposant du lien ».
- Le projet Apps Script est lié au **compte organisation** ; documenter la succession (qui reprend si l'administrateur part). Sans cela, risque de blocage ou de perte de contrôle.
- **Revue annuelle des habilitations** (qui a accès à quoi), consignée.
- Principe du moindre privilège : permissions Apps Script limitées (Drive lecture, Sheets, UrlFetch).

---

## 6. Révocation et renouvellement

| Situation | Action | Effet |
|---|---|---|
| **Renouvellement annuel d'adhésion** | Nouveau lot distribué ; ancien lot marqué `expire` à la date de transition | Les anciens adhérents perdent l'accès |
| **Départ d'un adhérent** | Aucune action individuelle possible (anonymat) ; l'accès s'arrête à l'expiration du lot | Délai maximal = durée du lot |
| **Clé perdue / volée / divulguée (numéro connu)** | Révocation du **numéro de clé** isolé (si la personne connaît son numéro imprimé sur la carte) | Seule cette clé est coupée |
| **Fuite suspectée d'un lot** | Révocation du lot entier + nouveau lot | Redistribution en main propre |
| **Invités** | Lot invité à expiration courte | Expiration automatique |

Le **n° opaque** imprimé sur la carte permet à un porteur de demander la révocation de sa propre clé **sans révéler son identité**.

Choix assumé : **pas de registre** → impossible de bannir une personne nommément. Compensation : durée de lot courte (≤ 12 mois), renouvellement annuel.

---

## 7. Mesures de sécurité techniques

| Menace | Mesure |
|---|---|
| Devinette de clé | 140 bits d'aléa (infaisable par force brute) ; plafond global de 60 échecs par fenêtre de 10 minutes (`CacheService`) avec délai croissant ; **même réponse** pour clé inconnue, expirée ou révoquée. Compromis : un attaquant peut bloquer *les nouvelles connexions* pendant la fenêtre ; les sessions ouvertes continuent de fonctionner |
| Vol de la base | Seuls des **HMAC-SHA256** (avec *pepper* secret dans les Script Properties) sont stockés : inexploitables sans le pepper |
| Clé dans les journaux / l'historique | Jamais dans l'URL (requêtes `POST`, corps) ; fragment `#` effacé ; le code n'enregistre jamais les requêtes ; test automatisé vérifiant qu'aucune clé n'est écrite dans les feuilles |
| Vol de session | Jeton signé HMAC (n° de carte, lot, expiration), 12 h ou 30 j, **revérifié côté serveur à chaque appel** (lot actif, clé non révoquée) ; jamais journalisé |
| Accès à un fichier hors périmètre | Le serveur vérifie à chaque appel que le fichier appartient à un ensemble autorisé (aucune confiance dans le client) |
| Interception | HTTPS partout ; CSP stricte (`script-src 'self'`, `connect-src` limité) |
| Appareil perdu | Bouton « Se déconnecter et effacer » ; cache hors-ligne désactivé par défaut et purgé après 30 j ; verrouillage de l'appareil recommandé |
| XSS | Pas de script inline ; échappement des noms de fichiers ; pas d'`innerHTML` avec des données serveur |
| Compromission du compte admin | 2FA/passkey ; alerte Google sur connexions ; révocation immédiate du lot et du pepper (rotation = tous les hash invalidés → nouveau lot) |
| Secrets | **Jamais dans Git** : pepper, secret HMAC de session, compte de service FCM dans les *Script Properties* |
| Dépendances | Dependabot déjà actif ; `npm audit` en CI |

**Traçabilité sans identification** (exigence CNIL de détecter les accès illégitimes) : on journalise les **événements d'administration** (génération, prolongation, révocation, purge) et des **compteurs agrégés** (connexions et échecs par jour : un pic d'échecs signale une tentative d'intrusion), mais **aucun événement par utilisateur final**.

---

## 8. Notifications push : respect de la vie privée

1. **Consentement** : l'utilisateur déclenche lui-même l'activation (bouton « Activer les notifications » dans Paramètres), avec texte clair : finalité, absence d'identité, désactivation possible à tout moment. Pas de demande au chargement de la page.
2. **Pas de lien avec la clé** : après vérification de la session, le serveur abonne le jeton d'appareil au **topic FCM du lot** (`lot-<id>`). Le jeton n'est **pas enregistré** dans le Sheet ; le serveur ne sait pas combien d'appareils sont abonnés ni à qui ils appartiennent.
3. **Révocation sans registre des appareils** : un lot révoqué ou expiré n'est plus notifié (le serveur n'envoie plus rien à son topic) ; ses appareils ne reçoivent plus d'alerte. Au renouvellement, les nouveaux lots ont de nouveaux topics et l'appareil se réabonne à la connexion avec la nouvelle clé. Limite : la révocation d'**une seule** clé ne retire pas son appareil du topic du lot ; il peut encore recevoir l'alerte générique, mais plus lire un seul document.
4. **Contenu neutre** : le serveur n'envoie qu'un message sans contenu ; le service worker affiche toujours le même texte (« Nouveau contenu disponible »), **sans nom de fichier ni d'ensemble**. Option « mode discret » : ni mot « UNSA » ni logo sur l'écran de verrouillage.
5. **Désinscription** : bouton dans Paramètres + désinscription automatique du topic et suppression du jeton à la déconnexion.
6. **Sous-traitant** : Google/Firebase. Accepter le **Cloud Data Processing Addendum** dans la console Google Cloud/Firebase du projet (inclut les clauses contractuelles types) ; mentionner dans l'information le transfert possible vers les États-Unis.
7. **Email de secours** : retiré par défaut (il exigerait une liste d'emails d'adhérents, contraire à l'anonymat). Le Google Group `adherents@…` utilisé aujourd'hui doit être **supprimé à la bascule** (c'est une liste de membres).

> Le simple affichage d'une notification « UNSA » sur un écran de téléphone peut révéler l'appartenance à un tiers : c'est un risque d'exposition réel, d'où le mode discret.

---

## 9. Droits des personnes : comment les exercer sans identité

| Droit | Comment |
|---|---|
| Information | Mentions légales + page « Confidentialité » + mention courte remise avec la carte (§13) |
| Accès | Le système ne détient aucune donnée nominative ; réponse type : « nous ne pouvons pas relier une donnée à vous » (art. 11). L'appareil affiche **ce qui est stocké localement** (page Paramètres : jeton, abonnements, cache) |
| Effacement / retrait du consentement | Bouton « Se déconnecter et effacer mes données » : supprime session, abonnement push, cache. Révocation de la clé isolée sur demande avec le n° de carte |
| Opposition | Idem + simple arrêt d'usage (aucune donnée active à conserver) |
| Rectification | Sans objet (aucune donnée nominative) |
| Réclamation | CNIL : <https://www.cnil.fr/fr/plaintes> |

Un contact « données personnelles » (email du bureau ou DPO) est indiqué sur la page Confidentialité. Délai de réponse : **1 mois** (art. 12).

---

## 10. Procédure en cas de violation de données

1. **Contenir** (≤ 1 h) : révoquer le lot concerné, faire pivoter le pepper et les secrets si besoin, changer le mot de passe/la 2FA du compte admin.
2. **Évaluer** : quelles données ? Une fuite de hashs + pepper ou d'un PDF de cartes = risque **élevé** pour tous les porteurs du lot ; une fuite de hashs seuls = risque faible.
3. **Documenter** dans le **registre des violations** (même sans notification).
4. **Notifier la CNIL sous 72 h** si risque pour les droits et libertés (téléservice de notification de violation).
5. **Informer les personnes** si risque élevé : par affichage/réunion/communication du syndicat (pas de liste d'adresses).
6. **Redistribuer** un nouveau lot en main propre.

---

## 11. Registre des traitements (modèle à compléter)

| Champ | Contenu |
|---|---|
| Responsable | UNSA STMicroelectronics, [adresse], [contact RGPD] |
| Finalité | Permettre aux adhérents et invités de consulter les documents du syndicat et d'être informés de nouveaux documents |
| Base légale | Intérêt légitime ; art. 9.2.d pour les données de membres |
| Personnes concernées | Adhérents, anciens adhérents, invités (de façon non identifiante) |
| Catégories de données | Clé hachée, lot, ensembles autorisés, jeton d'appareil de notification, jeton de session |
| Destinataires | Administrateurs désignés ; sous-traitants Google et GitHub |
| Transferts hors UE | Google LLC (États-Unis) : clauses contractuelles types / cadre de transfert applicable ; GitHub/Microsoft |
| Durée | Voir §3 |
| Sécurité | Voir §5 et §7 |

Tenir aussi un **registre des violations**, un **journal des habilitations** et un **registre des sous-traitants** (avec la date d'acceptation des DPA).

---

## 12. Analyse d'impact simplifiée

| Risque | Gravité | Vraisemblance | Mesures | Risque résiduel |
|---|---|---|---|---|
| Identification d'un adhérent (révélation d'appartenance syndicale) | Élevée | Faible | Anonymat par conception, pas de registre, pas de journal d'usage | Faible |
| Fuite des cartes imprimées | Moyenne | Faible | Impression locale, suppression, mélange, lots courts | Faible |
| Vol du compte admin | Élevée | Faible | 2FA/passkey, compte dédié, rotation du pepper | Faible |
| Observation par l'employeur (réseau/appareil professionnel) | Élevée | Moyenne | Recommandations d'usage (§14) ; HTTPS ; pas de contenu en clair dans les notifications | **Moyen** (hors de notre contrôle) |
| Écran de verrouillage révélant « UNSA » | Moyenne | Moyenne | Mode discret | Faible |
| Partage de clé entre personnes | Faible | Moyenne | Renouvellement annuel ; non détectable par conception | Accepté |
| Transfert hors UE (Google) | Moyenne | Moyenne | DPA/CCT, minimisation, pas de données nominatives | Faible |
| Perte de contrôle (admin parti) | Moyenne | Moyenne | Compte organisation, suppléant, procédure de succession | Faible |

À faire valider par le DPO ; réexaminer tous les ans.

---

## 13. Textes types

**Mention courte remise avec la carte**
> Cette clé personnelle vous donne accès aux documents de l'UNSA STMicroelectronics. Elle n'est liée à aucun nom ni aucun fichier. Gardez-la confidentielle ; ne la transmettez pas. En cas de perte, indiquez le numéro imprimé sur la carte pour la désactiver, sans révéler votre identité. Vos données et vos droits : voir la page « Confidentialité » du site.

**Texte du bouton « Activer les notifications »**
> Recevoir une alerte quand un nouveau document est disponible. Aucune information vous identifiant n'est collectée. Vous pouvez désactiver les notifications à tout moment dans Paramètres. Le service d'envoi est fourni par Google Firebase (transferts possibles hors UE).

**Page « Confidentialité »** (à créer) : responsable, finalités, bases légales, données, durées, destinataires et sous-traitants, transferts hors UE, droits et contact, CNIL, absence de cookies publicitaires/analytics.

---

## 14. Conseils d'usage anonyme pour les utilisateurs

- Utiliser de préférence un **appareil personnel** et le **réseau mobile ou domestique**, pas le Wi-Fi ni l'ordinateur de l'entreprise (un réseau d'entreprise peut voir qu'un site syndical est consulté).
- Activer le verrouillage de l'écran ; en cas de perte du téléphone, utiliser « Se déconnecter et effacer ».
- Ne pas partager sa clé ni la photographier.
- Activer le **mode discret** des notifications si l'écran est visible par des tiers.
- Ne pas laisser l'option « disponible hors-ligne » activée sur un appareil partagé.

---

## 15. Limites et points à valider

1. **Validation juridique** par DPO/juriste : qualification « anonyme » vs « pseudonyme », base légale, nécessité d'une AIPD formelle, rédaction de la page Confidentialité.
2. **Contrats sous-traitants** : accepter/archiver les DPA Google (Workspace/Cloud/Firebase) et vérifier les conditions GitHub.
3. **Données techniques** (IP chez l'hébergeur) non maîtrisables : à mentionner.
4. **Pas de registre** : la révocation individuelle dépend du numéro de carte ; le départ d'un adhérent ne coupe pas l'accès avant l'expiration du lot.
5. **Employeur** : le syndicat ne peut pas empêcher la supervision d'un réseau ou d'un appareil d'entreprise ; seules des recommandations sont possibles.
6. **Documents eux-mêmes** : les comptes rendus ou documents déposés dans Drive peuvent contenir des données personnelles (noms de salariés) : relire avant dépôt, minimiser (traitement distinct, à encadrer).
7. **Limites Apps Script** : latence, quotas, taille de fichier ≈ 20-25 Mo ; plan de repli éventuel (hébergement dédié européen) si le volume augmente.
8. **Migration** : supprimer le Google Group des adhérents et l'ancienne notification email ; purger les anciennes listes.

---

## 16. Checklist de mise en production

- [ ] Compte Google d'organisation créé, 2FA/passkey actif, suppléant désigné
- [ ] Sheet `Cles` non partagé ; Script Properties : pepper, secret de session, compte de service FCM
- [ ] DPA Google/Firebase acceptés et archivés
- [ ] Registre des traitements, registre des violations, journal des habilitations créés
- [ ] Page « Confidentialité » et mentions légales publiées
- [ ] AIPD simplifiée relue par le DPO
- [ ] Premier lot généré, imprimé en local, PDF supprimé, cartes mélangées
- [ ] Test : clé valide / expirée / révoquée / inconnue ; push reçu ; désinscription ; effacement local
- [ ] Vérification qu'aucune clé ni donnée nominative n'apparaît dans les journaux Apps Script et le Sheet
- [ ] Ancien Google Group des adhérents supprimé
- [ ] Revue annuelle programmée (renouvellement de lot, habilitations, AIPD)
