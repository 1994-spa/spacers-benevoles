# Récapitulatif des Data Processing Agreements (DPAs)

**Responsable du traitement** : TOAC-TUC VOLLEY-BALL
**Adresse** : Palais des Sports André Brouat, 3 rue Pierre Laplace, 31000 Toulouse
**Référent RGPD** : Didier CONJEAUD — contact@spacerstoulouse.fr
**Date de mise à jour** : 2 juin 2026
**Version** : 1.0

---

## Préambule

Ce document recense les **Data Processing Agreements (DPAs)** conclus entre TOAC-TUC VOLLEY-BALL et ses sous-traitants techniques, conformément à l'**article 28 du RGPD** qui impose au responsable du traitement de n'utiliser que des sous-traitants présentant des garanties suffisantes en matière de protection des données.

Pour chaque sous-traitant figurent :
- Le service utilisé
- Les types de données traitées
- La localisation des serveurs
- Le statut de signature du DPA
- Le mécanisme de transfert hors UE le cas échéant (Clauses Contractuelles Types — CCT, Data Privacy Framework — DPF)

Ce registre est tenu à jour par le référent RGPD.

---

## Tableau récapitulatif

| Sous-traitant | Service | Localisation | DPA signé | Mécanisme transfert hors UE |
|---|---|---|---|---|
| **Supabase** | BDD PostgreSQL, authentification, stockage de fichiers, Edge Functions, cron jobs | Frankfurt (Allemagne) — **UE** | ⏳ À confirmer | N/A (UE) |
| **Cloudflare** | Hébergement Workers, CDN, DNS | US (siège) / config Europe-only | ⏳ À confirmer | CCT + DPF |
| **Mailjet** | Envoi d'emails transactionnels (Sinch France) | France — **UE** | ⏳ À confirmer | N/A (UE) |
| **Make.com** | Automatisations (welcome emails) | République Tchèque — **UE** | ⏳ À confirmer | N/A (UE) |
| **Google Forms** | Formulaires d'inscription (legacy) | US | ⏳ À confirmer | CCT + DPF |
| **GitHub** | Hébergement du code source (repo `1994-spa/spacers-benevoles`) | US | ⏳ À confirmer | CCT + DPF |

**Légende du statut** :
- ✅ Signé : DPA accepté/signé, date documentée
- ⏳ À confirmer : statut à vérifier dans la console d'admin du service
- ❌ Non signé : DPA non encore activé (action requise)

---

## Fiches détaillées

### Supabase

| Champ | Information |
|---|---|
| **Service utilisé** | Base de données PostgreSQL (projet `xphuolvbamdkizydveij`), authentification, stockage de fichiers (buckets `photos`, `events-covers`, `events-photos`), Edge Functions, pg_cron, Database Webhooks |
| **Types de données traitées** | Identité (nom, prénom, email, téléphone, date de naissance), photos d'accréditation, photos d'événements, historique d'engagement, consentements, événements proposés, idées et suggestions |
| **Localisation des serveurs** | Frankfurt, Allemagne (région UE) |
| **DPA officiel** | https://supabase.com/legal/dpa |
| **Statut signature** | ⏳ À vérifier dans console Supabase → Project Settings → Legal / Compliance |
| **Sous-traitants ultérieurs** | AWS (Allemagne), Cloudflare (CDN) |
| **Garanties contractuelles** | DPA conforme art. 28 RGPD, certification SOC 2 Type II, HIPAA, ISO 27001 |
| **Mécanisme de transfert hors UE** | N/A (données traitées exclusivement en UE) |
| **Date de référence** | À compléter lors de la vérification |

---

### Cloudflare

| Champ | Information |
|---|---|
| **Service utilisé** | Hébergement Cloudflare Workers (auto-deploy sur push GitHub), CDN, DNS, Workers Email Worker (`spacers-emails.spacersytb.workers.dev`) |
| **Types de données traitées** | Aucune donnée personnelle stockée durablement — Cloudflare agit en proxy/edge cache. Logs techniques (IP, user-agent) conservés selon la politique Cloudflare |
| **Localisation des serveurs** | Distribué globalement. Pour les données utilisateur sensibles, configuration **EU-only** activée (Cloudflare Data Localization Suite) |
| **DPA officiel** | https://www.cloudflare.com/cloudflare-customer-dpa/ |
| **Statut signature** | ⏳ À vérifier dans Cloudflare Dashboard → Privacy & Compliance |
| **Sous-traitants ultérieurs** | Liste détaillée dans le DPA |
| **Garanties contractuelles** | DPA conforme art. 28 RGPD, certification ISO 27001, SOC 2, certification PCI DSS |
| **Mécanisme de transfert hors UE** | Clauses Contractuelles Types (décision Commission UE 2021/914) + Data Privacy Framework (DPF) UE-US |
| **Date de référence** | À compléter |

---

### Mailjet (Sinch France)

| Champ | Information |
|---|---|
| **Service utilisé** | Envoi d'emails transactionnels via API v3.1 (inscriptions matchs, affectations postes, cancellations, rappels J-15/J-10/J-5/J-3) |
| **Types de données traitées** | Email du bénévole, contenu de l'email (nom, prénom, données du match), métadonnées d'envoi |
| **Localisation des serveurs** | France (UE) |
| **DPA officiel** | https://www.mailjet.com/legal/dpa/ |
| **Statut signature** | ⏳ À vérifier dans Mailjet Account → Privacy Center |
| **Sous-traitants ultérieurs** | Pas de transfert hors UE |
| **Garanties contractuelles** | DPA conforme art. 28 RGPD, certification ISO 27001, hébergement français |
| **Mécanisme de transfert hors UE** | N/A (données traitées exclusivement en France) |
| **Date de référence** | À compléter |

---

### Make.com (Celonis)

| Champ | Information |
|---|---|
| **Service utilisé** | Automatisations no-code : envoi d'emails de bienvenue après inscription bénévole. Migration vers Cloudflare Worker planifiée |
| **Types de données traitées** | Email, prénom, nom du bénévole (uniquement les données minimales nécessaires à l'envoi de l'email) |
| **Localisation des serveurs** | République Tchèque (UE) |
| **DPA officiel** | https://www.make.com/en/legal/dpa |
| **Statut signature** | ⏳ À vérifier dans Make.com → Organization Settings → Compliance |
| **Sous-traitants ultérieurs** | Documentés dans le DPA |
| **Garanties contractuelles** | DPA conforme art. 28 RGPD, certification ISO 27001 |
| **Mécanisme de transfert hors UE** | N/A (UE) |
| **Date de référence** | À compléter |
| **Notes** | ⚠️ Une migration vers Cloudflare Worker (email transactionnel maison) est planifiée. À terme, ce sous-traitant pourra être retiré. |

---

### Google Forms (legacy)

| Champ | Information |
|---|---|
| **Service utilisé** | Formulaires Google pour les inscriptions initiales (avant migration vers solution native Supabase) |
| **Types de données traitées** | Réponses au formulaire d'inscription (identité, contact, préférences) |
| **Localisation des serveurs** | États-Unis (Google Cloud) |
| **DPA officiel** | https://workspace.google.com/intl/en/terms/dpa_terms.html |
| **Statut signature** | ⏳ À vérifier dans Google Workspace Admin Console → Security → Data Processing Amendment |
| **Sous-traitants ultérieurs** | Liste publique Google |
| **Garanties contractuelles** | DPA Google Workspace standard, certifications nombreuses (ISO 27001, SOC 2, etc.) |
| **Mécanisme de transfert hors UE** | Clauses Contractuelles Types + Data Privacy Framework (DPF) UE-US |
| **Date de référence** | À compléter |
| **Notes** | ⚠️ **Action prioritaire** : migrer les formulaires d'inscription vers une solution native Supabase pour éviter ce transfert hors UE. Document gap déjà identifié dans la roadmap. |

---

### GitHub (Microsoft)

| Champ | Information |
|---|---|
| **Service utilisé** | Hébergement du code source du projet (`1994-spa/spacers-benevoles`). Pas de données personnelles d'utilisateurs hébergées sur GitHub. |
| **Types de données traitées** | Code source uniquement. Métadonnées de commits (identité du développeur uniquement). **Aucune donnée personnelle des bénévoles n'est stockée sur GitHub.** |
| **Localisation des serveurs** | États-Unis |
| **DPA officiel** | https://github.com/customer-terms/data-protection-agreement |
| **Statut signature** | ⏳ À vérifier dans GitHub → Account Settings → Privacy |
| **Sous-traitants ultérieurs** | Microsoft Azure |
| **Garanties contractuelles** | DPA Microsoft/GitHub, certifications ISO 27001, SOC 2, FedRAMP |
| **Mécanisme de transfert hors UE** | Clauses Contractuelles Types + Data Privacy Framework (DPF) UE-US |
| **Date de référence** | À compléter |
| **Notes** | Le repository peut être rendu privé si besoin (actuellement public). Aucune donnée personnelle des bénévoles n'est en effet stockée sur GitHub : la BDD est sur Supabase. |

---

## Actions à mener

Pour chaque sous-traitant :

1. **Se connecter à la console d'administration** du service
2. **Localiser la section Privacy/Compliance/DPA**
3. **Accepter / signer le DPA** (souvent en un clic — case à cocher)
4. **Documenter la date de signature** dans ce registre
5. **Archiver** une copie du DPA signé dans le dossier `docs/rgpd/dpas-signed/` (à créer)

Cible : tous les DPAs signés et documentés avant la fin du trimestre.

---

## Historique des versions

| Date | Version | Modifications | Responsable |
|---|---|---|---|
| 02/06/2026 | 1.0 | Création du registre récapitulatif des DPAs | Didier CONJEAUD |

---

*Document maintenu dans le repository git du projet `spacers-benevoles` (chemin : `docs/rgpd/dpas-recap.md`).*
