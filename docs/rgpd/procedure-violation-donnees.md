# Procédure de notification de violation de données personnelles

**Responsable du traitement** : TOAC-TUC VOLLEY-BALL
**Adresse** : Palais des Sports André Brouat, 3 rue Pierre Laplace, 31000 Toulouse
**Co-présidents** : Eric MAUGARD et Didier CONJEAUD
**Référent RGPD** : Didier CONJEAUD — contact@spacerstoulouse.fr
**Date** : 1er juin 2026
**Version** : 1.0

**Conforme aux articles 33 et 34 du RGPD.**

---

## Préambule

L'article 4.12 du RGPD définit une violation de données personnelles comme « *une violation de la sécurité entraînant, de manière accidentelle ou illicite, la destruction, la perte, l'altération, la divulgation non autorisée de données à caractère personnel transmises, conservées ou traitées d'une autre manière, ou l'accès non autorisé à de telles données* ».

Cette procédure s'applique à tout incident susceptible d'affecter la confidentialité, l'intégrité ou la disponibilité des données personnelles traitées par TOAC-TUC VOLLEY-BALL dans le cadre de ses applications numériques (application bénévoles, application buvette).

### Exemples concrets de violations possibles

- Compromission de la base Supabase (accès non autorisé, fuite de données)
- Perte ou vol d'un appareil contenant des identifiants administrateurs
- Exposition involontaire de secrets dans un commit Git public (clés API, tokens)
- Bug dans l'application exposant des données entre comptes
- Erreur humaine (envoi d'un email à la mauvaise liste, fichier partagé par erreur)
- Phishing réussi sur un compte pilote ou administrateur
- Compromission d'un service de sous-traitance (Supabase, Mailjet, Cloudflare, Make.com)
- Perte définitive de données (destruction accidentelle d'une sauvegarde)

---

## Étape 1 — Détection et signalement (T+0)

### Qui signale ?

Toute personne (bénévole, pilote, administrateur, sous-traitant) qui découvre ou suspecte une violation **doit immédiatement** :

1. Envoyer un email à **contact@spacerstoulouse.fr** avec en objet `[URGENT RGPD] Violation suspectée — [date]`
2. Inclure dans l'email :
   - Date et heure de la découverte
   - Nature présumée (technique / humaine / sous-traitant)
   - Données potentiellement affectées
   - Actions déjà entreprises
3. Ne **pas** tenter de « corriger » seul l'incident si l'on n'est pas le responsable technique : risque de destruction de preuves utiles à l'analyse forensique

### Qui reçoit l'alerte ?

| Acteur | Coordonnées |
|---|---|
| Référent RGPD | Didier CONJEAUD — contact@spacerstoulouse.fr |
| Co-présidents | Eric MAUGARD et Didier CONJEAUD — contact@spacerstoulouse.fr |
| Responsable technique | *[À COMPLÉTER : nom et email du dev référent]* |

---

## Étape 2 — Évaluation (T+0 à T+24 h)

Le référent RGPD, en lien avec le responsable technique, doit qualifier la violation selon la grille suivante :

### Grille d'évaluation du risque

| Critère | Faible | Moyen | Élevé |
|---|---|---|---|
| Nature des données | Déjà publiques (prénom seul) | Email, téléphone, préférences | Photo identifiante, identifiants de connexion, mot de passe même haché, données de santé |
| Nombre de personnes | < 10 | 10 à 100 | > 100 |
| Réversibilité | Restaurables intégralement | Difficiles à restaurer | Pertes définitives |
| Risque d'usurpation | Aucun | Théorique | Avéré (credentials en clair exposés) |
| Notoriété de la fuite | Aucune | Cercle restreint | Public / médias |

### Conclusion de l'évaluation

- **Risque négligeable pour les droits et libertés** → journalisation interne uniquement (étape 5)
- **Risque pour les droits et libertés** → notification CNIL obligatoire (étape 3) + journalisation
- **Risque élevé pour les droits et libertés** → notification CNIL + notification des personnes (étape 4) + journalisation

---

## Étape 3 — Notification à la CNIL (T+72 h maximum)

### Délai

**Obligatoire dans les 72 heures** suivant la prise de connaissance de la violation (Art. 33 RGPD), sauf si le risque pour les droits et libertés est négligeable. En cas de dépassement, joindre une justification motivée à la notification.

### Modalité

Téléservice CNIL : [https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles](https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles)

### Informations à fournir

- Nature de la violation
- Catégories et nombre approximatif de personnes concernées
- Catégories et nombre approximatif d'enregistrements concernés
- Conséquences probables de la violation
- Mesures prises ou envisagées pour y remédier et atténuer ses conséquences
- Coordonnées du référent RGPD

---

## Étape 4 — Notification des personnes concernées (si risque élevé)

### Quand notifier ?

Si la violation est **susceptible d'engendrer un risque élevé** pour les droits et libertés des personnes concernées (Art. 34 RGPD).

### Modalités

- **Email individuel** à chaque personne concernée depuis `contact@spacerstoulouse.fr`
- **Communication publique transparente** via les canaux du Club (site, réseaux sociaux) si le nombre de personnes est tel qu'une notification individuelle exige un effort disproportionné

### Contenu obligatoire de la notification

1. Description en termes clairs et simples de la nature de la violation
2. Nom et coordonnées du référent RGPD (Didier CONJEAUD — contact@spacerstoulouse.fr)
3. Conséquences probables de la violation
4. Mesures prises ou envisagées pour y remédier
5. Recommandations pour atténuer les effets côté personne (ex : changement de mot de passe, vigilance phishing)

### Exemptions de notification (Art. 34.3 RGPD)

Pas de notification individuelle obligatoire si :
- Les données concernées étaient chiffrées de manière incompréhensible (ex : credentials hachés)
- Le responsable a pris des mesures rendant le risque « improbable »
- La notification exigerait des efforts disproportionnés (alors communication publique)

---

## Étape 5 — Journalisation interne (registre des violations)

**Toute violation, même sans notification CNIL, doit être documentée** dans le registre interne `docs/rgpd/violations-log.md` (à créer si absent).

### Format minimum

```
## Violation [YYYY-MM-DD-XXX]
- Date de découverte :
- Date de l'incident (estimée) :
- Description :
- Données affectées :
- Personnes affectées (nombre, catégories) :
- Causes identifiées :
- Actions correctives prises :
- Notification CNIL : Oui / Non (date si oui)
- Notification des personnes : Oui / Non (date si oui)
- Référent RGPD en charge :
- Statut : En cours / Résolu
```

---

## Annexe — Contacts urgents

| Acteur | Contact | Disponibilité |
|---|---|---|
| Référent RGPD | Didier CONJEAUD — contact@spacerstoulouse.fr | *[À COMPLÉTER : disponibilité usuelle]* |
| Responsable technique | *[À COMPLÉTER]* | *[À COMPLÉTER]* |
| Co-présidents | Eric MAUGARD, Didier CONJEAUD — contact@spacerstoulouse.fr | *[À COMPLÉTER]* |
| Téléservice CNIL | [www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles](https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles) | 24/7 (formulaire) |
| Support Supabase | [supabase.com/support](https://supabase.com/support) | Selon plan |
| Support Cloudflare | [cloudflare.com/support](https://www.cloudflare.com/support/) | Selon plan |

---

## Mises à jour de la procédure

| Date | Version | Modification | Auteur |
|---|---|---|---|
| 01/06/2026 | 1.0 | Création initiale de la procédure | Didier CONJEAUD |
