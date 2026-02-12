# 🎭 Undercover - Jeu de Société Web

Un jeu de société interactif et premium pour 3-20 joueurs, optimisé pour mobile et partage d'écran.

## 🎮 À Propos

**Undercover** est un jeu de déduction sociale où les joueurs doivent identifier les imposteurs parmi eux. Chaque joueur reçoit un mot secret - les Civils partagent le même mot, les Undercovers ont un mot similaire, et Mr. White n'a aucun mot. À travers des discussions et des votes, les joueurs tentent d'éliminer les imposteurs tout en évitant de révéler leur propre identité.

### Rôles

- **👥 Civil**: Reçoit le mot principal. Objectif: éliminer tous les Undercovers et Mr. White
- **🕵️ Undercover**: Reçoit un mot similaire. Objectif: survivre ou devenir majoritaire
- **⚪ Mr. White**: Ne reçoit aucun mot. Objectif: deviner le mot secret s'il est éliminé

## ✨ Fonctionnalités

- ✅ **3-20 joueurs** avec distribution automatique des rôles
- ✅ **60 paires de mots** réparties en 5 catégories (Facile, Expert, Adulte, Gastronomie, Voyage)
- ✅ **Machine d'état XState v5** pour une logique de jeu robuste
- ✅ **Persistance localStorage** - reprenez votre partie à tout moment
- ✅ **Thème sombre/clair** avec détection automatique
- ✅ **Retour haptique** (vibration) avec animations visuelles de secours
- ✅ **Animations premium** via Framer Motion
- ✅ **Avatars DiceBear** générés automatiquement
- ✅ **Mobile-first** - optimisé pour le tactile (cibles de 44px minimum)
- ✅ **Aucun backend** - fonctionne 100% côté client
- ✅ **Interface française** complète

## 🚀 Démarrage Rapide

### Prérequis

- Node.js 18+ 
- npm ou bun

### Installation

```bash
# Cloner le dépôt
git clone <repository-url>
cd undercover-game

# Installer les dépendances
npm install
# ou
bun install

# Lancer le serveur de développement
npm run dev
# ou
bun dev
```

L'application sera disponible sur `http://localhost:5173`

### Build de Production

```bash
# Créer le build optimisé
npm run build
# ou
bun run build

# Prévisualiser le build
npm run preview
# ou
bun preview
```

## 🎯 Comment Jouer

1. **Lobby**: Ajoutez 3-20 joueurs et choisissez une catégorie de mots
2. **Distribution**: Chaque joueur révèle son rôle et son mot (en privé)
3. **Discussion**: Les joueurs discutent à tour de rôle (timer configurable)
4. **Vote**: Vote séquentiel pour éliminer un joueur
5. **Élimination**: Le rôle du joueur éliminé est révélé
6. **Mr. White**: Si Mr. White est éliminé, il peut deviner le mot
7. **Victoire**: Le jeu continue jusqu'à ce qu'une équipe gagne

### Conditions de Victoire

- **Civils gagnent**: Tous les Undercovers et Mr. White sont éliminés
- **Undercovers gagnent**: Les Undercovers deviennent majoritaires ou égaux aux Civils
- **Mr. White gagne**: Éliminé mais devine correctement le mot (vote des joueurs)

## 🛠️ Stack Technique

- **Framework**: React 18 + TypeScript
- **Build**: Vite 7
- **State Management**: XState v5 (machine d'état hiérarchique)
- **Styling**: Tailwind CSS v4 (configuration CSS-first)
- **Animations**: Framer Motion v12
- **Avatars**: DiceBear (style Lorelei)
- **Confetti**: canvas-confetti
- **Persistence**: localStorage avec auto-save

## 📁 Structure du Projet

```
src/
├── components/
│   ├── layout/
│   │   └── GameLayout.tsx       # Wrapper avec ThemeToggle
│   ├── screens/
│   │   ├── Landing.tsx           # Écran d'accueil
│   │   ├── Lobby.tsx             # Gestion des joueurs
│   │   ├── Distribution.tsx      # Révélation des rôles
│   │   ├── GameMaster.tsx        # Timer et orateur
│   │   ├── Vote.tsx              # Vote d'élimination
│   │   ├── Elimination.tsx       # Révélation du joueur éliminé
│   │   ├── MrWhiteGuess.tsx      # Devinette de Mr. White
│   │   └── Victory.tsx           # Écran de victoire
│   ├── ui/
│   │   └── ThemeToggle.tsx       # Toggle sombre/clair
│   └── ErrorBoundary.tsx         # Gestion d'erreurs
├── machines/
│   └── gameMachine.ts            # Machine d'état XState (658 lignes)
├── hooks/
│   ├── useGameActor.ts           # Hook principal du jeu
│   ├── useLocalStorage.ts        # Utilitaire de persistance
│   └── useTheme.ts               # Gestion du thème
├── data/
│   └── words.ts                  # Base de données de mots
├── utils/
│   └── roles.ts                  # Algorithme de distribution
├── types/
│   └── game.ts                   # Définitions TypeScript
└── styles/
    └── index.css                 # Styles globaux Tailwind
```

## 🎨 Personnalisation

### Ajouter des Mots

Éditez `src/data/words.ts` pour ajouter de nouvelles paires de mots:

```typescript
export const wordDatabase: Record<WordCategory, WordPair[]> = {
  facile: [
    { civil: 'Chien', undercover: 'Chat' },
    // Ajoutez vos paires ici
  ],
  // ...
}
```

### Modifier les Durées de Timer

Les presets de timer sont dans `src/components/screens/GameMaster.tsx`:

```typescript
const TIMER_PRESETS = [30, 60, 90, 120, 180] // en secondes
```

### Personnaliser les Couleurs

Les couleurs des rôles sont définies dans `src/index.css`:

```css
@theme {
  --color-civil: #10b981;      /* Emerald 500 */
  --color-undercover: #f43f5e;  /* Rose 500 */
  --color-mrwhite: #64748b;     /* Slate 500 */
}
```

## 📦 Build & Déploiement

### Déploiement sur Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel
```

### Déploiement sur Netlify

```bash
# Build
npm run build

# Le dossier dist/ est prêt pour le déploiement
```

### Variables d'Environnement

Aucune variable d'environnement requise - l'application fonctionne 100% côté client.

## 📄 Licence

MIT License

## 🙏 Remerciements

- [XState](https://xstate.js.org/) pour la gestion d'état robuste
- [Framer Motion](https://www.framer.com/motion/) pour les animations fluides
- [DiceBear](https://dicebear.com/) pour les avatars générés
- [Tailwind CSS](https://tailwindcss.com/) pour le système de design
- [Vite](https://vitejs.dev/) pour l'expérience de développement rapide

---

**Fait avec ❤️ pour les soirées jeux entre amis**
