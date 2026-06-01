# Registre des traitements de données personnelles

**Responsable de traitement** : TOAC-TUC VOLLEY-BALL
**Adresse** : Palais des Sports André Brouat, 3 rue Pierre Laplace, 31000 Toulouse
**Co-présidents** : Eric MAUGARD et Didier CONJEAUD
**Référent RGPD** : Didier CONJEAUD — contact@spacerstoulouse.fr
**Date du registre** : 3 mai 2026
**Version** : 1.0

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
