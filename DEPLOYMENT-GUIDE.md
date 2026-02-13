# 🚀 Guide de Déploiement - Undercover Game

## 📋 Vue d'Ensemble

Votre application est composée de **3 parties** :
1. **Client** (Frontend React) → À déployer sur **Vercel** ou **Netlify**
2. **Server** (Backend Socket.IO) → À déployer sur **Railway** ou **Render**
3. **Shared** (Types TypeScript) → Package interne (pas de déploiement séparé)

---

## ⚠️ ÉTAPE 0 : Préparation (À FAIRE EN PREMIER)

### 0.1. Créer les fichiers de configuration d'environnement

#### Fichier `apps/client/.env.production`
```env
VITE_SERVER_URL=https://VOTRE-URL-SERVEUR.railway.app
```
*(Remplacez par l'URL de votre serveur après l'avoir déployé)*

#### Fichier `apps/server/.env`
```env
PORT=3001
CORS_ORIGIN=https://VOTRE-URL-CLIENT.vercel.app
NODE_ENV=production
```

### 0.2. Modifier le code client pour utiliser la variable d'environnement

**Fichier à modifier** : `apps/client/src/hooks/useSocket.ts`

**Ligne 13 actuelle** :
```typescript
const SERVER_URL = 'http://localhost:3001'
```

**Remplacer par** :
```typescript
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
```

### 0.3. Modifier le code serveur pour CORS dynamique

**Fichier à modifier** : `apps/server/src/index.ts`

**Lignes 13-16 actuelles** :
```typescript
cors: {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
},
```

**Remplacer par** :
```typescript
cors: {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true,
},
```

---

## 🎯 ÉTAPE 1 : Déploiement du Serveur (Backend)

### Option A : Railway (Recommandé - Plus simple)

#### 1.1. Créer un compte Railway
- Allez sur [railway.app](https://railway.app)
- Connectez-vous avec GitHub

#### 1.2. Créer un nouveau projet
1. Cliquez sur **"New Project"**
2. Sélectionnez **"Deploy from GitHub repo"**
3. Autorisez Railway à accéder à votre dépôt
4. Sélectionnez le dépôt `undercover-game`

#### 1.3. Configurer le service
1. Railway détectera automatiquement Node.js
2. **Root Directory** : `apps/server`
3. **Build Command** : `npm run build --workspace=packages/shared && npm run build`
4. **Start Command** : `npm start`

#### 1.4. Ajouter les variables d'environnement
Dans l'onglet **Variables** :
```
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://votre-app.vercel.app
```
*(Vous mettrez à jour CORS_ORIGIN après avoir déployé le client)*

#### 1.5. Déployer
1. Cliquez sur **"Deploy"**
2. Attendez la fin du build (~2-3 min)
3. Récupérez l'URL publique (ex: `https://undercover-production.up.railway.app`)

---

### Option B : Render (Alternative gratuite)

#### 1.1. Créer un compte Render
- Allez sur [render.com](https://render.com)
- Connectez-vous avec GitHub

#### 1.2. Créer un nouveau Web Service
1. Cliquez sur **"New +"** → **"Web Service"**
2. Connectez votre dépôt GitHub `undercover-game`
3. Configurez :
   - **Name** : `undercover-server`
   - **Root Directory** : `apps/server`
   - **Runtime** : `Node`
   - **Build Command** : `cd ../.. && npm install && npm run build --workspace=packages/shared && npm run build --workspace=apps/server`
   - **Start Command** : `npm start`
   - **Plan** : Free

#### 1.3. Ajouter les variables d'environnement
Dans **Environment** :
```
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://votre-app.vercel.app
```

#### 1.4. Déployer
1. Cliquez sur **"Create Web Service"**
2. Attendez le déploiement (~5-10 min pour le premier build)
3. Récupérez l'URL (ex: `https://undercover-server.onrender.com`)

---

## 💻 ÉTAPE 2 : Déploiement du Client (Frontend)

### Option A : Vercel (Recommandé)

#### 2.1. Installer Vercel CLI
```bash
npm i -g vercel
```

#### 2.2. Se connecter
```bash
vercel login
```

#### 2.3. Déployer depuis le terminal
```bash
cd apps/client
vercel
```

**Configuration interactive** :
- **Set up and deploy?** → Yes
- **Which scope?** → Votre compte
- **Link to existing project?** → No
- **Project name?** → undercover-game
- **Directory?** → `./` (déjà dans apps/client)
- **Override settings?** → Yes
  - **Build Command** : `npm run build --workspace=packages/shared && npm run build`
  - **Output Directory** : `dist`
  - **Install Command** : `npm install`

#### 2.4. Ajouter la variable d'environnement
```bash
vercel env add VITE_SERVER_URL production
```
Entrez l'URL de votre serveur Railway/Render : `https://votre-serveur.railway.app`

#### 2.5. Déployer en production
```bash
vercel --prod
```

**Note** : Vous pouvez aussi déployer via l'interface web de Vercel :
1. Allez sur [vercel.com/new](https://vercel.com/new)
2. Importez votre dépôt GitHub
3. Configurez **Root Directory** : `apps/client`
4. Ajoutez la variable d'environnement `VITE_SERVER_URL`

---

### Option B : Netlify (Alternative)

#### 2.1. Créer un compte Netlify
- Allez sur [netlify.com](https://netlify.com)
- Connectez-vous avec GitHub

#### 2.2. Créer un nouveau site
1. Cliquez sur **"Add new site"** → **"Import an existing project"**
2. Sélectionnez GitHub et autorisez Netlify
3. Choisissez le dépôt `undercover-game`

#### 2.3. Configuration du build
- **Base directory** : `apps/client`
- **Build command** : `cd ../.. && npm install && npm run build --workspace=packages/shared && npm run build --workspace=apps/client`
- **Publish directory** : `apps/client/dist`

#### 2.4. Ajouter les variables d'environnement
Dans **Site settings** → **Environment variables** :
```
VITE_SERVER_URL=https://votre-serveur.railway.app
```

#### 2.5. Déployer
Cliquez sur **"Deploy site"**

---

## 🔄 ÉTAPE 3 : Configuration Finale

### 3.1. Mettre à jour le CORS du serveur
1. Allez dans les variables d'environnement de votre serveur (Railway/Render)
2. Mettez à jour `CORS_ORIGIN` avec l'URL réelle du client :
   ```
   CORS_ORIGIN=https://votre-app.vercel.app
   ```
3. Redéployez le serveur (Railway/Render redémarre automatiquement)

### 3.2. Mettre à jour le client si besoin
Si vous avez déployé le serveur après le client, redéployez le client avec la bonne URL.

---

## ✅ ÉTAPE 4 : Vérification

### 4.1. Tester la connexion
1. Ouvrez l'URL du client dans votre navigateur
2. Ouvrez la console (F12)
3. Vérifiez qu'il n'y a pas d'erreur CORS
4. Créez une salle et vérifiez que ça fonctionne

### 4.2. Checklist de déploiement
- [ ] Le client charge correctement
- [ ] Le serveur est accessible (pas de 404)
- [ ] La connexion Socket.IO s'établit (voir console)
- [ ] Vous pouvez créer une salle
- [ ] Vous pouvez rejoindre une salle
- [ ] Le jeu fonctionne de bout en bout
- [ ] Pas d'erreurs CORS dans la console

---

## 🐛 Résolution de Problèmes

### Erreur CORS
**Symptôme** : `Access-Control-Allow-Origin` error dans la console

**Solution** :
1. Vérifiez que `CORS_ORIGIN` dans le serveur contient l'URL exacte du client
2. Vérifiez que le client utilise la bonne URL serveur
3. Redémarrez le serveur après changement de config

### Le client ne se connecte pas
**Symptôme** : `Connection failed` ou `disconnected` dans l'interface

**Solution** :
1. Vérifiez que `VITE_SERVER_URL` est correcte
2. Testez l'URL du serveur directement dans le navigateur
3. Vérifiez les logs du serveur (Railway/Render dashboard)

### Build qui échoue
**Symptôme** : Erreur lors du build sur Railway/Render/Vercel

**Solution** :
1. Vérifiez que le workspace `packages/shared` est bien buildé avant
2. Vérifiez que les dépendances sont installées (`npm install`)
3. Testez le build en local : `npm run build`

---

## 📊 Récapitulatif des URLs

Après déploiement, vous aurez :

| Service | Plateforme | URL Exemple | Variable d'env |
|---------|-----------|-------------|----------------|
| **Serveur** | Railway | `https://undercover-production.up.railway.app` | - |
| **Client** | Vercel | `https://undercover-game.vercel.app` | `VITE_SERVER_URL` |

**Variables à configurer** :
- **Client** : `VITE_SERVER_URL` = URL du serveur
- **Serveur** : `CORS_ORIGIN` = URL du client

---

## 🎉 C'est Prêt !

Une fois toutes les étapes complétées, votre jeu Undercover sera accessible publiquement et prêt à jouer ! 🎭

**URL à partager** : L'URL du client Vercel/Netlify

**Prochaines étapes (optionnel)** :
- Configurer un nom de domaine personnalisé
- Activer HTTPS automatique (déjà fait sur Vercel/Railway)
- Monitorer les erreurs avec Sentry
- Ajouter Google Analytics
