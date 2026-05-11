# Backlog — Application Bénévoles Spacers

> **Projet** : `spacers-benevoles`
> **Dernière mise à jour** : 5 mai 2026
> **Mainteneur** : Clément Augustin
> **Statut global** : prêt au lancement saison 2026-2027 sous réserve de validation du Bureau Directeur

---

## 📊 Synthèse en chiffres

- **3 chantiers majeurs** terminés (Chantier 11, Chantier 12, Présentation)
- **5 livrables RGPD** déployés (4.1 → 4.4 + Edge Function email-outbox)
- **9 fichiers SQL** de migration en production
- **3 documents légaux** prêts à validation
- **9 captures** intégrées dans la présentation au Bureau
- **5 prestataires** intégrés (Supabase, Cloudflare, Mailjet, Make.com, GitHub)
- **0 €** de coût d'exploitation actuel
- **100 %** des données stockées en Union Européenne

---

## ✅ Livré et en production

### Chantier 11 — Bucket photos privé
- [x] Migration SQL : ajout colonne `photo_path`, backfill REGEXP, nullification `photo_url`
- [x] Bucket Supabase passé en privé avec 4 policies RLS storage
- [x] `dashboard.html` : helpers `getSignedPhotoUrl()` + `getSignedPhotoUrls()` (batch), cache JS 50 min
- [x] `pilote.html` : wrapper `resolvePhotosInList()` sur 4 contextes, `printAccred` async
- [x] TTL signed URL : 3600 s

### Chantier 12 — Documents légaux et onboarding RGPD
- [x] **C12.1** Mentions légales avec données réelles club (RNA W313011168, SIRET 392 771 275 00022, FFVB n°0314739, IDCC 2511, code APE 9312 Z, TVA FR 32 392 771 275)
- [x] **C12.2** Politique de confidentialité (10 Ko HTML, accessible sur `/confidentialite.html`)
- [x] **C12.3** Règlement intérieur (PDF 5 pages, 11 articles, 18+ avec clause d'ouverture future, no-show souple, tenue libre)
- [x] **C12.4** Migration SQL `consents` (CHECK 7 valeurs) + écran consentement obligatoire au login + `AGE_MINIMUM=15` + `CONSENT_VERSION='1.0'`

### Livrable 4 RGPD — Droits utilisateur complets
- [x] **4.1** SQL : 4 RPC sécurisées (`request_account_deletion`, `cancel_account_deletion`, `export_account_data`, `update_newsletter_consent`) + colonnes `deletion_*` + vue `v_pending_deletions`
- [x] **4.2** UI dashboard "🛡️ Mon compte" : carte avec newsletter toggle, export JSON+PDF (jsPDF 2.5.1), demande suppression, écran recovery rouge gradient
- [x] **4.3a** Cron `hard-delete-rgpd` à 3h17 (pg_cron) + table `email_outbox` + fonction `process_due_deletions()` avec anonymisation forte
- [x] **4.3c** Edge Function `email-outbox-processor` (Deno + Mailjet API v3.1) + cron 5 min + retries max 3 + secrets gérés via `_app_secrets`
- [x] **4.4** UI pilote : bouton 🛡️ par bénévole, modal RGPD avec export et suppression (motif obligatoire) + email immédiat dans `email_outbox`

### Présentation Bureau Directeur
- [x] Page HTML autonome `presentation-bureau.html` v1.2 en ligne
- [x] 10 sections rédigées : pourquoi, fonctionnalités, niveaux d'accès, sécurité, hébergement, risques, coûts, gouvernance, roadmap, décision attendue
- [x] 9 captures intégrées (accueil, planning, fiches de poste×2, points+barème, forum, emploi, mon compte RGPD, vue pilote)
- [x] Section propriété intellectuelle correctement formulée (cas B : code propriété auteur + licence d'usage gratuite, perpétuelle, non-exclusive au club)
- [x] URL : <https://spacers-benevoles.spacersytb.workers.dev/presentation-bureau.html>

### Infrastructure technique opérationnelle
- [x] Tables Supabase : `benevoles`, `consents`, `email_outbox`, `_app_secrets`
- [x] Vues : `v_consents_latest`, `v_pending_deletions`
- [x] 4 RLS storage policies + 4 RPC SECURITY DEFINER avec `auth.email()`
- [x] Edge Function : `https://xphuolvbamdkizydveij.supabase.co/functions/v1/email-outbox-processor`
- [x] 2 crons pg_cron : `hard-delete-rgpd` (17 3 * * *) + `email-outbox-processor` (*/5 * * * *)
- [x] Mailjet sender validé : `marketing@spacerstoulouse.fr`
- [x] Référent RGPD désigné : Didier CONJEAUD

---

## ⏳ Reste à faire

### 🔴 Sécurité — dès que possible

- [ ] **🛡️ Rotation de la `service_role_key`** _(5 min)_
    - Clé partagée par mégarde dans le chat lors du setup Edge Function
    - Procédure : `Settings/API` → Reveal service_role → bouton Roll → mise à jour Edge Function secrets + table `_app_secrets`
    - Pas urgent mais bonne pratique sécurité

### 🟡 Polish UX — quand 5 min de libre

- [ ] **🎨 Fix cosmétique PDF dashboard** _(5 min)_ — _prévu pour chat dédié_
    - Remplacer `✓` / `✗` par `[OK]` / `[NON]` dans `generateExportPDF` de `dashboard.html`
    - `pilote.html` est déjà OK avec `rgpdGenerateExportPDF`
    - Localisation : chercher `const status = c.granted ? '✓' : '✗'`

### 🟡 Conformité opérationnelle

- [ ] **📣 Communication WhatsApp aux bénévoles existants** _(5 min)_
    - Avant qu'ils tombent sur l'écran consentement à leur prochain login
    - 3 variantes de message déjà rédigées (court / explicatif / annonce nouveautés)

- [ ] **📦 Compte de test dédié pour valider hard-delete** _(15 min)_
    - Créer `test-rgpd@spacers...`
    - Protocole : request → forcer `deletion_scheduled_for` → run `process_due_deletions()` → vérifier anonymisation

### 🟢 Features Mailjet débloquées — _prévu pour chat dédié_

- [ ] **📧 Email J-3 fiche poste + vidéo** _(1-2h)_
    - pg_cron ou trigger qui INSERT dans `email_outbox` à J-3 du match
    - Contenu : poste affecté, fiche de poste, lien vidéo YouTube
    - Idempotence à gérer (pas d'envoi multiple si réinscription)

- [ ] **📧 Email ouverture inscriptions match** _(1-2h)_
    - Quand un match passe en statut "ouvert" (à J-15 ou sur trigger)
    - Notification à tous les bénévoles actifs
    - Anti-spam : grouper si plusieurs matchs ouverts en même temps

### 🟢 Nouvelles fonctionnalités — _prévu pour chat dédié_

- [ ] **🎮 Chantier 10 — Refonte gamification** _(4-6h)_
    - Nouveau système de points / niveaux / badges
    - À cadrer : barème de points, nombre de paliers, badges thématiques, défis (l'écran les affiche déjà mais code à investiguer), économie d'échange ou avantages automatiques
    - Doit être validé avec un pilote ou membre du bureau avant développement

- [ ] **📱 Widget Instagram embed** _(1h)_
    - Affichage des derniers posts du club dans le tableau de bord bénévole
    - Section "Actu du club" déjà visible, peut-être à optimiser

- [ ] **🪪 Visuel PDF accréditation amélioré** _(2h)_
    - Charte graphique aboutie, logo plus visible, code couleur des zones d'accès
    - Capture du PDF amélioré à intégrer en v1.3 de la présentation

- [ ] **🧹 Cleanup pré-saison Mailjet et Make.com** _(1h)_
    - Audit scénarios Make.com obsolètes
    - Vérification contacts et listes Mailjet
    - Suppression de ce qui n'est plus utilisé

### 🔵 Long terme — saison 2027-2028 et au-delà

- [ ] Application mobile native (iOS, Android)
- [ ] Notifications push complémentaires aux emails
- [ ] Module de covoiturage intégré au forum
- [ ] Mutualisation avec autres équipes du club (jeunes, féminines)
- [ ] Ouverture aux mineurs 15-17 ans (infrastructure technique déjà préparée, en attente de décision politique du club)

### 📋 Validation Bureau Directeur — préalable au lancement

- [ ] Validation des **mentions légales**
- [ ] Validation de la **politique de confidentialité**
- [ ] Validation du **règlement intérieur**
- [ ] Désignation officielle de **Didier CONJEAUD comme référent RGPD**
- [ ] **Lancement opérationnel visé** : rentrée saison 2026-2027 (septembre / octobre 2026)

### ⚖️ Recommandation juridique — bonne pratique non bloquante

- [ ] Formaliser par un **document écrit de licence** entre l'auteur du code et le club
    - Cadre la cession de licence d'usage gratuite, perpétuelle, non-exclusive
    - À rédiger après validation bureau de la présentation

---

## 🔑 Infos techniques à conserver

| Élément | Valeur |
|---|---|
| Projet Supabase | `xphuolvbamdkizydveij` |
| Worker Cloudflare | <https://spacers-benevoles.spacersytb.workers.dev/> |
| Edge Function | `https://xphuolvbamdkizydveij.supabase.co/functions/v1/email-outbox-processor` |
| OUTBOX_SECRET | `qCFnz41XnBeKR8Y_HVuYezzgICR6GNqicfwU8xSPHYMkxtMIRh9d5VofhlSWHfiq` |
| Sender Mailjet | `marketing@spacerstoulouse.fr` (validé) |
| Référent RGPD | Didier CONJEAUD — `contact@spacerstoulouse.fr` |
| CONSENT_VERSION actuelle | `1.0` (à incrémenter si modification politique) |
| AGE_MINIMUM dans le code | `15` (mais règlement actuel = 18+) |
| Comptes admin actifs | `marketing@spacerstoulouse.fr` (Marie AAA, 250 pts) + `contact@spacerstoulouse.fr` |
| Repo GitHub | `1994-spa/spacers-benevoles` |

---

## 🗂️ Documents et URLs publics

| Document | URL |
|---|---|
| Application bénévole | <https://spacers-benevoles.spacersytb.workers.dev/> |
| Dashboard pilote | <https://spacers-benevoles.spacersytb.workers.dev/pilote> |
| Mentions légales | <https://spacers-benevoles.spacersytb.workers.dev/mentions-legales.html> |
| Politique de confidentialité | <https://spacers-benevoles.spacersytb.workers.dev/confidentialite.html> |
| Règlement intérieur | <https://spacers-benevoles.spacersytb.workers.dev/reglement-interieur.pdf> |
| Présentation au Bureau | <https://spacers-benevoles.spacersytb.workers.dev/presentation-bureau.html> |

---

## 📜 Historique des versions de ce backlog

| Version | Date | Note |
|---|---|---|
| 1.0 | 5 mai 2026 | Création initiale après finalisation Chantier 12 RGPD complet et présentation Bureau v1.2 |
