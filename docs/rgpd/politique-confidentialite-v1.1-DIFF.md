# Mise à jour de la Politique de confidentialité — v1.0 → v1.1

Ce document fournit les **modifications à intégrer** dans `public/confidentialite.html` pour refléter les nouveaux modules ajoutés depuis le 3 mai 2026 (Événements bénévoles, Boîte à idées).

---

## 1. Bump de version

### Avant
```html
<p class="meta">Dernière mise à jour : 3 mai 2026 — Version 1.0</p>
```

### Après
```html
<p class="meta">Dernière mise à jour : 1er juin 2026 — Version 1.1</p>
```

---

## 2. Section 3.1 — Ajouter des lignes au tableau « Application bénévoles »

Insérer ces nouvelles lignes **après la ligne « Préférences (poste, disponibilités) »** dans le tableau de la section 3.1 :

```html
<tr>
  <td>Événements proposés (titre, date, lieu, description, photo de couverture optionnelle)</td>
  <td>Permettre aux bénévoles de proposer et rejoindre des événements sociaux internes au Club</td>
  <td>Exécution du contrat / Intérêt légitime (cohésion associative). Consentement explicite pour la photo de couverture (chargement volontaire).</td>
</tr>
<tr>
  <td>Marques d'intérêt aux événements</td>
  <td>Estimer la participation à chaque événement pour aider l'organisateur</td>
  <td>Intérêt légitime</td>
</tr>
<tr>
  <td>Idées et suggestions (texte, catégorie, choix de visibilité)</td>
  <td>Permettre aux bénévoles de proposer des améliorations au Club et à l'application</td>
  <td>Intérêt légitime (amélioration continue de l'organisation)</td>
</tr>
<tr>
  <td>Historique des consentements (table audit `consents`)</td>
  <td>Conserver la preuve juridique horodatée des consentements donnés ou retirés (Art. 7.1 RGPD)</td>
  <td>Obligation légale</td>
</tr>
```

---

## 3. Section 4 — Ajouter des lignes au tableau des durées de conservation

Insérer ces lignes **avant la ligne « Données comptables (transactions buvette) »** :

```html
<tr>
  <td>Événements bénévoles (titre, date, etc.)</td>
  <td>2 ans après la date de l'événement, puis archivage anonymisé</td>
</tr>
<tr>
  <td>Photos de couverture d'événements</td>
  <td>Supprimées en même temps que l'événement (max 2 ans)</td>
</tr>
<tr>
  <td>Idées et suggestions</td>
  <td>2 ans à compter du dépôt, puis archivage anonymisé</td>
</tr>
<tr>
  <td>Historique des consentements</td>
  <td>5 ans après la dernière action enregistrée (prescription civile, art. 2224 Code civil)</td>
</tr>
```

---

## 4. Section 7 — Compléter les mesures de sécurité

Dans la liste `<ul>` de la section 7, ajouter ces puces (avant « Procédure de notification d'incident sous 72 h ») :

```html
<li>Modération a priori des événements bénévoles par un pilote avant publication (validation par un humain) ;</li>
<li>Possibilité de signalement RGPD par tout bénévole sur les contenus inappropriés (idées, photos d'événement) ;</li>
<li>Audit immuable des consentements dans la table <code>consents</code> (RLS lecture/écriture restreintes à l'email authentifié, aucune policy UPDATE/DELETE) ;</li>
```

---

## 5. Nouvelle section 8 — Mineurs (révision)

**Important** : ta politique actuelle dit "Inscription réservée aux 15 ans et plus" alors que ton **règlement intérieur** dit "réservé aux personnes majeures (18 ans révolus)". Il y a une discordance entre les 2 docs.

À harmoniser :
- **Option A (recommandée car correspond au règlement)** : Toute la section 8 indique 18+ et tu supprimes la partie sur les 15-17 ans
- **Option B** : Le règlement intérieur est mis à jour pour autoriser les 15-17 avec accord parental

Si Option A, remplacer la section 8 par :

```html
<h2>8. Politique relative aux mineurs</h2>
<div class="callout">
  <strong>Inscription réservée aux personnes majeures (18 ans révolus).</strong> Conformément à notre règlement intérieur, le bénévolat au sein du Club est ouvert aux personnes majeures uniquement. Une vérification déclarative de l'âge (date de naissance) est demandée à l'inscription.
</div>
<p>Si vous êtes parent ou tuteur d'un mineur inscrit par erreur, contactez-nous à <a href="mailto:contact@spacerstoulouse.fr">contact@spacerstoulouse.fr</a> pour suppression immédiate du compte.</p>
```

---

## 6. Nouvelle section 11 — Modifications de la présente politique (à compléter)

Ta section actuelle dit "Toute modification substantielle vous sera notifiée par email et/ou via une bannière dans l'application au moins 15 jours avant son entrée en vigueur."

Compléter avec le mécanisme technique (le `consent_version` est tracé dans la table `consents`) :

Ajouter cette phrase à la fin de la section 11 :
```html
<p>Lors d'une mise à jour substantielle, vous serez invité à ré-accepter la nouvelle version de la politique lors de votre prochaine connexion. La version acceptée est tracée dans la table d'audit <code>consents</code> avec horodatage, conformément à l'article 7.1 du RGPD.</p>
```

---

## 7. Pied de page (optionnel)

Si tu veux versionner proprement, ajouter en fin de body :

```html
<hr>
<p class="meta" style="text-align:center;">
  Politique v1.1 — Modifications : ajout des modules Événements bénévoles, Boîte à idées et tracking d'audit des consentements (Art. 7.1 RGPD).
  Version précédente : <a href="/confidentialite-v1.0.html">v1.0 (3 mai 2026)</a>
</p>
```

(Tu peux archiver l'ancienne version comme `confidentialite-v1.0.html` pour la traçabilité.)
