# Mise à jour du Registre des Traitements — v1.1

**Modifications par rapport à v1.0 (3 mai 2026)** :
Ajout des traitements T5 (Événements bénévoles), T6 (Boîte à idées) et T7 (Historique des consentements) suite à la livraison de ces modules en mai-juin 2026.

---

## À intégrer dans `docs/rgpd/registre-traitements.md`

### Modifications à apporter à l'en-tête

```diff
- **Date du registre** : 3 mai 2026
- **Version** : 1.0
+ **Date du registre** : 1er juin 2026
+ **Version** : 1.1
```

### Ajouter à la fin du tableau "Mises à jour du registre"

```markdown
| 01/06/2026 | 1.1 | Ajout T5 Événements bénévoles, T6 Boîte à idées, T7 Historique des consentements | Didier CONJEAUD |
```

### Ajouter ces 3 nouveaux traitements (à insérer juste avant la section "Sous-traitants — vue consolidée")

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
