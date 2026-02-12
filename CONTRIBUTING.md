# 🤝 Guide de Contribution - Undercover

Merci de votre intérêt pour contribuer à **Undercover** ! Ce document vous guidera à travers le processus de contribution.

## 📋 Table des Matières

- [Code de Conduite](#code-de-conduite)
- [Comment Contribuer](#comment-contribuer)
- [Configuration de l'Environnement](#configuration-de-lenvironnement)
- [Standards de Code](#standards-de-code)
- [Processus de Pull Request](#processus-de-pull-request)
- [Signaler des Bugs](#signaler-des-bugs)
- [Proposer des Fonctionnalités](#proposer-des-fonctionnalités)

## 📜 Code de Conduite

En participant à ce projet, vous acceptez de respecter notre code de conduite :

- Soyez respectueux et inclusif
- Acceptez les critiques constructives
- Concentrez-vous sur ce qui est le mieux pour la communauté
- Faites preuve d'empathie envers les autres membres

## 🚀 Comment Contribuer

Il existe plusieurs façons de contribuer :

### 1. Ajouter des Mots
La façon la plus simple de contribuer ! Ajoutez de nouvelles paires de mots dans `src/data/words.ts`.

**Critères pour les paires de mots :**
- Les deux mots doivent être liés mais distincts
- Évitez les mots trop évidents ou trop obscurs
- Respectez la catégorie (facile, expert, adulte, gastronomie, voyage)
- Testez la paire en jouant pour vérifier qu'elle fonctionne bien

**Exemple :**
```typescript
{ civil: 'Pizza', undercover: 'Burger' }, // Gastronomie
{ civil: 'Paris', undercover: 'Londres' }, // Voyage
```

### 2. Corriger des Bugs
Consultez les [issues](https://github.com/your-username/undercover-game/issues) étiquetées `bug`.

### 3. Améliorer la Documentation
- Corriger des fautes de frappe
- Améliorer les explications
- Ajouter des exemples
- Traduire en d'autres langues

### 4. Proposer des Fonctionnalités
Ouvrez une issue avec le tag `enhancement` pour discuter de votre idée avant de commencer le développement.

## 🛠️ Configuration de l'Environnement

### Prérequis
- Node.js 18+
- npm ou bun
- Git

### Installation

```bash
# 1. Forker le dépôt sur GitHub

# 2. Cloner votre fork
git clone https://github.com/VOTRE-USERNAME/undercover-game.git
cd undercover-game

# 3. Ajouter le dépôt upstream
git remote add upstream https://github.com/original-username/undercover-game.git

# 4. Installer les dépendances
npm install
# ou
bun install

# 5. Lancer le serveur de développement
npm run dev
# ou
bun dev
```

### Structure du Projet

```
src/
├── components/       # Composants React
│   ├── screens/     # Écrans du jeu
│   ├── ui/          # Composants UI réutilisables
│   └── layout/      # Composants de mise en page
├── machines/        # Machines d'état XState
├── hooks/           # Hooks React personnalisés
├── data/            # Données statiques (mots)
├── utils/           # Fonctions utilitaires
├── types/           # Définitions TypeScript
└── styles/          # Styles globaux
```

## 📝 Standards de Code

### TypeScript
- Utilisez TypeScript strict
- Définissez des types explicites pour les props et les états
- Évitez `any` - utilisez `unknown` si nécessaire
- Utilisez des unions de types au lieu d'enums

```typescript
// ✅ Bon
type Role = 'civil' | 'undercover' | 'mrwhite'

// ❌ Mauvais
enum Role {
  Civil = 'civil',
  Undercover = 'undercover',
  MrWhite = 'mrwhite'
}
```

### React
- Utilisez des composants fonctionnels avec hooks
- Préférez les named exports aux default exports
- Utilisez `type` pour les imports de types

```typescript
// ✅ Bon
import { useState } from 'react'
import type { ReactNode } from 'react'

export function MyComponent({ children }: { children: ReactNode }) {
  // ...
}

// ❌ Mauvais
import React, { useState, ReactNode } from 'react'

export default function MyComponent({ children }: { children: ReactNode }) {
  // ...
}
```

### Styling
- Utilisez Tailwind CSS pour tous les styles
- Suivez l'approche mobile-first
- Utilisez les classes dark: pour le mode sombre
- Minimum 44px pour les cibles tactiles

```tsx
// ✅ Bon
<button className="min-h-[44px] px-4 py-2 bg-blue-600 dark:bg-blue-500">
  Cliquez
</button>

// ❌ Mauvais
<button style={{ height: '30px', background: 'blue' }}>
  Cliquez
</button>
```

### Animations
- Utilisez Framer Motion pour les animations
- Importez depuis `motion/react` (pas `framer-motion`)
- Gardez les animations subtiles et rapides (< 500ms)

```tsx
// ✅ Bon
import { motion } from 'motion/react'

<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  Contenu
</motion.div>
```

### Commits
Utilisez des messages de commit conventionnels :

```
feat(scope): add new feature
fix(scope): fix bug
docs(scope): update documentation
style(scope): format code
refactor(scope): refactor code
test(scope): add tests
chore(scope): update dependencies
```

**Exemples :**
```
feat(lobby): add player limit validation
fix(vote): resolve tie handling bug
docs(readme): add deployment instructions
```

## 🔄 Processus de Pull Request

### 1. Créer une Branche

```bash
# Synchroniser avec upstream
git fetch upstream
git checkout main
git merge upstream/main

# Créer une branche pour votre fonctionnalité
git checkout -b feat/ma-fonctionnalite
# ou
git checkout -b fix/mon-bug
```

### 2. Développer

- Faites des commits atomiques et logiques
- Testez votre code localement
- Vérifiez qu'il n'y a pas d'erreurs TypeScript

```bash
# Vérifier les erreurs TypeScript
npm run typecheck

# Build de production
npm run build
```

### 3. Pousser et Créer la PR

```bash
# Pousser votre branche
git push origin feat/ma-fonctionnalite

# Créer une Pull Request sur GitHub
```

### 4. Checklist de la PR

Avant de soumettre votre PR, vérifiez :

- [ ] Le code compile sans erreurs (`npm run build`)
- [ ] Pas d'erreurs TypeScript (`npm run typecheck`)
- [ ] Le code suit les standards de ce guide
- [ ] Les commits ont des messages clairs
- [ ] La PR a une description détaillée
- [ ] Les fichiers modifiés sont pertinents (pas de fichiers générés)
- [ ] Le code fonctionne sur mobile et desktop
- [ ] Le mode sombre fonctionne correctement

### 5. Revue de Code

- Soyez patient - les revues peuvent prendre du temps
- Répondez aux commentaires de manière constructive
- Effectuez les modifications demandées
- Demandez des clarifications si nécessaire

## 🐛 Signaler des Bugs

Utilisez le [template d'issue](https://github.com/your-username/undercover-game/issues/new?template=bug_report.md) pour signaler un bug.

**Informations à inclure :**
- Description claire du bug
- Étapes pour reproduire
- Comportement attendu vs comportement actuel
- Captures d'écran si applicable
- Environnement (navigateur, OS, version)

## 💡 Proposer des Fonctionnalités

Utilisez le [template d'issue](https://github.com/your-username/undercover-game/issues/new?template=feature_request.md) pour proposer une fonctionnalité.

**Informations à inclure :**
- Description de la fonctionnalité
- Cas d'usage et bénéfices
- Alternatives considérées
- Maquettes ou exemples si applicable

## 🎨 Ajouter des Catégories de Mots

Pour ajouter une nouvelle catégorie :

1. Modifier `src/types/game.ts` :
```typescript
export type WordCategory =
  | 'facile'
  | 'expert'
  | 'adulte'
  | 'gastronomie'
  | 'voyage'
  | 'nouvelle-categorie' // Ajouter ici
```

2. Ajouter les mots dans `src/data/words.ts` :
```typescript
export const wordDatabase: Record<WordCategory, WordPair[]> = {
  // ... catégories existantes
  'nouvelle-categorie': [
    { civil: 'Mot1', undercover: 'Mot2' },
    // Minimum 12 paires recommandées
  ]
}
```

3. Mettre à jour `src/components/screens/Lobby.tsx` :
```typescript
const CATEGORIES: { value: WordCategory; label: string }[] = [
  // ... catégories existantes
  { value: 'nouvelle-categorie', label: 'Nouvelle Catégorie' },
]
```

## 🧪 Tests

Actuellement, le projet n'a pas de tests automatisés. Les contributions pour ajouter des tests sont les bienvenues !

**Tests à ajouter (priorité) :**
- Tests unitaires pour `src/utils/roles.ts`
- Tests unitaires pour `src/machines/gameMachine.ts`
- Tests d'intégration pour les flux de jeu
- Tests E2E avec Playwright

## 📦 Dépendances

Avant d'ajouter une nouvelle dépendance :

1. Vérifiez qu'elle est vraiment nécessaire
2. Préférez les packages légers et maintenus
3. Vérifiez la licence (MIT, Apache 2.0, etc.)
4. Discutez-en dans une issue avant d'ajouter

## 🙏 Remerciements

Merci à tous les contributeurs qui aident à améliorer Undercover !

## 📞 Questions ?

Si vous avez des questions, n'hésitez pas à :
- Ouvrir une [discussion](https://github.com/your-username/undercover-game/discussions)
- Rejoindre notre [Discord](https://discord.gg/undercover) (si applicable)
- Envoyer un email à [email@example.com]

---

**Bonne contribution ! 🎉**
