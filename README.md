# Spacers Bénévoles - Application Web

Application web de gestion des bénévoles pour le club de volleyball Spacers Toulouse.

## 🚀 Fonctionnalités

- **Authentification Supabase** : Connexion sécurisée des bénévoles
- **Gestion des disponibilités** : Indiquer sa présence pour les matchs
- **Suivi des points et badges** : Système de gamification
- **Planning des matchs** : Vue détaillée des événements
- **Espace profil** : Informations personnelles et statistiques
- **Boutique** : Achats d'équipements et goodies
- **Communauté** : Forum et échanges entre bénévoles

## 🔧 Configuration Supabase

### 1. Créer un projet Supabase

1. Allez sur [supabase.com](https://supabase.com)
2. Créez un nouveau projet
3. Notez votre URL de projet et votre clé anon

### 2. Configurer l'authentification

1. Dans votre dashboard Supabase, allez dans `Authentication` > `Settings`
2. Configurez les paramètres selon vos besoins :
   - Activez l'inscription par email
   - Configurez les URLs de redirection
   - Personnalisez les emails de confirmation

### 3. Mettre à jour la configuration

1. Ouvrez le fichier `config.js`
2. Remplacez les valeurs par vos vraies clés Supabase :

```javascript
const SUPABASE_CONFIG = {
  url: 'https://votre-projet.supabase.co',
  anonKey: 'votre-clé-anon-secrete'
};
```

### 4. Créer la table des utilisateurs (optionnel)

Pour stocker les informations supplémentaires des bénévoles :

```sql
CREATE TABLE benevoles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  nom TEXT,
  prenom TEXT,
  telephone TEXT,
  taille_tshirt TEXT,
  ville TEXT,
  points INTEGER DEFAULT 0,
  niveau TEXT DEFAULT 'Bronze',
  date_inscription TIMESTAMP DEFAULT NOW()
);

-- Activer les politiques RLS
ALTER TABLE benevoles ENABLE ROW LEVEL SECURITY;

-- Politique pour que les utilisateurs voient leur propre profil
CREATE POLICY "Les utilisateurs peuvent voir leur propre profil"
  ON benevoles FOR SELECT
  USING (auth.uid() = id);

-- Politique pour que les utilisateurs mettent à jour leur propre profil
CREATE POLICY "Les utilisateurs peuvent mettre à jour leur propre profil"
  ON benevoles FOR UPDATE
  USING (auth.uid() = id);

-- Politique pour l'insertion lors de l'inscription
CREATE POLICY "Les utilisateurs peuvent insérer leur profil"
  ON benevoles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

## 🌐 Lancement de l'application

1. Clonez le repository
2. Configurez Supabase comme décrit ci-dessus
3. Ouvrez `index.html` dans votre navigateur
4. Testez la connexion avec un compte utilisateur

## 📱 Utilisation

### Connexion
1. Entrez votre email et mot de passe
2. Cliquez sur "Se connecter"
3. Vous serez redirigé vers l'accueil

### Mot de passe oublié
1. Cliquez sur "Mot de passe oublié ?"
2. Entrez votre email
3. Suivez le lien reçu par email

### Déconnexion
1. Allez dans l'onglet "Profil"
2. Cliquez sur l'onglet "Infos"
3. Cliquez sur "Se déconnecter"

## 🔒 Sécurité

- Les mots de passe sont hashés par Supabase
- Les sessions sont gérées automatiquement
- Les clés API sont configurées en lecture seule
- Les politiques RLS protègent les données utilisateurs

## 🐛 Dépannage

### Erreur de connexion
- Vérifiez vos identifiants Supabase dans `config.js`
- Assurez-vous que l'utilisateur existe dans Supabase Auth

### Problème de redirection
- Vérifiez les URLs de redirection dans les paramètres Supabase
- Assurez-vous que le domaine est autorisé

### Session non persistante
- Vérifiez que les cookies sont activés dans votre navigateur
- Nettoyez le cache et les cookies du navigateur

## 📞 Support

Pour toute question technique sur l'authentification Supabase :
- Documentation : [supabase.com/docs](https://supabase.com/docs)
- Support : [supabase.com/support](https://supabase.com/support)

---

**Développé pour Spacers Toulouse Volley - Saison 2026-2027**