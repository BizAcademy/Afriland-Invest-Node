# AFRILAND INVEST

Plateforme d'investissement pour l'Afrique de l'Ouest — React + Node.js

---

## Déploiement sur Plesk (via GitHub)

### Votre flux de travail

```
1. Modifier le code dans Replit
2. Pousser sur GitHub (vous-même)
3. Dans Plesk : Pull → Deploy Now → Restart
```

**Aucun build dans Plesk.** Le dossier `client/dist/` est pré-compilé et versionné dans le repo.

---

### Étape 1 — Configurer Node.js dans Plesk

Dans Plesk > votre domaine > **Node.js** :

| Paramètre | Valeur |
|---|---|
| Node.js version | 18 ou supérieur |
| Application root | `/` (racine du repo) |
| Application startup file | `server/index.js` |

---

### Étape 2 — Configurer Git dans Plesk

Dans Plesk > votre domaine > **Git** :

1. Ajoutez l'URL de votre dépôt GitHub
2. Dans **Additional deploy actions** (champ de script), mettez :
   ```
   npm install --omit=dev
   ```
   Cette commande installe uniquement les dépendances serveur, sans relancer le build du client.

---

### Étape 3 — Variables d'environnement dans Plesk

Dans Plesk > Node.js > **Environment Variables** (ou fichier `.env` à la racine), ajoutez :

```
SUPABASE_URL=https://XXXXXXXXXXXXXXXX.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...
JWT_SECRET=un_secret_tres_long_et_aleatoire_minimum_32_caracteres
SESSION_SECRET=un_autre_secret_long_et_aleatoire
PORT=3000
NODE_ENV=production
```

> Les valeurs Supabase se trouvent dans : Supabase > Settings > API

---

### Étape 4 — Premier déploiement

1. Cliquez **Pull** (récupère le code depuis GitHub)
2. Cliquez **Deploy Now** (exécute `npm install --omit=dev`)
3. Cliquez **Restart** (démarre `node server/index.js`)

L'application est en ligne.

---

### Étape 5 — Compte administrateur

Inscrivez-vous normalement sur l'application, puis dans Supabase SQL Editor :

```sql
UPDATE utilisateurs SET role = 'admin' WHERE telephone = 'VOTRE_NUMERO';
```

---

## Structure du projet

```
afriland-invest/
├── server/
│   ├── index.js           # Point d'entrée Express
│   ├── middleware/auth.js  # JWT middleware
│   └── routes/            # Routes API
├── client/
│   ├── src/               # Source React (modifiable)
│   └── dist/              # Build pré-compilé (servi par Express) ← commité dans git
├── uploads/               # Photos uploadées par les utilisateurs
├── .env.example           # Modèle de variables d'environnement
└── package.json           # Dépendances serveur
```

---

## Développement local

```bash
# 1. Copier les variables d'environnement
cp .env.example .env
# Remplir .env avec vos coordonnées Supabase

# 2. Installer les dépendances
npm install
cd client && npm install && cd ..

# 3. Lancer le serveur
npm start

# 4. Pour modifier le client (dans un second terminal)
cd client && npm run dev

# 5. Après modification du client, reconstruire avant de commiter
cd client && npm run build
```

---

## Chaque mise à jour Plesk

```
1. Modifier dans Replit → rebuild client si nécessaire (cd client && npm run build)
2. git add . && git commit && git push (depuis votre machine)
3. Plesk : Pull → Deploy Now → Restart
```
