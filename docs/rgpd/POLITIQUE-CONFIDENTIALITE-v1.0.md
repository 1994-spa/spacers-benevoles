# Politique de confidentialité — Spacers Bénévoles

**Version : 1.0**
**Date d'entrée en vigueur : 2 juin 2026**
**Dernière mise à jour : 2 juin 2026**

---

## 1. Préambule

La présente politique de confidentialité décrit la manière dont l'association **TOAC-TUC Volley-Ball (Spacers Toulouse)**, en sa qualité de responsable de traitement, collecte, utilise, conserve et protège les données personnelles des bénévoles utilisateurs de la plateforme **Spacers Bénévoles** accessible à l'adresse `https://benevoles.spacerstoulouse.fr`.

Elle est rédigée conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679) et à la Loi Informatique et Libertés modifiée.

---

## 2. Responsable du traitement

**TOAC-TUC Volley-Ball (Spacers Toulouse)**
Adresse : Palais des Sports André Brouat, 3 rue Pierre Laplace, 31000 Toulouse
Email : `contact@spacerstoulouse.fr`

**Délégué à la protection des données (DPO)**
Didier CONJEAUD
Email : contact@spacerstoulouse.fr

---

## 3. Données personnelles collectées

### 3.1. Données d'identification

- Prénom, nom
- Adresse email
- Numéro de téléphone (facultatif)
- Photo de profil (facultatif)
- Date d'inscription

### 3.2. Données d'activité bénévole

- Profil bénévole (Découverte / Compétiteur / Expérimenté)
- Disponibilités déclarées pour les matchs
- Postes occupés
- Historique des matchs (nombre, points, badges)
- Suggestions et idées partagées
- Inscriptions aux événements bénévoles
- Photos uploadées dans la galerie post-événements
- Signalements de contenu

### 3.3. Données de parrainage

- Statut de référent
- Lien de parrainage (qui parraine qui)

### 3.4. Données de consentement

Conformément à l'article 7 du RGPD, chaque consentement est journalisé de manière granulaire, horodatée et immuable, avec :
- Type de consentement
- État (accordé / retiré)
- Version de la politique au moment du consentement
- Date et heure
- User-agent (audit)

### 3.5. Données techniques

- Adresse IP (logs serveurs uniquement, non liées aux profils)
- User-agent (lors des consentements)

**La plateforme n'utilise pas de cookies de traçage à des fins publicitaires ni d'outils d'analyse tiers.**

---

## 4. Finalités et bases légales du traitement

| Finalité | Base légale RGPD |
|---|---|
| Gestion du compte bénévole | Exécution d'une mission d'intérêt légitime de l'association |
| Organisation des matchs et événements | Exécution d'une mission d'intérêt légitime de l'association |
| Envoi de notifications transactionnelles (inscriptions matchs, affectations, rappels) | Exécution d'une mission d'intérêt légitime |
| Envoi de newsletter et communications non-essentielles | Consentement (article 6.1.a RGPD) — opt-in granulaire |
| Affichage de la photo de profil dans la galerie ou la communauté | Consentement (article 6.1.a RGPD) — opt-in granulaire |
| Affichage de l'anniversaire (si implémenté) | Consentement (article 6.1.a RGPD) — opt-in granulaire |
| Tenue du registre de consentements | Obligation légale (article 7.1 RGPD) |

---

## 5. Destinataires des données

Les données sont accessibles uniquement :

- Au bénévole concerné (pour ses propres données)
- Aux **pilotes** et **administrateurs** de l'association désignés par TOAC-TUC, dans la limite de leurs missions
- Au DPO en cas de demande d'audit ou d'exercice des droits
- Aux sous-traitants techniques (cf. section 6)

**Aucune donnée n'est revendue à des tiers ni utilisée à des fins commerciales.**

---

## 6. Sous-traitants et transferts hors UE

| Sous-traitant | Service | Région des données | DPA signé |
|---|---|---|---|
| **Supabase** | Base de données, authentification, stockage de fichiers, edge functions | Allemagne (Frankfurt) — UE | Oui (cf. registre interne) |
| **Cloudflare** | Hébergement (Workers), CDN | Monde (configuration EU-only pour les données utilisateur) | Oui |
| **Mailjet** | Envoi d'emails transactionnels | France — UE | Oui |
| **Make.com** | Automatisations (emails de bienvenue) | UE | Oui |
| **Google Forms** | Formulaires d'inscription (rétrocompatibilité) | États-Unis — **transfert hors UE** | Clauses contractuelles types — voir alerte ci-dessous |

⚠️ **Note sur Google Forms** : un audit interne a identifié un risque de transfert hors UE concernant les formulaires Google. Une migration vers une solution native Supabase est planifiée pour résoudre cette dépendance. En attendant, les formulaires Google ne collectent que des données strictement nécessaires à l'inscription.

---

## 7. Durées de conservation

| Type de donnée | Durée |
|---|---|
| Compte bénévole actif | Tant que le compte est actif |
| Compte supprimé (anonymisation) | Suppression réversible 30 jours, puis anonymisation immédiate des données personnelles via processus automatisé |
| Photos de profil de comptes supprimés | Suppression immédiate via processus automatisé (cron quotidien) |
| Photos d'événements signalées | Conservées en archive pour audit (anonymisées si nécessaire) |
| Registre de consentements | 5 ans après le retrait du consentement (obligation légale de preuve) |
| Logs techniques | 12 mois |
| Newsletter et emails marketing | Tant que le consentement est actif, supprimés au retrait |

---

## 8. Droits des bénévoles

Conformément aux articles 15 à 22 du RGPD, chaque bénévole dispose des droits suivants :

### 8.1. Droit d'accès et de portabilité
Téléchargement complet des données personnelles au format JSON ou PDF depuis l'espace personnel (`Mon profil` → `Exporter mes données`).

### 8.2. Droit de rectification
Modification des données directement depuis l'espace `Mon profil`.

### 8.3. Droit à l'effacement ("droit à l'oubli")
Suppression du compte depuis `Mon profil`. La suppression est réversible pendant 30 jours (option de réactivation), puis effective et irréversible (anonymisation des données et suppression des fichiers personnels).

### 8.4. Droit de limitation et d'opposition
Possibilité de retirer chaque consentement individuellement depuis `Mes consentements`. Le retrait d'un consentement non-essentiel n'affecte pas l'usage de la plateforme.

### 8.5. Droit de retirer son consentement
Le retrait est aussi simple à effectuer que le consentement initial, à tout moment et sans justification.

### 8.6. Droit de réclamation
En cas de désaccord ou de difficulté, le bénévole peut adresser sa réclamation :
1. Directement au DPO (Didier CONJEAUD)
2. À la **CNIL** : `https://www.cnil.fr` — 3 place de Fontenoy, 75007 Paris

---

## 9. Sécurité des données

L'association met en œuvre les mesures techniques et organisationnelles suivantes :

- **Chiffrement** : toutes les communications utilisent HTTPS/TLS. Les mots de passe sont hashés (bcrypt via Supabase Auth).
- **Authentification** : système de session sécurisé via Supabase Auth.
- **Contrôle d'accès** : politiques `Row Level Security` PostgreSQL filtrant chaque requête par utilisateur connecté.
- **Hébergement européen** : base de données et fichiers stockés en Allemagne (région UE Supabase).
- **Sauvegardes** : sauvegardes quotidiennes automatiques par l'hébergeur.
- **Journal d'audit** : table immuable de consentements (append-only, jamais d'UPDATE/DELETE).

---

## 10. Procédure en cas de violation de données

En cas de violation de données à caractère personnel :

1. Notification à la **CNIL dans les 72 heures** suivant la prise de connaissance
2. Notification individuelle aux bénévoles concernés si le risque est élevé
3. Documentation interne de l'incident, des mesures prises et des leçons tirées

La procédure détaillée est documentée dans un registre interne tenu à disposition du DPO.

---

## 11. Modifications de la présente politique

Cette politique peut être mise à jour pour refléter les évolutions de la plateforme ou de la réglementation. Toute modification substantielle fera l'objet :

- D'un **incrément de version** (v1.0 → v1.1 ou v2.0)
- D'une **notification** aux bénévoles
- D'un **archivage** des versions antérieures dans le registre interne

Les bénévoles seront invités à renouveler leur consentement en cas de modification substantielle.

---

## 12. Contact

Pour toute question relative à cette politique ou à vos données personnelles :

- **Par email** : `contact@spacerstoulouse.fr`
- **Au DPO** : Didier CONJEAUD — contact@spacerstoulouse.fr
- **CNIL** : `https://www.cnil.fr`

---

## Historique des versions

| Version | Date | Modifications |
|---|---|---|
| **1.0** | 2 juin 2026 | Première version de la politique de confidentialité |

---

*Document généré et versionné dans le repository git du projet `spacers-benevoles` (chemin : `docs/rgpd/POLITIQUE-CONFIDENTIALITE-v1.0.md`).*
