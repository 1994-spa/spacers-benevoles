# Registre des traitements de données personnelles

**Responsable de traitement** : TOAC-TUC VOLLEY-BALL
**Adresse** : Palais des Sports André Brouat, 3 rue Pierre Laplace, 31000 Toulouse
**Co-présidents** : Eric MAUGARD et Didier CONJEAUD
**Référent RGPD** : Didier CONJEAUD — contact@spacerstoulouse.fr
**Date du registre** : 1er juin 2026
**Version** : 1.1

---

## Préambule

Ce registre liste les traitements de données personnelles mis en œuvre par TOAC-TUC VOLLEY-BALL (ci-après « le Club ») dans le cadre de ses applications numériques (application bénévoles, application buvette), conformément à l'article 30 du RGPD. Il est tenu à jour par le référent RGPD désigné.

---

## Traitement n°1 — Gestion des bénévoles

| Champ | Description |
|---|---|
| **Finalité** | Inscription, gestion du planning de bénévolat, accréditation lors des matchs, communication relative aux missions |
| **Personnes concernées** | Bénévoles du Club (15 ans et plus uniquement) |
| **Catégories de données** | Identité (nom, prénom, date de naissance), contact (email, téléphone), photo d'accréditation, identifiants de connexion (magic link), historique d'engagement, préférences (poste, disponibilités) |
| **Base légale** | Exécution d'un contrat (engagement de bénévolat) — Art. 6.1.b RGPD ; Intérêt légitime (organisation d'événements, sécurité accréditation) — Art. 6.1.f RGPD |
| **Durée de conservation** | Compte actif : durée d'engagement + 1 saison sportive. Compte inactif : suppression automatique après 3 ans d'inactivité. Photo d'accréditation : suppression à la désinscription. |
| **Destinataires internes** | Bureau du Club, responsables d'événement, référent RGPD |
| **Sous-traitants** | Supabase (Irlande, UE) ; Cloudflare (US, CCT) ; Make.com (Tchéquie, UE) ; Mailjet (France, UE) |
| **Sécurité** | Auth Supabase magic link (pas de mot de passe), RLS sur toutes les tables, photos en bucket privé avec URLs signées, HTTPS, journalisation accès admin |
| **Mineurs** | Inscription à partir de 15 ans uniquement (seuil de consentement numérique en France, art. 7-1 LIL). Vérification déclarative via date de naissance à l'inscription. |

---

## Traitement n°2 — Gestion de la buvette (POS)

| Champ | Description |
|---|---|
| **Finalité** | Encaissement des ventes lors des matchs, suivi de stock, programme de fidélité optionnel |
| **Personnes concernées** | Acheteurs ayant souscrit au programme de fidélité ; bénévoles tenant la buvette |
| **Catégories de données** | Email (programme fidélité, opt-in) ; montants et horodatages des transactions ; mode de paiement (CB / Espèces) |
| **Base légale** | Consentement (programme de fidélité) — Art. 6.1.a RGPD ; Obligation légale (tenue comptable) — Art. 6.1.c RGPD |
| **Durée de conservation** | Données fidélité : 3 ans après la dernière transaction. Données comptables : 10 ans (obligation légale, art. L.123-22 Code de commerce). |
| **Destinataires internes** | Trésorier du Club, bénévoles habilités à la buvette |
| **Sous-traitants** | Google (Apps Script + Sheets, UE) |
| **Sécurité** | Accès admin protégé par PIN, données chiffrées en transit (HTTPS), accès au tableur sous-jacent restreint aux comptes habilités |

---

## Traitement n°3 — Communication par email

| Champ | Description |
|---|---|
| **Finalité** | Envoi d'emails opérationnels aux bénévoles : convocations (J-15, J-3, J-1), rappels, suivi post-événement (J+1) |
| **Personnes concernées** | Bénévoles inscrits sur l'application |
| **Catégories de données** | Email, prénom, nom, fonction sur la mission, date et lieu de l'événement |
| **Base légale** | Exécution du contrat de bénévolat — Art. 6.1.b RGPD |
| **Durée de conservation** | Tant que le bénévole est actif. Suppression automatique 1 an après dernière mission. |
| **Destinataires internes** | Référent communication, bureau du Club |
| **Sous-traitants** | Mailjet (France, UE) ; Make.com (Tchéquie, UE) |
| **Sécurité** | Authentification API par token, lien d'opt-out / désinscription dans chaque email, journalisation des envois |

---

## Traitement n°4 — Hébergement et journalisation technique

| Champ | Description |
|---|---|
| **Finalité** | Mise à disposition des applications web ; journalisation à des fins de sécurité et de débogage |
| **Personnes concernées** | Tous les visiteurs des applications |
| **Catégories de données** | Adresse IP, user-agent, horodatage, URL visitée, codes de réponse |
| **Base légale** | Intérêt légitime (sécurité du système d'information) — Art. 6.1.f RGPD |
| **Durée de conservation** | 12 mois maximum, puis purge automatique |
| **Destinataires internes** | Administrateur technique uniquement |
| **Sous-traitants** | Cloudflare (Workers, US — CCT) ; GitHub Pages (US — CCT) |

---


## Traitement n°5 — Événements bénévoles (afterworks, sorties, formations)

| Champ | Description |
|---|---|
| **Finalité** | Permettre aux bénévoles de proposer et de rejoindre des événements sociaux internes au Club (afterworks, repas, sorties, formations) ; renforcer la cohésion du collectif bénévole |
| **Personnes concernées** | Bénévoles inscrits, majeurs uniquement (18 ans révolus selon Règlement Intérieur art. 1.1) |
| **Catégories de données** | Titre de l'événement, date, lieu (texte libre), description, catégorie, lien d'inscription externe (optionnel), photo de couverture (optionnelle), identité de l'organisateur (prénom + initiale du nom), marques d'intérêt des participants (booléen) |
| **Base légale** | Exécution d'un contrat (mission associative) — Art. 6.1.b RGPD ; Consentement explicite pour la publication de la photo de couverture — Art. 6.1.a RGPD (le bénévole choisit de l'uploader) |
| **Durée de conservation** | Événements à venir : actifs. Événements passés : 2 ans après la date de l'événement, puis archivage anonymisé pour statistiques. Photos de couverture : supprimées en même temps que l'événement. |
| **Destinataires internes** | Tous les bénévoles inscrits voient les événements `published` et `past`. Les événements `draft` sont visibles uniquement par leur organisateur et les pilotes. |
| **Sous-traitants** | Supabase (BDD + storage bucket public `events-covers`, Irlande UE) |
| **Sécurité** | Validation par un pilote avant publication (statut `draft` → `published`). Modération du contenu et des photos. Limite de 3 brouillons par bénévole. Signalement RGPD disponible. Photos de couverture stockées dans un bucket public mais avec policies RLS strictes (insert/update/delete authentifié uniquement). |

---

## Traitement n°6 — Boîte à idées et suggestions

| Champ | Description |
|---|---|
| **Finalité** | Permettre aux bénévoles de proposer des idées d'amélioration du Club et de l'application ; favoriser la participation et la démocratie associative |
| **Personnes concernées** | Bénévoles inscrits |
| **Catégories de données** | Texte libre de l'idée, catégorie, identité de l'auteur (prénom + initiale du nom), choix de visibilité (privé pilotes / visible par tous), statut de modération |
| **Base légale** | Intérêt légitime du Club — Art. 6.1.f RGPD (amélioration continue de l'organisation associative) |
| **Durée de conservation** | 2 ans à compter du dépôt, puis archivage anonymisé pour mémoire associative |
| **Destinataires internes** | Pilotes (toutes les idées, y compris privées). Autres bénévoles (uniquement les idées dont la visibilité publique a été cochée par l'auteur). |
| **Sous-traitants** | Supabase (Irlande UE) |
| **Sécurité** | Modération possible par un pilote (masquage, archivage). Possibilité de signalement par tout bénévole pour contenu inapproprié. RLS pour cloisonner la visibilité. |

---

## Traitement n°7 — Historique des consentements (table `consents`)

| Champ | Description |
|---|---|
| **Finalité** | Conserver la preuve juridique horodatée de chaque consentement donné ou retiré par le bénévole, conformément à l'article 7.1 RGPD ("Le responsable du traitement est en mesure de démontrer que la personne concernée a donné son consentement") |
| **Personnes concernées** | Tout bénévole ayant interagi avec un consentement (inscription, opt-in newsletter, demande d'export, demande de suppression, etc.) |
| **Catégories de données** | Email du bénévole (clé métier persistante au-delà d'une suppression de compte), type de consentement (`rgpd`, `reglement`, `photo`, `newsletter`, `data_export`, `deletion_request`, `deletion_cancelled`), version de la politique active, état (granted/revoked), horodatage, user-agent (optionnel), métadonnées contextuelles (JSON) |
| **Base légale** | Obligation légale de tenir une preuve du consentement — Art. 7.1 RGPD |
| **Durée de conservation** | 5 ans à compter de la dernière action enregistrée pour un bénévole donné (durée de prescription civile en matière contractuelle, art. 2224 Code civil). Les enregistrements sont conservés même après suppression du compte du bénévole, car ils constituent une preuve juridique du consentement à un instant T. |
| **Destinataires internes** | DPO (Didier CONJEAUD) et co-présidents en cas de demande CNIL, contentieux ou exercice du droit d'accès par le bénévole concerné |
| **Sous-traitants** | Supabase (Irlande UE) |
| **Sécurité** | Table en lecture seule pour le bénévole (RLS : `auth.email() = benevole_email`). Aucune policy UPDATE ni DELETE (immutabilité de l'audit). INSERT contraint à l'email authentifié. CHECK constraint sur les valeurs autorisées de `consent_type`. |

---
## Sous-traitants — vue consolidée

| Sous-traitant | Service rendu | Localisation des données | Garanties |
|---|---|---|---|
| Supabase | BDD + auth + stockage photos | Irlande (UE) | DPA RGPD-conforme, signé |
| Cloudflare | CDN + Workers (back-end Edge) | États-Unis | Clauses Contractuelles Types (CCT) UE |
| Make.com | Automatisation des flux | Tchéquie (UE) | DPA RGPD-conforme |
| Mailjet | Envoi d'emails | France (UE) | DPA RGPD-conforme |
| GitHub Pages | Hébergement statique buvette | États-Unis | CCT UE |
| Google (Apps Script / Sheets) | Backend buvette | UE | DPA RGPD-conforme |

> **À faire** : récupérer / archiver chaque DPA signé dans un dossier dédié (preuve à présenter en cas de contrôle CNIL).

---

## Mesures techniques et organisationnelles

- **Authentification** : magic link (Supabase Auth) — pas de mot de passe stocké côté Club.
- **Contrôle d'accès** : RLS (Row-Level Security) sur toutes les tables Supabase ; isolation par utilisateur ; rôles différenciés (bénévole, pilote, admin).
- **Stockage des photos** : bucket privé, accès uniquement via URL signée à durée de vie limitée.
- **Chiffrement** : HTTPS systématique (TLS 1.2+).
- **Sauvegardes** : sauvegardes automatiques quotidiennes côté Supabase.
- **Journalisation** : journaux d'accès aux fonctions Edge (Cloudflare).
- **Sensibilisation** : référent RGPD désigné ; sensibilisation des membres du bureau aux principes du RGPD.
- **Procédure d'incident** : en cas de violation de données, notification à la CNIL sous 72 h (art. 33 RGPD), et information des personnes concernées si risque élevé (art. 34).

---

## Droits des personnes

Toute personne concernée peut exercer les droits suivants en contactant le référent RGPD à `contact@spacerstoulouse.fr` :

- Droit d'accès (Art. 15 RGPD)
- Droit de rectification (Art. 16)
- Droit à l'effacement (Art. 17)
- Droit à la limitation (Art. 18)
- Droit à la portabilité (Art. 20)
- Droit d'opposition (Art. 21)
- Droit de retirer son consentement à tout moment (Art. 7§3)
- Droit d'introduire une réclamation auprès de la CNIL (https://www.cnil.fr)

Le Club s'engage à répondre sous **1 mois** maximum (Art. 12 RGPD).

---

## Mises à jour du registre

Ce registre doit être mis à jour à chaque :
- Ajout / suppression / modification d'un traitement
- Changement de sous-traitant
- Évolution majeure des mesures de sécurité

| Date | Version | Modification | Auteur |
|---|---|---|---|
| 03/05/2026 | 1.0 | Création initiale du registre | Didier CONJEAUD |
| 01/06/2026 | 1.1 | Ajout T5 Événements bénévoles, T6 Boîte à idées, T7 Historique des consentements | Didier CONJEAUD |
