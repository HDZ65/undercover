# Empire du Commerce — Game Design Document

Version 1.2 — Février 2026

---

## 1. Pitch

**Empire du Commerce** est un jeu de stratégie économique multijoueur en ligne, tour par tour, pour 4 à 12 joueurs. Chaque joueur incarne un pays asymétrique et dispose de 50 tours pour bâtir un empire à travers l'industrie, la diplomatie, l'espionnage et — si nécessaire — la guerre. Le score final combine trois axes (PIB, bien-être de la population, influence internationale), garantissant qu'il n'existe pas une seule voie vers la victoire. Alliances, trahisons, sabotages et négociations commerciales font de chaque partie une expérience unique.

---

## 2. Vision et public cible

### Vision

Un jeu de stratégie accessible mais profond, jouable dans un navigateur web sans installation. Les parties durent entre 45 minutes et 2 heures selon le nombre de joueurs. Le rythme est simultané : tous les joueurs planifient leurs actions en même temps, puis une phase de résolution globale révèle les résultats. Ce format élimine les temps morts et maintient l'engagement de chaque joueur à chaque tour.

### Public cible

Joueurs de 16 ans et plus appréciant les jeux de stratégie économique (Civilization, Offworld Trading Company, Diplomacy). Le jeu vise un équilibre entre profondeur stratégique (12 catégories de gestion, arbre technologique, diplomatie) et accessibilité (interface claire, actions limitées par tour, feedback visuel immédiat). Le format multijoueur en ligne entre amis (room privée avec code) est le mode principal.

### Spécifications techniques

- **Joueurs** : 4 à 12 par partie
- **Durée** : pas de limite de tours (fin quand ≤ 2 joueurs actifs)
- **Plateforme** : navigateur web (desktop et mobile)
- **Réseau** : Socket.io temps réel, namespace dédié `/economic-war`
- **Architecture** : client React + serveur Node.js + machine d'état XState v5

---

## 3. Règles de base

### Score final

Le classement est déterminé par un score composite calculé à chaque tour :

**Score = 50 % PIB + 30 % (Bonheur × Population) + 20 % Influence**

- **PIB** : valeur économique totale produite (industrie, commerce, services, brevets).
- **Bonheur × Population** : un pays peuplé et heureux pèse lourd. Un petit pays très heureux peut rivaliser avec un grand pays mécontent.
- **Influence** : nombre et poids des organisations dont on est membre, brevets détenus, accords commerciaux actifs, réputation internationale.

En cas d'égalité au tour 50 : PIB départage, puis Bonheur, puis Influence.

### Structure d'un tour

Chaque tour se déroule en 4 phases :

**Phase 1 — Choix (privée, simultanée).** Chaque joueur dispose de 4 à 6 actions. Il répartit ses actions entre : investir, construire, rechercher, commercer, saboter, se défendre, déclarer la guerre, voter dans une organisation, proposer un accord. Un timer configurable (défaut : 90 secondes) limite la durée de cette phase. Les joueurs ne voient pas les choix des autres.

**Phase 2 — Validation collective.** Chaque joueur appuie sur « Prêt ». Le leaderboard est visible pendant l'attente. Si le timer expire avant qu'un joueur ne valide, ses actions sont annulées (il « passe » son tour). Dès que tous les joueurs sont prêts ou que le timer expire, la résolution commence.

**Phase 3 — Résolution globale.** Toutes les actions sont résolues simultanément dans un ordre déterministe fixe :

1. Défenses activées
2. Sabotages résolus (jet de réussite, puis jet de visibilité)
3. Opérations de guerre (progression des conflits en cours)
4. Production (usines, agriculture, extraction)
5. Commerce (échanges entre joueurs)
6. Événements aléatoires (1-2 par tour)
7. Mise à jour bonheur, santé, population
8. Calcul du score

**Phase 4 — Feedback.** Pop-ups animés pour chaque événement marquant. Leaderboard mis à jour en temps réel. Achievements débloqués. Résumé cliquable de tout ce qui s'est passé ce tour.

### Élimination

**Il n'y a pas d'élimination.** Un joueur peut perdre des régions, de l'argent, de la population, mais il reste toujours en jeu. Même un pays dévasté peut se reconstruire via le commerce, la recherche et les alliances. Cette règle garantit que personne ne reste spectateur.

### Abandon et fin de partie

**Pas de limite de tours.** La partie continue indéfiniment tant qu'il y a au moins 3 joueurs actifs. Chaque joueur dispose d'un bouton **« Abandonner »** accessible à tout moment. Un joueur qui abandonne quitte définitivement la partie — son pays cesse de fonctionner (0 actions, pas de production, déclin progressif).

**Si un joueur ne soumet pas ses actions avant la fin du timer** : il n'est PAS éliminé. Il "passe" simplement son tour (0 actions), et le jeu continue normalement au tour suivant.

**La partie se termine quand il reste 2 joueurs actifs ou moins** (les autres ayant cliqué « Abandonner »). Le joueur avec le **meilleur score** à cet instant gagne.

L'hôte peut optionnellement configurer une victoire anticipée par seuil de score (désactivé par défaut).

---

## 4. Les 12 catégories

### Couche 1 — Fondations

#### 1. Population

La population est la ressource fondamentale. Elle détermine la main-d'œuvre disponible, la taille du marché intérieur et le poids du score bonheur. Elle croît naturellement mais peut être boostée ou réduite par plusieurs facteurs.

##### 1.1 — Croissance naturelle

```
CroissanceNette = Population × TauxCroissance

TauxCroissance = BaseTaux + BonusBonheur + BonusSanté - MalusMigration - MalusGuerre
  BaseTaux        =  +1.0 %/tour   (socle universel)
  BonusBonheur    =  (Bonheur - 50) × 0.04 %/tour   (peut être négatif si bonheur < 50)
  BonusSanté      =  (Santé - 50) × 0.02 %/tour
  MalusGuerre     =  -2.0 %/tour si en guerre (mobilisation + pertes)
```

Plafond de croissance : +3 %/tour. Plancher : -2 %/tour (fuite massive en temps de guerre).

##### 1.2 — Migrations

Les citoyens migrent spontanément chaque tour selon le différentiel de bonheur entre pays :

```
MigrationSortante = Population × max(0, (BonheurMoyenMonde - BonheurPays) × 0.01 %)
MigrationEntrante = Σ MigrationSortante(autres pays) × (BonheurPays / BonheurTotal)
```

- Un pays à bonheur 80 % attire des migrants des pays à bonheur 30 %.
- Un pays en guerre ou en crise (bonheur < 30 %) perd jusqu'à 0.5 % de sa population/tour par émigration.
- Les migrants entrants amènent immédiatement +X % de main-d'œuvre supplémentaire.

##### 1.3 — Productivité par travailleur

La productivité dépend de trois facteurs : bonheur, santé et éducation.

```
Productivité = BaseProd × (Bonheur/100) × (Santé/100) × MultiplierÉducation

BaseProd = 1.0
MultiplierÉducation = 1.0 + NiveauÉducation × 0.08   (Éducation 0–10 → ×1.0 à ×1.8)
```

**Effet autoritaire :** si Forces Armées ≥ 60, le régime peut compenser jusqu'à -30 % de bonheur sans perte de productivité (les travailleurs produisent par contrainte, pas par motivation).

```
Si FA ≥ 60 et Bonheur < 50 :
    BonheurEffectif = max(Bonheur, Bonheur + (FA - 60) × 0.5)  ← ne dépasse pas 50 %
    Plafonné à : BonheurEffectif = max(Bonheur, 50 - (50 - Bonheur) × 0.3)
```

En dessous de 20 % de bonheur : **révoltes**, indépendamment du militaire. Effets : destruction aléatoire d'une infrastructure (-10 à -20 % capacité), -5 % PIB ce tour.

##### 1.4 — Impact sur le score

```
PoidsPopulation = Population × (Bonheur/100)
→ Contribution score = 30 % × PoidsPopulation / PopulationMax
```

Un petit pays très heureux peut rivaliser avec un grand pays mécontent dans l'axe « bonheur × population ».

##### 1.5 — Ratios de référence — Population

| Paramètre | Valeur |
|:---|:-:|
| Croissance naturelle (bonheur 50, santé 50) | +1.0 %/tour |
| Croissance max (bonheur 100, santé 100) | +3.0 %/tour |
| Perte max (guerre, bonheur effondré) | −2.0 %/tour |
| Seuil révoltes | Bonheur < 20 % |
| Plafond effet autoritaire | Compense jusqu'à −30 % bonheur |
| Productivité max (éducation 10, bonheur 100, santé 100) | ×1.8 |
| Migration entrante déclenchée à | Bonheur > moyenne mondiale |

#### 2. Ressources primaires

Chaque pays possède un profil de dotation asymétrique en quatre ressources de base : pétrole, minerais, agriculture et eau douce. Les ressources brutes génèrent des revenus d'exportation directe ou servent d'intrants aux usines. La dotation initiale est fixée par le profil-pays et ne peut pas être modifiée — seule l'efficacité d'extraction évolue via la recherche.

##### 2.1 — Quatre secteurs d'exploitation

**⛏ Mines & Extraction**

Les mines produisent des minerais bruts vendables directement ou transformables en usine. Chaque mine a un **niveau d'exploitation** (0–5) qui détermine la quantité extraite par tour.

| Minerai | Produit issu des mines | Usage principal |
|:---|:---|:---|
| Fer | Fer brut | Aciérie → acier, ciment |
| Cuivre | Cuivre brut | Usine électronique → câblage, électronique |
| Lithium | Lithium brut | Usine électronique → batteries, véhicules électriques |
| Terres rares | Terres rares | Usine électronique → semi-conducteurs, militaire |
| Or | Or brut | Exportation directe (valeur refuge), Finance |
| Uranium | Uranium enrichi | Recherche Militaire L4+ → programme nucléaire |
| Charbon | Charbon | Aciérie + énergie de base (remplacé par pétrole/gaz) |

```
ProductionMine(niveau) = DotationPays × niveau × EfficacitéExtraction
EfficacitéExtraction = f(Recherche Extraction & Énergie)
  L1 → 100 %  /  L2 → 135 %  /  L3 → 160 %  /  L4 → 185 %  /  L5 → 210 %
```

**Pollution par niveau de mine :** `+3 pts/niveau/tour` (cumulatif).
**Épuisement :** les minerais rares (lithium, terres rares, or) ont un stock fini. Taux d'épuisement : `−(niveau × 0.5 %) du stock total/tour`. Recyclage partiel via usine électronique (-20 % du stock consommé récupéré).

---

**🌾 Agriculture**

L'agriculture est renouvelable. Les rendements dépendent de l'eau disponible, du niveau de recherche Agriculture et des événements climatiques.

| Culture | Produit | Usage |
|:---|:---|:---|
| Blé | Blé | Export direct / Usine agro-alimentaire |
| Riz | Riz | Export direct / Usine agro-alimentaire |
| Maïs | Maïs | Export direct / Biocarburants |
| Coton | Coton brut | Usine textile |
| Café | Café | Export direct (luxe alimentaire) |

```
ProductionAgricole = DotationTerres × RendementBase × (EauDispo/100) × BonusRecherche
RendementBase(Agriculture L1) = 1.0  /  L2 → 1.25  /  L3 → 1.45  /  L4 → 1.65  /  L5 → 1.80
```

Pénalité eau douce : si `EauDispo < 30 %` → production réduite de `(30 - EauDispo) × 2 %`. En dessous de 10 % : famines possibles, -10 % bonheur/tour.

---

**🐄 Élevage**

L'élevage génère des produits animaux exportables ou transformables. Il consomme de l'eau et de l'espace agricole, et génère de la pollution (méthane).

| Produit | Usage |
|:---|:---|
| Viande (bœuf, porc, volaille) | Export direct / Usine agro-alimentaire |
| Lait | Usine agro-alimentaire → fromage, yaourts |
| Laine | Usine textile |

```
ProductionÉlevage = CheptelNiveau × DotationPays × BonusRecherche
Pollution élevage = CheptelNiveau × 4 pts/tour   ← méthane
ConsoEau élevage = CheptelNiveau × 5 % EauDispo/tour
```

Niveau cheptel de 0 à 5. Coût investissement par niveau : `400 × niveau`. Entretien : `80 × niveau / tour`.

---

**🐟 Pêche maritime**

Disponible uniquement aux pays avec accès côtier (défini par le profil-pays). Renouvelable mais limité par les quotas de pêche. Pollution nulle mais sensible aux événements (marée noire −20 %).

| Produit | Usage |
|:---|:---|
| Poisson (cabillaud, saumon, thon) | Export direct / Usine agro-alimentaire |
| Crustacés (crevettes, homard) | Export direct (luxe alimentaire) |
| Algues | Biocarburants / Alimentation |

```
ProductionMarine = ZonePêche × QuotaDurable × EfficacitéFlotte
EfficacitéFlotte = f(Recherche Extraction L2+ → +20 %, L4+ → +40 %)
```

Niveau flotte de 0 à 4. Coût par niveau : `700 × niveau`. Si surpêche (quota dépassé) : stock marin réduit de `−5 %/tour` pendant 3 tours.

---

**⛽ Pétrole & Énergie**

Le pétrole est quasi-inépuisable (très léger renouvellement naturel), mais le coût d'extraction augmente avec la profondeur des gisements. L'eau douce, non substituable, est à gestion séparée.

| Ressource | Produit | Usage |
|:---|:---|:---|
| Pétrole brut | Pétrole brut | Export direct / Raffinerie → carburant, plastiques |
| Gaz naturel | Gaz | Export direct / Énergie industrielle |
| Uranium | Uranium enrichi | Programme nucléaire (Militaire L4+) |
| Eau douce | — | Irrigation agricole + population (non commercialisable) |

```
ProductionPétrole = Gisement × NiveauExtraction × EfficacitéForage
EfficacitéForage = f(Recherche Extraction)
  L1 → base  /  L2 → +35 %  /  L3 → +55 % (offshore disponible)  /  L4 → +75 % (offshore profond)
CoûtExtraction(tour) = BaseCoût × (1 + ÂgeGisement × 0.02)
```

L'eau douce n'est pas commercialisable mais conditionne l'agriculture et la population. Un déficit en eau (`< 20 %`) génère : -10 % agriculture, -5 % croissance population, -5 % bonheur.

##### 2.2 — Profils de dotation pays (asymétrie)

Chaque pays reçoit à la création une dotation initiale dans chaque ressource (de 0 à 100 %). Cette dotation est **permanente** — seule l'efficacité d'exploitation change. Exemples de profils-types :

| Profil | Pétrole | Minerais | Agriculture | Eau | Accès maritime |
|:---|:-:|:-:|:-:|:-:|:-:|
| Pétro-état | 90 % | 30 % | 20 % | 40 % | ✓ |
| Pays agricole | 10 % | 20 % | 85 % | 80 % | ✗ |
| Puissance minière | 20 % | 80 % | 40 % | 50 % | ✓ |
| Nation tech | 15 % | 60 % | 30 % | 60 % | ✓ |
| Pays enclavé | 25 % | 55 % | 65 % | 70 % | ✗ |

Un pays sans accès maritime ne peut pas exploiter la pêche ni utiliser le transport maritime sans alliance ou corridor négocié.

#### 3. Usines

Les usines transforment les ressources brutes en produits finis commercialisables. Leur efficacité dépend des outils (catégorie 6) et du niveau de recherche Industrie (catégorie 5). Chaque usine a un coût de construction, un coût d'entretien croissant et génère de la pollution. Trois tiers existent selon le niveau de recherche Industrie. Les usines sont des cibles prioritaires de sabotage.

##### 3.1 — Trois tiers d'usine

| Tier | Condition | Multiplicateur production | Pollution relative | Main-d'œuvre |
|:---|:---|:-:|:-:|:-:|
| 🔨 **Basique** | Industrie L1 | × 1.0 (base) | × 1.0 | Élevée |
| ⚙ **Avancée** | Industrie L2 | × 1.5 | × 0.8 | Moyenne |
| 🤖 **Robotisée** | Industrie L3 | × 2.2 | × 0.5 | Faible |

Chaque usine achetée est d'un tier précis. On ne monte pas une usine existante de tier — on construit une nouvelle usine de tier supérieur (l'ancienne continue à tourner ou est démantelée).

##### 3.2 — Types d'usines et produits fabriqués

| Type d'usine | Intrant(s) requis | Produit(s) fabriqués | Recherche requise |
|:---|:---|:---|:---|
| 🛢 **Raffinerie** | Pétrole brut | Carburant, Plastiques | Extraction L2 |
| ⚒ **Aciérie** | Fer + Charbon | Acier, Ciment | Industrie L1 |
| 👕 **Usine textile** | Coton / Laine | Textiles, Vêtements | Industrie L1 |
| 🍞 **Usine agro-alim.** | Blé / Riz / Lait / Viande | Conserves, Farine, Produits laitiers | Agriculture L2 |
| 💊 **Usine pharma** | Biotechnologie (abstraite) | Vaccins, Médicaments | Médical L3 |
| 💻 **Usine électronique** | Terres rares + Cuivre + Lithium | Semi-conducteurs, Smartphones, Batteries | Industrie L2 + Extraction L3 |
| 🔧 **Usine d'équipement** | Acier + Cuivre | Machines-outils, Turbines, Équipement minier | Industrie L2 |
| 🚗 **Usine automobile/véhicules** | Acier + Lithium + Cuivre | Véhicules légers, Véhicules électriques | Industrie L3 |
| 🛡 **Usine d'armement** | Acier + Terres rares | Véhicules blindés, Drones, Munitions | Militaire L2 + Industrie L2 |

*Biotechnologie (intrant Usine pharma) : ressource abstraite générée par la recherche Médical — pas extraite du sol.*

##### 3.3 — Coûts de construction par tier

| Type | Tier Basique | Tier Avancé | Tier Robotisé |
|:---|:-:|:-:|:-:|
| Raffinerie | 800 | 1 600 | 3 000 |
| Aciérie | 700 | 1 400 | 2 600 |
| Usine textile | 400 | 800 | 1 500 |
| Usine agro-alim. | 500 | 1 000 | 1 900 |
| Usine pharma | 1 200 | 2 400 | 4 500 |
| Usine électronique | 1 500 | 3 000 | 5 500 |
| Usine d'équipement | 900 | 1 800 | 3 300 |
| Usine auto/véhicules | 1 000 | 2 000 | 3 800 |
| Usine d'armement | 1 100 | 2 200 | 4 000 |

##### 3.4 — Entretien et pollution par tour

```
EntretienUsine = CoûtConstruction × TauxEntretien(Tier)
  Basique    → 3 % du coût de construction/tour
  Avancée    → 4 % du coût de construction/tour
  Robotisée  → 5 % du coût de construction/tour (plus cher, mais production x2.2)

PollutionUsine = BasePollution(Type) × Tier_Facteur × (1 - BonusOutils)
  Tier Basique    → × 1.0
  Tier Avancée    → × 0.8
  Tier Robotisée  → × 0.5
```

**Pollution de base par type d'usine (Tier Basique / tour) :**

| Type | Pollution base |
|:---|:-:|
| Raffinerie | 12 pts |
| Aciérie | 10 pts |
| Usine textile | 4 pts |
| Usine agro-alim. | 3 pts |
| Usine pharma | 5 pts |
| Usine électronique | 7 pts |
| Usine d'équipement | 8 pts |
| Usine auto/véhicules | 6 pts |
| Usine d'armement | 9 pts |

##### 3.5 — Formule de production

```
ProductionUsine = IntrantDisponible × RendementBase(Type) × MultiplierTier × MultiplierOutils
                × EfficaciteInfra × (1 - DégâtsSabotage)

RendementBase  = spécifique au type (ratio intrant → produit fini)
MultiplierTier = 1.0 / 1.5 / 2.2 selon le tier
MultiplierOutils = f(catégorie 6 — Outils)
EfficaciteInfra  = f(catégorie 8 — Infrastructures Critiques)
```

Si l'intrant manque (stock = 0), la production tombe à 0 ce tour. Pas de production partielle automatique — le joueur doit s'approvisionner via commerce ou extraire lui-même.

##### 3.6 — Modale "Mes Usines"

```
┌──────────────────────────────────────────────────────────────────┐
│  MES USINES                                               [X]   │
│──────────────────────────────────────────────────────────────────│
│  Usine                │ Tier  │ Prod./tour │ Entret. │ Pollution │
│─────────────────────┼───────┼────────────┼─────────┼───────────│
│  🛢 Raffinerie #1   │ Avancé│ 420 carb.  │  64/t   │  9.6 pts  │
│  ⚒ Aciérie #1      │ Basic.│ 180 acier  │  21/t   │  10 pts   │
│  💻 Électronique #1 │ Robot.│ 95 semi-c. │ 275/t   │  3.5 pts  │
│──────────────────────────────────────────────────────────────────│
│  TOTAL  Entretien : 360/tour   Pollution : 23.1 pts/tour        │
│  CONSTRUIRE : [Choisir un type ▼]  [Tier ▼]  → Coût : —        │
│  [+ Construire une nouvelle usine]                               │
└──────────────────────────────────────────────────────────────────┘
```

#### 4. Transport & Logistique

Routes, ports et aéroports déterminent la capacité d'échange commercial et la logistique interne. Un pays enclavé sans ports maritimes doit investir davantage en routes et aéroports pour exporter. Le transport affecte le coût des échanges : des infrastructures transport de qualité réduisent les frais de transaction commerciale. Les infrastructures transport sont des cibles de sabotage à fort impact (elles ralentissent toute la chaîne logistique).

##### 4.1 Les quatre catégories de transport

| Catégorie | Description | Spécialité |
|:---|:---|:---|
| 🚛 **Routier** | Camions, autoroutes | Rapide, courtes distances, capacité moyenne |
| 🚂 **Ferroviaire** | Trains de fret | Très gros volume, lent, stable, durable |
| 🚢 **Maritime** | Cargos, ports | Volume maximal, très lent, idéal exports lointains |
| ✈ **Aérien** | Avions cargo | Express, faible volume, très cher, s'use vite |

Sans aucun moyen de transport : capacité d'export limitée à **50 unités artisanales par tour**.

##### 4.2 Capacité d'export par niveau

La capacité d'export maximale par tour est la somme des capacités effectives de toutes les catégories investies :

```
CapacitéExportMax = 50 + Σ BaseCapacité(T, Niveau) × Efficacité(T) / 100
```

**Capacité de base par niveau (unités exportables par tour) :**

| Niveau | Routier | Ferroviaire | Maritime | Aérien |
|:-:|:-:|:-:|:-:|:-:|
| 1 | 300 | 800 | 1 500 | 150 |
| 2 | 600 | 1 600 | 3 000 | 300 |
| 3 | 1 000 | 2 500 | 5 000 | 500 |
| 4 | 1 400 | 3 500 | 7 000 | 700 |
| 5 | 2 000 | 5 000 | 10 000 | 1 000 |

##### 4.3 Blocage automatique de vente

Si la quantité à exporter dépasse le minimum entre le stock disponible et la capacité de transport :

```
ExportAutorisé = min(Stock, CapacitéExportMax)
Si QtyVente > ExportAutorisé → BLOCAGE : "Stock insuffisant – max X unités"
```

Le joueur voit toujours sa capacité max avant de saisir la quantité. Aucune exception.

##### 4.4 Durée de vie et dégradation progressive

Chaque catégorie a une durée de vie en tours. L'efficacité se dégrade doucement avec l'âge et rapidement sans entretien payé.

**Durées de vie :**

| Catégorie | Durée de vie | Remplacements sur 50 tours |
|:---|:-:|:-:|
| Routier | 12 tours | ~4 fois |
| Ferroviaire | 20 tours | ~2-3 fois |
| Maritime | 18 tours | ~2-3 fois |
| Aérien | **8 tours** | ~6 fois *(pression constante)* |

**Usure naturelle (progressive avec l'âge) :**

```
UsureNaturelle(T) = 2% + (Âge(T) / Durée(T)) × 1%
```
— Début de vie : -2 %/tour. — Fin de vie : -3 %/tour.

**Mise à jour de l'efficacité chaque tour :**

```
Si EntretienPayé = VRAI  → Efficacité -= UsureNaturelle(T)
Si EntretienPayé = FAUX  → Efficacité -= 10%   ← dégradation rapide
Si Âge(T) > Durée(T)     → Efficacité -= 25%   ← effondrement progressif
Efficacité = max(0, Efficacité)
```

Avec entretien régulier, un transport termine sa vie à ~73-80 % d'efficacité (dégradation douce). Sans entretien deux tours consécutifs, il perd ~20 % d'un coup, récupérable en reprenant l'entretien.

##### 4.5 Coûts de construction, d'entretien et de remplacement

**Coûts de construction :**

| Catégorie | Niveau 1 | Niveau 2 | Niveau 3 |
|:---|:-:|:-:|:-:|
| Routier | 500 | 900 | 1 400 |
| Ferroviaire | 1 500 | 2 500 | 4 000 |
| Maritime | 2 000 | 3 500 | 5 500 |
| Aérien | 1 200 | 2 000 | 3 200 |

**Entretien par tour :**

```
Entretien(T) = CoûtConstruction(T, Niveau) × TauxEntretien(T)
```

| Catégorie | Taux entretien/tour |
|:---|:-:|
| Routier | 2 % du coût de construction |
| Ferroviaire | 3 % du coût de construction |
| Maritime | 4 % du coût de construction |
| Aérien | **6 % du coût de construction** |

**Coût de remplacement** (infrastructure existante réutilisée partiellement) :

| Catégorie | Coût de remplacement |
|:---|:-:|
| Routier | 60 % du coût initial |
| Ferroviaire | 55 % du coût initial |
| Maritime | 55 % du coût initial |
| Aérien | 65 % du coût initial |

##### 4.6 Pollution et impact santé

```
Pollution(T) = Niveau(T) × TauxPollution(T) × (Efficacité(T) / 100)
```

*Un transport dégradé pollue un peu moins, car il est moins actif.*

| Catégorie | Taux pollution par niveau |
|:---|:-:|
| Routier | 3 pts/niveau |
| Ferroviaire | 2 pts/niveau *(le plus propre)* |
| Maritime | 5 pts/niveau *(fioul lourd)* |
| Aérien | **9 pts/niveau** *(kérosène)* |

La pollution transport s'additionne à la pollution industrielle (voir catégorie 10 — Santé & Environnement). Impact santé : **-0.05 % espérance de vie par tranche de 10 pts de pollution totale par tour**. Lent, cumulatif, non punitif à court terme.

##### 4.7 Modale "Transport & Logistique"

```
┌──────────────────────────────────────────────────────────────────┐
│  TRANSPORT & LOGISTIQUE                                    [X]  │
│──────────────────────────────────────────────────────────────────│
│  📦 Capacité export totale ce tour : 742 unités                 │
│     [████████░░░░░░░░░░░░] 742 / 2 600 max théorique            │
│                                                                  │
│  ⚠ Sans transport : limité à 50 unités/tour (artisanal)         │
│──────────────────────────────────────────────────────────────────│
│  Catégorie      │ Cap. Act. │ Vitesse  │ Efficac. │ Âge  │Entret.│
│─────────────────┼───────────┼──────────┼──────────┼──────┼───────│
│  🚛 Routier L2  │  528 u.   │ Rapide   │  88 %    │ 6/12 │[Payer]│
│  ✈  Aérien  L1  │  143 u.   │ Express  │  95 %    │  1/8 │[Payer]│
│  🚂 Ferrov.  —  │  —        │  —       │  —       │  —   │  —   │
│  🚢 Maritime —  │  —        │  —       │  —       │  —   │  —   │
│──────────────────────────────────────────────────────────────────│
│  Catégorie      │ Dégr./tour │ Pollution │ Impact santé          │
│─────────────────┼────────────┼───────────┼───────────────────────│
│  🚛 Routier L2  │  -2.5 %    │   6 pts   │ -0.030 % esp.vie/tour │
│  ✈  Aérien  L1  │  -2.1 %    │   9 pts   │ -0.045 % esp.vie/tour │
│──────────────────────────────────────────────────────────────────│
│  INVESTIR (coûte 1 action + budget)                              │
│  [🚛 Améliorer Routier → L3 : 1400]  [🚂 Construire Ferrov. L1 : 1500]│
│  [🚢 Construire Maritime L1 : 2000]  [✈  Améliorer Aérien → L2 : 2000]│
│──────────────────────────────────────────────────────────────────│
│  ALERTES :                                                       │
│  🟡 Routier : 6 tours avant remplacement recommandé             │
│  🟢 Aérien : 7 tours restants                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Couleurs d'alerte durée de vie :**
- 🟢 Vert : > 50 % durée restante
- 🟡 Orange : 25-50 % durée restante
- 🔴 Rouge : < 25 % durée restante
- ⛔ Clignotant rouge : âge dépassé, -25 %/tour si non remplacé

Le bouton **[Payer]** entretien est cliquable directement dans la modale sans consommer d'action tour (dépense budgétaire simple).

##### 4.8 Valeur stratégique par archétype

| Archétype | Transport privilégié | Raison |
|:---|:---|:---|
| Commerçant pacifique | Maritime + Ferroviaire | Volumes massifs, durée longue |
| Technocrate | Aérien | Exports haute-tech, faible volume, haute valeur |
| Militariste | Routier | Logistique militaire, double usage |
| Écologiste | Ferroviaire | Le moins polluant, investissement durable |

##### 4.9 Ratios de référence — Transport

| Paramètre | Valeur |
|:---|:-:|
| Socle export sans transport | 50 unités/tour |
| Usure avec entretien (début vie) | -2 %/tour |
| Usure avec entretien (fin vie) | -3 %/tour |
| Dégradation sans entretien | -10 %/tour |
| Effondrement post-durée de vie | -25 %/tour |
| Efficacité minimale avant remplacement conseillé | ~75 % |
| Pollution aérienne (max, niv 5) | 45 pts/tour |
| Impact santé (10 pts pollution) | -0.05 % espérance de vie/tour |

### Couche 2 — Développement

#### 5. Recherche, Éducation et Brevets

Chaque tour, le pays génère des **Tech pts** selon son niveau d'éducation et l'état de ses laboratoires. Le joueur choisit **un seul domaine par tour** où envoyer ces points. Les points s'accumulent dans ce domaine jusqu'au seuil du niveau suivant, qui débloque une amélioration concrète (infrastructure, multiplicateur, produit exportable, arme). Les niveaux de recherche **gatent** directement les autres catégories : on ne peut pas construire de cargos sans Transport L3, ni utiliser des robots industriels sans Industrie L3.

Bonus militaire : la recherche amplifie l'efficacité des forces armées à raison de +1 point militaire effectif par tranche de 5 niveaux de recherche. Un techno-militariste surpasse un pur militariste à budget égal.

##### 5.1 Domaines de recherche — disponibilité

**5 domaines disponibles dès le tour 1 :**

| Domaine | Description |
|:---|:---|
| 🌾 Agriculture | Culture et rendement alimentaire |
| ⛏ Extraction & Énergie | Pétrole, minerais, ressources énergétiques |
| 🏭 Industrie & Outils | Efficacité des usines, automatisation |
| 🚛 Transport | Accès aux infrastructures de transport (cat. 4) |
| ⚔ Militaire & Cybersécurité | Tiers d'armes, renseignement, cyberdéfense |

**2 domaines qui s'ouvrent dès qu'un L2 est atteint n'importe où :**

| Domaine | Condition |
|:---|:---|
| ❤ Médical & Santé | Premier L2 atteint dans n'importe quel domaine |
| 💰 Finance & Commerce | Premier L2 atteint dans n'importe quel domaine |

##### 5.2 Niveaux par domaine — déblocages concrets

**🌾 Agriculture**

| Niveau | Déblocage concret |
|:-:|:---|
| L1 | Agriculture manuelle — socle de base |
| L2 | Irrigation basique — +25 % rendement agricole, +10 % résistance sécheresse |
| L3 | Mécanisation (tracteurs) — +45 % rendement, réduit main-d'œuvre nécessaire |
| L4 | Serres climatisées — immunité aux événements sécheresse/gel |
| L5 | Agriculture verticale / IA — +80 % rendement, quasi indépendance météo |

**⛏ Extraction & Énergie**

| Niveau | Déblocage concret |
|:-:|:---|
| L1 | Extraction manuelle — pétrole et minerais de base |
| L2 | Foreuses mécaniques — +35 % rendement extraction |
| L3 | Foreuses pétrolières profondes — réserves enfouies, réduit coût d'extraction |
| L4 | Plateformes offshore — réserves marines disponibles |
| L5 | Extraction terres rares avancée — lithium, terres rares pour électronique et militaire |

**🏭 Industrie & Outils**

| Niveau | Déblocage concret |
|:-:|:---|
| L1 | Outils basiques — ×1.2 efficacité usines |
| L2 | Machines industrielles — ×1.5 usines |
| L3 | Robots industriels — ×1.8 usines, débloque Militaire Tier 3 |
| L4 | Automatisation avancée — ×2.2 usines, -20 % coûts entretien usines |
| L5 | Nano-manufacturing IA — ×2.5 usines, génère brevets automatiquement |

**🚛 Transport**

| Niveau | Déblocage concret |
|:-:|:---|
| L1 | Camions routiers — infrastructure routière niv. 1-2 accessible |
| L2 | Réseau routier optimisé — routier niv. 3-4, +20 % capacité routière |
| L3 | Trains de fret — infrastructure ferroviaire accessible (cat. 4) |
| L4 | Cargos maritimes — infrastructure maritime accessible (cat. 4) |
| L5 | Avions cargo + logistique IA — aérien accessible, -10 % frais transactions export |

**⚔ Militaire & Cybersécurité**

| Niveau | Déblocage concret |
|:-:|:---|
| L1 | Armes conventionnelles Tier 1 — force armée de base |
| L2 | Armes avancées Tier 2 + cyberdéfense basique (+15 contre-espionnage) |
| L3 | Haute technologie Tier 3, drones, interception +20 % bombardements |
| L4 | Armement stratégique Tier 4 — ouvre le développement nucléaire |
| L5 | IA militaire & cyberguerre — attaque cyber disponible, drones autonomes |

**❤ Médical & Santé** *(débloqué au premier L2 atteint)*

| Niveau | Déblocage concret |
|:-:|:---|
| L1 | Médecine de base — -5 % mortalité |
| L2 | Vaccins & hygiène — immunité partielle pandémies, +10 % espérance de vie |
| L3 | Biotechnologie — médicaments exportables (nouveau produit commercialisable) |
| L4 | Médecine préventive — -30 % impact pollution sur santé |
| L5 | Médecine IA — quasi-élimination maladies endémiques, +max bonheur |

**💰 Finance & Commerce** *(débloqué au premier L2 atteint)*

| Niveau | Déblocage concret |
|:-:|:---|
| L1 | Marchés structurés — -5 % frais transactions commerciales |
| L2 | Finance avancée — prêts inter-joueurs, assurances disponibles |
| L3 | Marchés boursiers — spéculation sur secteurs économiques |
| L4 | Finance internationale — accords commerciaux multi-joueurs améliorés |
| L5 | Économie numérique — royalties auto sur brevets, -15 % frais transactions total |

##### 5.3 Tech pts par tour

```
TechPts = (BasePts + BonusÉducation + BonusLabs) × EfficacitéLabs / 100

BasePts        = 10   (socle universel)
BonusÉducation = NiveauÉducation × 4   (niveaux 0-10, coût = 200 × niveau actuel)
BonusLabs      = NombreLabs × 5        (max 5 labs = +25 pts)
EfficacitéLabs = 60-100 % selon entretien
```

| Profil | Calcul | TechPts/tour |
|:---|:---|:-:|
| Pays minimal (édu 0, 0 labs) | 10 × 1.0 | **10** |
| Pays moyen (édu 3, 2 labs) | (10+12+10) × 0.95 | **30** |
| Pays spécialisé (édu 7, 4 labs) | (10+28+20) × 1.0 | **58** |
| Pays max (édu 10, 5 labs) | (10+40+25) × 1.0 | **75** |

##### 5.4 Progression dans un domaine

Chaque tour, si le domaine D est sélectionné : `AccumuléD += TechPts`

**Seuils de déblocage :**

| Transition | Pts accumulés dans le domaine | Turns à 10 pts | Turns à 30 pts |
|:-:|:-:|:-:|:-:|
| L1 → L2 | 50 pts | 5 tours | 2 tours |
| L2 → L3 | 150 pts (+100) | 10 tours de plus | 4 tours de plus |
| L3 → L4 | 350 pts (+200) | 20 tours de plus | 7 tours de plus |
| L4 → L5 | 650 pts (+300) | 30 tours de plus | 10 tours de plus |

*Un pays sans investissement éducatif (10 pts/tour) peut atteindre L3 dans un domaine en 15 tours dédiés. Un pays spécialisé (30 pts/tour) peut maxer un domaine en ~23 tours.*

##### 5.5 Avantage temporaire du premier à débloquer

```
Si premier joueur à atteindre niveau N dans domaine D :
    BonusFirstMover = +10 % efficacité sur ce niveau pendant 5 tours
    [Message global : "🏆 {Pays} ouvre la voie en {Domaine} niv.{N} !"]

Effet diffusion pour les suivants :
    Seuil réduit de 20 % pour le même niveau (déjà connu, plus facile à reproduire)
```

Exemple : si le premier débloque Transport L3 (seuil 150 pts), les suivants n'ont besoin que de **120 pts**.

##### 5.6 Brevets

Le découvreur d'un niveau peut déposer un brevet sur la technologie. Les autres joueurs qui veulent utiliser la même technologie doivent payer des **royalties passives** à chaque tour. Un joueur peut refuser de payer, mais sa technologie se dégrade alors de -10 % d'efficacité par tour jusqu'au paiement ou au développement d'une alternative propre.

Les royalties sont librement négociées (montant fixé par le détenteur du brevet au moment du dépôt). Les brevets expirent après **15 tours**.

##### 5.7 Obsolescence des laboratoires

```
Si EntretienLabsPayé = VRAI  → EfficacitéLabs -= 1 % (usure naturelle)
Si EntretienLabsPayé = FAUX  → EfficacitéLabs -= 8 %
EfficacitéLabs = max(60 %, EfficacitéLabs)  ← plancher, jamais inutilisables

Coût construction lab = 600
Entretien = 1.5 % du coût = 9 / lab / tour
```

Avec entretien régulier, les labs se maintiennent à 80-90 % d'efficacité sur la durée. Sans entretien sur 5 tours, chute vers le plancher de 60 %.

##### 5.8 Modale "Recherche & Innovation"

```
┌──────────────────────────────────────────────────────────────────────┐
│  RECHERCHE & INNOVATION                                        [X]  │
│──────────────────────────────────────────────────────────────────────│
│  🔬 Tech pts ce tour : 30 pts      │  Labs : 2/5 — Efficacité 91 %  │
│  Éducation : Niv. 3 → +12 pts/t   │  Entretien labs : [Payer 18]   │
│──────────────────────────────────────────────────────────────────────│
│  DOMAINE ACTIF CE TOUR : [🚛 Transport ▼]  ← 1 seul domaine/tour   │
│  Progression : 120 / 150 pts → L3 dans 1 tour  [████████████░░] 80 %│
│  ⭐ Si premier : +10 % bonus Trains pendant 5 tours                 │
│──────────────────────────────────────────────────────────────────────│
│  TOUS LES DOMAINES                                                   │
│  Domaine            │ Niv. │   Progression    │  Prochain │  Statut │
│─────────────────────┼──────┼──────────────────┼───────────┼─────────│
│  🚛 Transport       │  L2  │ 120 / 150 pts    │ L3 — 1 T  │  Actif  │
│  ⛏  Extraction      │  L3  │ 350 / 350 ✓      │ L4 — 7 T  │    —    │
│  🌾 Agriculture     │  L2  │  60 / 150 pts    │ L3 — 3 T  │    —    │
│  🏭 Industrie       │  L3  │ 350 / 350 ✓      │ L4 — 7 T  │    —    │
│  ⚔  Militaire       │  L1  │  20 / 50  pts    │ L2 — 1 T  │    —    │
│  ❤  Médical (nv!)   │  L1  │   0 / 50  pts    │ L2 — 2 T  │    —    │
│  💰 Finance (nv!)   │  L1  │   0 / 50  pts    │ L2 — 2 T  │    —    │
│──────────────────────────────────────────────────────────────────────│
│  BREVETS ACTIFS : 2                                                  │
│  • "Foreuse pétrolière" (Extraction L3) → Royalties : +45/tour     │
│  • "Mécanisation agricole" (Agriculture L3) → Royalties : +22/tour │
│──────────────────────────────────────────────────────────────────────│
│  ÉDUCATION                                                           │
│  Niv. 3 → 4 : [Investir 600]   Qualif. pop : +15 % productivité    │
│  [Construire un lab (+5 pts/tour) : 600]                            │
└──────────────────────────────────────────────────────────────────────┘
```

*`(nv!)` = domaine nouvellement débloqué. Domaines à 0 pts non sélectionnés = grisés. `[Payer]` labs ne consomme pas d'action tour.*

##### 5.9 Ratios de référence — Recherche

| Paramètre | Valeur |
|:---|:-:|
| Tech pts base (sans éducation, sans labs) | 10/tour |
| Tech pts max (édu 10, 5 labs) | 75/tour |
| Seuil L2 | 50 pts |
| Seuil L3 | 150 pts |
| Seuil L4 | 350 pts |
| Seuil L5 | 650 pts |
| Réduction seuil pour les suivants | -20 % |
| Bonus first-mover | +10 % efficacité, 5 tours |
| Coût construction lab | 600 |
| Entretien lab | 9/tour |
| Plancher efficacité labs | 60 % |
| Durée des brevets | 15 tours |
| Dégradation sans paiement royalties | -10 % efficacité/tour |

#### 6. Outils

Les outils sont des multiplicateurs d'efficacité appliqués aux usines. Ils n'ont pas de type spécifique par usine — un jeu d'outils s'applique à **toutes** les usines du pays. Trois tiers existent, chacun nécessitant un niveau de recherche Industrie minimum. Les outils s'usent progressivement et doivent être renouvelés.

##### 6.1 — Trois tiers d'outils

| Tier | Recherche requise | Multiplicateur | Coût achat | Durée de vie | Entretien/tour |
|:---|:---|:-:|:-:|:-:|:-:|
| 🔨 **Basiques** | Industrie L1 | × 1.2 | 300 | 8 tours | 15 |
| ⚙ **Avancés** | Industrie L2 | × 1.5 | 700 | 12 tours | 30 |
| 🤖 **Robotisés** | Industrie L3 | × 2.0 | 1 500 | 16 tours | 60 |

Un pays ne peut utiliser qu'**un seul tier d'outils à la fois**. Passer au tier supérieur remplace les outils existants (pas de bonus cumulatif).

##### 6.2 — Dégradation et usure

```
Si EntretienPayé = VRAI  → Efficacité -= 1 %/tour (usure normale)
Si EntretienPayé = FAUX  → Efficacité -= 8 %/tour (dégradation rapide)
Si Âge > DuréeVie       → Efficacité -= 15 %/tour supplémentaire
Efficacité = max(50 %, Efficacité)   ← plancher : outils jamais totalement inutilisables
```

Le multiplicateur effectif se calcule ainsi :
```
MultiplierEffectif = MultiplierTier × (EfficacitéOutils / 100)
Exemple (Avancés à 85 %) : 1.5 × 0.85 = 1.275 effectif
```

##### 6.3 — Impact sur la production

Les outils multiplient la production **après** le calcul du tier d'usine :
```
ProductionFinale = ProductionBase × MultiplierTierUsine × MultiplierOutils
Exemple : Aciérie Avancée (×1.5) + Outils Robotisés (×2.0 à 90 %) = ×2.7 effectif
```

##### 6.4 — Modale "Outils de production"

```
┌──────────────────────────────────────────────────────────────────┐
│  OUTILS DE PRODUCTION                                     [X]   │
│──────────────────────────────────────────────────────────────────│
│  Tier actuel  : ⚙ Avancés    Efficacité : 85 %                 │
│  Âge          : 7 / 12 tours  ██████████████░░░░░░░░            │
│  Entretien    : 30/tour  [Payer]                                 │
│  Dégradation si non-entretien : -8 %/tour                       │
│──────────────────────────────────────────────────────────────────│
│  Multiplicateur effectif actuel : × 1.275                       │
│  (1.5 × 85 %)                                                   │
│──────────────────────────────────────────────────────────────────│
│  AMÉLIORER :                                                     │
│  [🤖 Passer aux Robotisés — 1 500 M$]  (nécessite Industrie L3) │
│  → Multiplier passerait de ×1.5 à ×2.0 (×2.7 avec efficacité)  │
│──────────────────────────────────────────────────────────────────│
│  🟡 Alerte : 5 tours avant remplacement recommandé              │
└──────────────────────────────────────────────────────────────────┘
```

#### 7. Finance & Budget

Un seul chiffre d'argent toujours visible en haut d'écran : **Argent : X M$**. Pas de monnaie à gérer, pas de taux de change. L'inflation et la dette tournent en fond automatiquement — le joueur reçoit une alerte si la situation déraille, sans rien avoir à configurer.

Les cotisations d'organisations internationales sont calculées sur le PIB réel, empêchant toute manipulation pour esquiver les contributions.

##### 7.1 Emprunter à un autre joueur

Le joueur envoie une demande privée à un autre joueur : montant souhaité + taux d'intérêt proposé (% par tour). Le destinataire accepte ou refuse. Si accepté : l'argent arrive immédiatement dans le compte de l'emprunteur. Les intérêts sont déduits automatiquement chaque tour jusqu'au remboursement. Le remboursement est manuel, total ou partiel, à tout moment.

```
IntérêtsDus/tour = MontantRestant × TauxIntérêt/100
Argent -= IntérêtsDus   (déduction automatique en fin de tour)
```

##### 7.2 Proposer un prêt à un autre joueur

Le joueur propose activement un prêt à n'importe quel autre joueur : montant + taux d'intérêt par tour. Le destinataire accepte ou refuse. Si accepté : l'argent part immédiatement du compte du prêteur, les intérêts arrivent automatiquement chaque tour. Le prêteur peut **rappeler le prêt** (total ou partiel) à tout moment : l'argent revient, les intérêts s'arrêtent.

```
IntérêtsReçus/tour = MontantPrêté × TauxIntérêt/100
Argent += IntérêtsReçus   (crédit automatique en fin de tour)
```

##### 7.3 Vue budget — moyennes sur 10 tours

La modale affiche les moyennes calculées sur les 10 derniers tours. Si moins de 10 tours joués, moyenne sur les tours disponibles. Lecture seule, pas d'action possible ici.

##### 7.4 Alertes automatiques

- **« Déficit depuis X tours »** : si les dépenses dépassent les recettes pendant 3 tours consécutifs.
- **« Dette élevée »** : si les intérêts cumulés dépassent 10 % du PIB par tour.
- **« Prêt rappelé par {Pays} »** : notification immédiate si un prêteur rappelle son argent.

##### 7.5 Modale "Finance & Budget"

```
┌──────────────────────────────────────────────────────────────────┐
│  FINANCE & BUDGET                                          [X]  │
│──────────────────────────────────────────────────────────────────│
│  💰 Argent actuel : 12 450 M$                                   │
│  [Emprunter]      [Proposer un prêt]      [Rembourser / Recevoir]│
│──────────────────────────────────────────────────────────────────│
│  MOYENNE SUR 10 DERNIERS TOURS                                   │
│                                                                  │
│  GAGNÉ : +3 200 M$/tour                                         │
│    Exports commerciaux   +1 800                                  │
│    Tourisme net           +900                                   │
│    Taxes & revenus        +300                                   │
│    Intérêts reçus (prêts) +200                                   │
│                                                                  │
│  DÉPENSÉ : -2 800 M$/tour                                       │
│    Entretien infrastructures  -1 200                             │
│    Recherche & labs            -800                              │
│    Militaire                   -400                              │
│    Intérêts payés (dettes)     -250                              │
│    Cotisations organisations   -150                              │
│                                                                  │
│  SOLDE MOYEN : +400 M$/tour                                     │
│──────────────────────────────────────────────────────────────────│
│  PRÊTS EN COURS                                                  │
│  Tu dois :   Brésil 2 000 M$ @ 4 %/tour → -80 M$/tour          │
│  Tu prêtes : Japon  5 000 M$ @ 5 %/tour → +250 M$/tour         │
│              [Rappeler le prêt Japon]                            │
│──────────────────────────────────────────────────────────────────│
│  ⚠ ALERTE : Déficit depuis 2 tours. Surveille tes dépenses.    │
└──────────────────────────────────────────────────────────────────┘
```

**Sous-modales :**

```
[Emprunter] → ┌──────────────────────────────────────┐
              │ Demander un prêt à : [Brésil ▼]      │
              │ Montant : [____] M$                   │
              │ Intérêt proposé : [__] %/tour        │
              │ [Envoyer la demande]  [Annuler]       │
              └──────────────────────────────────────┘

[Proposer un prêt] → ┌──────────────────────────────────┐
                     │ Proposer à : [Japon ▼]           │
                     │ Montant : [____] M$              │
                     │ Intérêt demandé : [__] %/tour   │
                     │ [Proposer]  [Annuler]            │
                     └──────────────────────────────────┘
```

##### 7.6 Exemple concret — prêt entre joueurs

**Tour 10 :** Joueur A propose 5 000 M$ à Joueur B @ 5 %/tour.
- B accepte → 5 000 M$ quittent le compte de A immédiatement.
- Chaque tour : B reçoit -250 M$ automatiquement (intérêts), A reçoit +250 M$.

**Tour 15 :** A rappelle le prêt.
- Les 5 000 M$ (capital restant) reviennent dans le compte de A.
- Les intérêts s'arrêtent immédiatement.
- B reçoit une notification : « Japon a rappelé son prêt de 5 000 M$ ».

**Bilan A sur 5 tours :** +250 × 5 = **+1 250 M$ d'intérêts perçus** avant rappel.
**Bilan B sur 5 tours :** a disposé de 5 000 M$ pendant 5 tours, coût total **-1 250 M$ d'intérêts**.

##### 7.7 Ratios de référence — Finance

| Paramètre | Valeur |
|:---|:-:|
| Seuil alerte déficit | 3 tours consécutifs en négatif |
| Seuil alerte dette élevée | Intérêts > 10 % PIB/tour |
| Intérêts calculés sur | Montant restant dû (pas le montant initial) |
| Rappel prêt | À tout moment, par le prêteur uniquement |
| Remboursement | À tout moment, total ou partiel, par l'emprunteur |
| Cotisations organisations | Calculées sur PIB réel (anti-manipulation) |

#### 8. Infrastructures Critiques

Un seul paramètre résume l'état de toutes les infrastructures nationales (électricité, eau, internet, routes, ports) : le **Niveau Infrastructures Global (0–100 %)**. Ce niveau donne un boost multiplicateur appliqué à toute l'économie — usines, trades, recherche. Sans entretien, il baisse lentement. L'impact santé est très lent et ne devient perceptible qu'après une longue négligence.

**Affiché en permanence dans le Dashboard National :**
`Infrastructures : 78 % (+39 % boost global)`

##### 8.1 Boost global

```
Boost = Niveau × 0.5 %
```

| Niveau | Boost global |
|:-:|:-:|
| 20 % | +10 % |
| 50 % | +25 % |
| 78 % | +39 % |
| 100 % | +50 % *(maximum)* |

Le boost s'applique simultanément à : productivité des usines, vitesse des exports, efficacité de la recherche.

##### 8.2 Entretien et dégradation

```
Entretien/tour = PIB × (0.5 % + Niveau × 0.015 %)

Exemples :
  Niveau 0   → 0.5 % PIB/tour   (infra quasi inexistante)
  Niveau 50  → 1.25 % PIB/tour
  Niveau 100 → 2.0 % PIB/tour   (maximum)
```

```
Si EntretienPayé = FAUX :
    Dégradation = -(0.5 % + Niveau / 200)
    Exemples :
      Niveau 40  → -0.7 %/tour
      Niveau 80  → -0.9 %/tour
      Niveau 100 → -1.0 %/tour
```

Le niveau ne peut pas descendre en dessous de 5 % (infrastructures minimales toujours présentes).

##### 8.3 Pollution et impact santé (très lent)

```
PollutionAjoutée/tour = Niveau / 500

Exemples :
  Niveau 40  → +0.08 pts/tour
  Niveau 80  → +0.16 pts/tour
  Niveau 100 → +0.20 pts/tour
```

```
PerteEspéranceVie/tour = PollutionCumulée / 3 000
```

Impact très long terme : imperceptible à court terme, signal d'avertissement à horizon 30-40 tours.

##### 8.4 Modale "Infrastructures Critiques"

```
┌──────────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURES CRITIQUES                                 [X]  │
│──────────────────────────────────────────────────────────────────│
│  📊 Niveau actuel : 78 %                                        │
│     [████████████████░░░░] 78 / 100                             │
│  ⚡ Boost global : +39 %  (usines, trades, recherche)           │
│──────────────────────────────────────────────────────────────────│
│  Entretien ce tour : 1.17 % PIB (117 M$)   [Payer]             │
│  Dégradation si non-entretien : -0.89 %/tour                   │
│  Pollution ajoutée : +0.156 pts/tour                            │
│  Impact santé (long terme) : négligeable ce tour                │
│──────────────────────────────────────────────────────────────────│
│  [Améliorer (+5 niveaux : 250 M$)]                              │
│──────────────────────────────────────────────────────────────────│
│  ALERTES :                                                       │
│  🟢 Niveau stable — infrastructures en bon état                │
└──────────────────────────────────────────────────────────────────┘
```

**Alertes :**
- 🟢 Vert : Niveau ≥ 50 % et entretien payé
- 🟡 Orange : Niveau < 50 % — « Infrastructures faibles – boost réduit »
- 🔴 Rouge : Dégradation active depuis 3+ tours — « Infrastructures s'usent – entretien nécessaire »

##### 8.5 Exemple concret — Niveau 40 % → 80 % sur 10 tours

**Point de départ (Niveau 40 %) :**

| Paramètre | Valeur |
|:---|:-:|
| Boost global | +20 % |
| Entretien/tour (PIB 8 000) | 88 M$/tour *(1.1 % PIB)* |
| Dégradation sans entretien | -0.7 %/tour |
| Pollution ajoutée | +0.08 pts/tour |

**Après 10 tours d'amélioration (Niveau 80 %) :**

| Paramètre | Valeur |
|:---|:-:|
| Boost global | +40 % |
| Entretien/tour (PIB 10 000) | 170 M$/tour *(1.7 % PIB)* |
| Dégradation sans entretien | -0.9 %/tour |
| Pollution ajoutée | +0.16 pts/tour |

**Impact santé sur ces 10 tours :**
- Pollution moyenne : ~0.12 pts/tour × 10 = 1.2 pts cumulés
- Perte espérance vie : 1.2 / 3 000 = **0.04 %** — parfaitement négligeable.

**Ce que gagne le joueur :** le boost passe de +20 % à +40 %, soit une augmentation nette de toute la production et des exports. Sur un pays à 10 000 M$ de PIB, un gain de +20 % supplémentaires de productivité représente ~2 000 M$ de valeur ajoutée par tour.

##### 8.6 Ratios de référence — Infrastructures

| Paramètre | Valeur |
|:---|:-:|
| Boost max (Niveau 100 %) | +50 % global |
| Entretien min (Niveau 0) | 0.5 % PIB/tour |
| Entretien max (Niveau 100) | 2.0 % PIB/tour |
| Dégradation sans entretien (Niv. 50) | -0.75 %/tour |
| Pollution max (Niveau 100) | +0.2 pts/tour |
| Plancher du niveau | 5 % *(non franchissable)* |
| Seuil alerte orange | Niveau < 50 % |
| Seuil alerte rouge | Dégradation active 3+ tours |

### Couche 3 — Social et Diplomatique

#### 9. Tourisme et Attractivité

Les touristes étrangers génèrent des revenus passifs proportionnels aux monuments construits, au bonheur du pays et à la réputation internationale. La fuite de capitaux (citoyens vacancent à l'étranger) diminue à mesure que l'attractivité monte. Le tourisme est plafonné à **20 % du PIB** par tour. Les monuments offrent des rendements décroissants par tier.

Le bannissement d'un pays est une arme diplomatique : on perd les revenus touristiques de ce pays, mais ses citoyens subissent un malus bonheur proportionnel au poids économique du pays qui bannit. Le bannissement coûte -5 % d'influence au bannisseur (acte hostile perçu par la communauté internationale).

Le système repose sur trois sous-catégories avec des rôles distincts : les monuments attirent les touristes (flux entrant), les hôtels définissent la capacité d'accueil (goulot si insuffisants), les parcs naturels absorbent la pollution et compensent les malus bonheur des hôtels.

##### 9.1 Sites historiques — attractivité progressive

Chaque monument construit monte en attractivité automatiquement à chaque tour, sans action supplémentaire du joueur. L'attractivité est plafonnée par type.

```
Attractivité(M) = min(AttractivitéMax, Tours_depuis_construction × Taux(M))
```

| Type | Coût | Taux croissance | Attractivité max | Entretien/tour |
|:---|:-:|:-:|:-:|:-:|
| Basique (statue, tour) | 800 | +0.5 %/tour | 15 % | 8 |
| Avancé (palais, musée) | 1 800 | +1.0 %/tour | 25 % | 27 |
| Légendaire (merveille) | 4 000 | +1.5 %/tour | 35 % | 80 |

**Rendements décroissants par tier** : chaque monument supplémentaire du même tier vaut 70 % du précédent.

```
Attractivité_Total = Σ Attractivité(M) × (0.7 ^ rang_dans_tier)
Attractivité_Total = min(50 %, Attractivité_Total)   ← plafond absolu global
```

##### 9.2 Infrastructures tourisme — capacité d'accueil

Sans hôtels, l'attractivité des monuments ne se convertit pas en revenus (touristes sans hébergement). Chaque hôtel augmente la capacité mais génère un malus bonheur local et de la pollution.

| Niveau hôtel | Coût | Capacité | Malus bonheur/tour | Pollution/tour | Entretien/tour |
|:---|:-:|:-:|:-:|:-:|:-:|
| L1 | 600 | 15 % | -0.2 % | +2 pts | 18 |
| L2 | 1 400 | 30 % | -0.5 % | +4 pts | 42 |
| L3 | 3 000 | 50 % | -1.0 % | +6 pts | 90 |

```
CapacitéHôtels = Σ Capacité(H)   ← somme de tous les hôtels construits
```

Si `CapacitéHôtels < Attractivité_Total` : alerte « goulot – X % d'attractivité perdue ». Aucun blocage forcé, mais revenus réduits.

##### 9.3 Parcs naturels — compensation pollution et bonheur

Les parcs absorbent de la pollution en continu et donnent un bonus bonheur. Ils ne génèrent pas de revenus directs mais contrebalancent les externalités des hôtels et de l'industrie.

| Niveau parc | Coût | Absorption pollution/tour | Bonus bonheur/tour | Entretien/tour |
|:---|:-:|:-:|:-:|:-:|
| L1 | 400 | -2 pts | +0.3 % | 4 |
| L2 | 900 | -4 pts | +0.6 % | 9 |
| L3 | 2 000 | -8 pts | +1.2 % | 20 |

```
PollutionNette = PollutionIndustrielle + PollutionHôtels - AbsorptionParcs
```

##### 9.4 Flux financiers

**Revenue touristique entrant :**

```
AttractivitéEffective = min(Attractivité_Total, CapacitéHôtels)
RevenuTourisme = (AttractivitéEffective / 100) × PIB × (Bonheur / 100)
RevenuTourisme = min(RevenuTourisme, PIB × 20 %)   ← plafond 20 % PIB
```

**Fuite de capitaux sortant :**

```
TauxFuite = max(0.5 %, 2 % - Attractivité_Total × 0.1 %)
FuiteCapitaux = PIB × TauxFuite
```

| Attractivité totale | Taux fuite | Fuite (PIB 10 000) |
|:-:|:-:|:-:|
| 0 % | 2.0 % | -200/tour |
| 10 % | 1.0 % | -100/tour |
| 17.5 %+ | 0.5 % | -50/tour *(plancher permanent)* |

##### 9.5 Modale "Tourisme & Attractivité"

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOURISME & ATTRACTIVITÉ                                      [X]  │
│─────────────────────────────────────────────────────────────────────│
│  🌍 Attractivité totale : 17.5 %   │  🏨 Capacité hôtels : 15 %   │
│  ⚠ Goulot : hôtels saturés (2.5 % attractivité perdue)            │
│  💰 Entrants : +1 125/tour   ✈ Sortants : -50/tour   NET : +1 075 │
│  Plafond PIB : 11.3 % utilisé sur 20 % max                         │
│─────────────────────────────────────────────────────────────────────│
│  SITES HISTORIQUES                                                  │
│  Monument          │ Type      │ Attract.act.│  Max │Croiss.│ Entr.│
│────────────────────┼───────────┼─────────────┼──────┼───────┼──────│
│  Tour de la Cité   │ Basique   │  7.5 %      │ 15 % │+0.5 % │ [8] │
│  Palais Impérial   │ Avancé    │ 10.0 %      │ 25 % │+1.0 % │ [27]│
│─────────────────────────────────────────────────────────────────────│
│  PARCS NATURELS                                                     │
│  Parc              │ Niv.│ Absorbe/tour │ +Bonheur/tour │  Entr.   │
│────────────────────┼─────┼──────────────┼───────────────┼──────────│
│  Parc des Séquoias │  L1 │   -2 pts     │    +0.3 %     │   [4]   │
│─────────────────────────────────────────────────────────────────────│
│  INFRASTRUCTURES TOURISME                                           │
│  Infra             │ Niv.│ Capacité │ -Bonheur/tour │ +Pollu.│Entr.│
│────────────────────┼─────┼──────────┼───────────────┼────────┼─────│
│  Grand Hôtel Est   │  L1 │   15 %   │    -0.2 %     │ +2 pts │ [18]│
│─────────────────────────────────────────────────────────────────────│
│  BILAN CE TOUR :                                                    │
│  Bonheur net : +0.1 %/tour   │  Pollution nette : 0 pts/tour       │
│─────────────────────────────────────────────────────────────────────│
│  CONSTRUIRE : [Monument basique : 800]   [Monument avancé : 1 800]  │
│               [Hôtel L1 : 600]           [Parc naturel L1 : 400]   │
│─────────────────────────────────────────────────────────────────────│
│  PAYS BANNIS : Aucun      [Bannir un pays (-5 % influence)]        │
└─────────────────────────────────────────────────────────────────────┘
```

##### 9.6 Ratios de référence — Tourisme

| Paramètre | Valeur |
|:---|:-:|
| Plafond revenu tourisme | 20 % du PIB/tour |
| Plafond attractivité totale | 50 % |
| Rendement décroissant (même tier) | ×0.7 par monument suivant |
| Fuite capitaux (0 % attractivité) | 2 % PIB/tour |
| Fuite capitaux (plancher) | 0.5 % PIB/tour |
| Attraction basique max (20 tours) | 10 % |
| Malus bonheur hôtel max (L3) | -1.0 %/tour |
| Absorption parc max (L3) | -8 pts pollution/tour |
| Bonus bonheur parc max (L3) | +1.2 %/tour |
| Bannissement | -5 % influence pour le bannisseur |

#### 10. Santé, Environnement et Sanctions

##### 10.1 — Santé publique (paramètre unique 0–100 %)

Un seul curseur représente le niveau global du système de santé. Il agrège hôpitaux, médecins, médicaments — sans les gérer séparément.

**Effets du niveau de Santé :**

| Niveau | Boost productivité | Bonheur passif |
|:---:|:-:|:-:|
| 0–20 % | 0 % | −10 % |
| 21–50 % | +Santé × 0.2 % | 0 % |
| 51–80 % | +Santé × 0.25 % | +5 % |
| 81–100 % | +Santé × 0.30 % (max +30 %) | +10 % |

**Entretien par tour :** `EntretienSanté = PIB × (0.30 % + Santé × 0.010 %)`
→ À Santé 100 : 1.30 % du PIB/tour.

**Dégradation sans entretien :** `−(0.3 % + Santé/300) par tour`, plancher 5 %.

**Impact de la pollution sur la Santé :**
```
MalusSanté = PollutionTotale / 20   (pts de Santé perdus/tour)
```
→ 60 pts de pollution = −3 % de Santé/tour. Lent, cumulatif.

##### 10.2 — Pollution (paramètre dérivé)

La pollution n'est **pas** un paramètre que le joueur investit directement : c'est la somme des émissions de ses secteurs (industrie, transport, élevage, mines, infrastructures). Elle s'accumule dans un compteur global.

**Sources et taux par tour** (rappels des formules sectorielles) :

| Secteur | Formule |
|:---|:---|
| Industrie | `Niveau_usine × TauxIndustriel` |
| Transport | `Niveau(T) × TauxPollution(T) × (Efficacité/100)` |
| Élevage / Mines | `Niveau × TauxSectoriel` |
| Infrastructures critiques | `Niveau/500 pts/tour` |
| Parcs naturels | `−2 pts absorption/parc/tour` |

**Effets de la pollution cumulée :**

```
MalusBonheur   = PollutionTotale / 30   (pts de Bonheur perdus/tour)
MalusSanté     = PollutionTotale / 20   (pts de Santé perdus/tour)
P(Catastrophe) = PollutionTotale × 0.04 % / tour
```

→ À 100 pts de pollution : −3.3 % bonheur/tour, −5 % santé/tour, 4 % de chance de catastrophe par tour.

**Pollution transfrontalière :** si la pollution d'un joueur dépasse 80 pts, ses voisins adjacents subissent −2 à −5 % santé/tour (selon le différentiel de pollution). Cela crée une pression diplomatique naturelle.

##### 10.3 — Crédits carbone

Un pays dont la pollution totale est **inférieure à 20 pts** génère des crédits carbone à vendre.

```
CréditsCarboneGénérés = (20 − PollutionTotale) × 0.5 crédits/tour
```

Un acheteur de crédits réduit son compteur de pollution de `CréditsCarboneAchetés / 2` points pour ce tour. Prix fixé librement par le vendeur. Les crédits sont échangés via le marché standard.

**Équilibre :** les pays très verts (pollution < 10) deviennent des exportateurs de crédits carbone — un archétype stratégique viable sans industrie lourde.

##### 10.4 — Environnement et catastrophes climatiques

Les catastrophes sont tirées du pool d'événements aléatoires (§5 — Événements aléatoires) avec une probabilité modulée par la pollution :

| Pollution totale | Probabilité catastrophe/tour |
|:-:|:-:|
| 0–20 pts | 0 % |
| 21–40 pts | 0.8 % |
| 41–60 pts | 2.0 % |
| 61–80 pts | 3.2 % |
| 81–100 pts | 4.8 % |
| > 100 pts | 6 % + (surplus × 0.04 %) |

Types de catastrophes climatiques : inondation (−15–25 % production agricole, 3 tours), sécheresse (−20 % rendement agricole, 4 tours), tempête industrielle (−10–15 % capacité d'une usine, 2 tours). Jamais éliminatoire, toujours localisé à une région.

##### 10.5 — Sanctions économiques

Les sanctions sont **toujours volontaires, jamais automatiques**. Le mécanisme en 3 étapes :

1. **Preuve obtenue** (espionnage ou preuve publique automatique — ex : champignon atomique)
2. **Présentation publique** : le joueur lésé présente la preuve à la table — tous les joueurs voient
3. **Décision libre** de chaque joueur : sanctionner ou non

**Conséquences du refus :**
- Refuser de sanctionner avec **preuve irréfutable** → −20 % bonheur (indignation populaire)
- Refuser avec **simple soupçon** → aucune pénalité

**Sanction bilatérale :** le joueur lésé impose +30 % de prix sur tous les échanges avec le coupable. Aucun accord commercial n'est possible tant que la sanction est active.

**Sanctions collectives via organisation :** le commerce perdu par les membres sanctionneurs est partiellement redistribué entre eux (+X % de préférence commerciale intra-organisation pendant la durée des sanctions).

**Modal "Tableau de Santé & Environnement" :**

```
╔══════════════════════════════════════════════════════════════════╗
║  ❤  SANTÉ & ENVIRONNEMENT                                       ║
╠═══════════════════════════╦══════════════════════════════════════╣
║  Santé publique    68 %   ║  Pollution totale           43 pts  ║
║  ████████████████░░░░     ║  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░           ║
║  Boost prod.     +17.0 %  ║  Malus bonheur       −1.4 %/tour   ║
║  Entretien/tour   1.98 %  ║  Malus santé         −2.2 %/tour   ║
║  Dégradation si non ent.  ║  P(Catastrophe)          1.7 %/tour ║
║    −0.53 %/tour           ║                                      ║
╠═══════════════════════════╩══════════════════════════════════════╣
║  Sources de pollution ce tour :                                  ║
║    Industrie          +18 pts   Transport         +12 pts        ║
║    Élevage             +8 pts   Mines              +7 pts        ║
║    Absorption parcs    −2 pts   Net                +43 pts       ║
╠══════════════════════════════════════════════════════════════════╣
║  Crédits carbone : ─  (pollution > 20, non éligible)            ║
╠══════════════════════════════════════════════════════════════════╣
║  Alertes :                                                       ║
║  ⚠ Pollution en hausse depuis 3 tours — risque catastrophe      ║
║  ℹ Voisin Royaume de Bal. pollue à 85 pts — impact santé −3 %  ║
╚══════════════════════════════════════════════════════════════════╝
```

#### 11. Organisations internationales

Créées par 3 joueurs minimum via un vote à la majorité. Trois types : commerciale (bonus échanges), militaire (défense collective), diplomatique (médiation, influence). Chaque membre verse une cotisation automatique de 0.5 à 2 % du PIB réel par tour, avec un popup de rappel et option de quitter.

L'expulsion d'un membre requiert l'unanimité de tous les autres membres sauf maximum 1 voix contre. Le départ volontaire est possible à tout moment (coût : 1 tour de cotisation). Les modifications structurelles (frais de transaction internes, taux de cotisation) requièrent une majorité renforcée de 80 % des membres pour éviter le vote prédateur d'une coalition autosuffisante contre les membres dépendants du commerce. Les accords commerciaux ponctuels et investissements communs sont votés à la majorité simple. Aucun leader fixe : toutes les décisions passent par le vote.

En cas d'alliance militaire : quand un membre est attaqué, les autres doivent voter pour intervenir ou non. L'intervention confère +10-15 % d'efficacité au défenseur et coûte 5 % du PIB à l'allié intervenant. La non-intervention entraîne l'expulsion automatique de l'alliance et un malus de -10 % bonheur.

### Couche 4 — Conflit

#### 12. Forces Armées et Renseignement

##### 12.1 — Développement des forces

Deux axes de développement indépendants, chacun sur une échelle de 0 à 100. L'entretien militaire est exponentiel au-dessus de 50 : un niveau 80 consomme 20-25 % du PIB en maintenance, forçant le choix entre puissance militaire et diversification économique.

Le renseignement défensif offre un bonus passif d'intelligence commerciale : à chaque tranche de 20 points, le joueur voit une information supplémentaire sur les échanges des autres joueurs (qui commerce avec qui, à quel prix).

##### 12.2 — Composition concrète de l'armée

L'armée est composée de trois types d'unités concrètes dont la somme détermine le score FA effectif :

| Type | Coefficient FA | Rôle tactique |
|:---|:-:|:---|
| Infanterie | 1 pt FA / 1 000 unités | Masse, occupation, tenue de terrain |
| Chars | 4 pts FA / 1 000 unités | Percée, mobilité, pression |
| Avions | 8 pts FA / 1 000 unités | Soutien aérien, suppression défensive |

**Formule — Force effective sur un front :**

```
FA_front = [ (Inf_envoyée/1000) + (Chars_envoyés/250) + (Avions_envoyés/125) ]
           × EfficacitéMoyenneArmes (%)
```

L'efficacité des armes dépend du tier d'armement et de l'état d'entretien des équipements propriétaires.

##### 12.3 — Armement technologique

Les armes sont des équipements concrets achetés individuellement ou en lots. Elles appartiennent à l'un des trois types d'unités (infanterie, chars, avions) et à l'un des 4 tiers de technologie. Le tier de l'arme définit son **coefficient d'efficacité** : une même quantité d'infanterie avec des armes Tier 3 est nettement plus puissante qu'avec du Tier 1.

**Condition de déblocage :** le tier d'arme est lié au niveau de recherche Militaire & Cybersécurité.

| Tier | Recherche requise | Efficacité relative | Description générale |
|:---|:---|:-:|:---|
| 🔰 **Tier 1 — Conventionnel** | Militaire L1 | × 1.0 (base) | Équipement standard, en dotation dans tous les pays |
| ⚙ **Tier 2 — Avancé** | Militaire L2 | × 1.5 | Blindés modernes, chasseurs supersoniques, artillerie guidée |
| 💡 **Tier 3 — Haute technologie** | Militaire L3 | × 2.2 | Chars dernière génération, chasseurs furtifs, drones de combat |
| 🔬 **Tier 4 — Stratégique** | Militaire L4 | × 3.0 | Systèmes d'armes autonomes, bombes guidées de précision, missiles balistiques conventionnels |

---

**Catalogue d'armes achetables par type et tier :**

**🪖 Infanterie** *(unité de base : 1 000 soldats)*

| Arme | Tier | Coût (lot 1 000) | Efficacité | Entretien/tour |
|:---|:-:|:-:|:-:|:-:|
| Fusils d'assaut + équipement léger | T1 | 50 | × 1.0 | 2 |
| Tenue balistique + armes lourdes portatives | T2 | 120 | × 1.5 | 5 |
| Exosquelettes légers + armement augmenté | T3 | 280 | × 2.2 | 12 |
| Systèmes d'interface neurale + armure active | T4 | 600 | × 3.0 | 25 |

**🚀 Chars** *(unité : 1 char)*

| Arme | Tier | Coût (unité) | Efficacité | Entretien/tour |
|:---|:-:|:-:|:-:|:-:|
| Char léger / blindé infanterie (APC) | T1 | 8 | × 1.0 | 0.4 |
| Char de combat principal (MBT) | T2 | 20 | × 1.5 | 1.0 |
| Char lourd à canon electromagnétique | T3 | 45 | × 2.2 | 2.2 |
| Char autonome IA / Système de frappe blindé | T4 | 100 | × 3.0 | 5.0 |

**✈ Avions** *(unité : 1 appareil)*

| Arme | Tier | Coût (unité) | Efficacité | Entretien/tour |
|:---|:-:|:-:|:-:|:-:|
| Avion à hélice / hélicoptère d'attaque | T1 | 15 | × 1.0 | 1.2 |
| Chasseur supersonique / bombardier tactique | T2 | 40 | × 1.5 | 3.0 |
| Chasseur furtif / drone de combat avancé | T3 | 90 | × 2.2 | 7.0 |
| Bombardier stratégique / IA de combat aérien | T4 | 200 | × 3.0 | 15.0 |

---

**Intégration dans la formule FA :**

```
FA_front = [ (Inf_envoyée/1000 × EfficacitéArmeInf)
           + (Chars_envoyés × EfficacitéArmeChar / 250)
           + (Avions_envoyés × EfficacitéArmeAvion / 125) ]
```

Si un pays dispose d'armes de tiers mixtes, l'efficacité moyenne pondérée par quantité est utilisée.

---

**Modes de vente inter-joueurs :**

Le vendeur choisit entre deux modes lors d'une vente d'armes :
- **Armes ouvertes** : entretien assuré par l'acheteur lui-même (ou n'importe qui), prix plus bas, aucune dépendance.
- **Armes propriétaires** : entretien exclusif par le vendeur, prix plus élevé, coût d'entretien `2-4 % de la valeur par tour` versé automatiquement au vendeur.

Si l'entretien propriétaire est coupé (guerre, sanctions, refus de payer) : `−20 % efficacité/tour`, inutilisable après 5 tours. Le pays peut tenter un « reverse engineering » : coût `50 % du prix d'achat`, résultat en 3 tours, convertit l'arme en arme ouverte.

##### 12.4 — Fractionnement des forces — Doctrine des fronts multiples

L'armée est un **stock partagé** de trois types d'unités. Lors de la phase d'ordres, le joueur alloue librement un pourcentage de chaque type sur chaque front actif (invasion ou défense d'un allié). Les pourcentages sont **indépendants par type** : envoyer 30 % d'infanterie sur R1 n'impose rien sur les chars ou les avions. Les unités non allouées restent en garnison nationale et défendent passivement.

**Formule — Force effective sur un front :**

```
FA_front = [ (Inf_envoyée / 1 000) + (Chars_envoyés / 250) + (Avions_envoyés / 125) ]
           × EfficacitéArmes (%)
```

**Résolution du combat :**

```
Victoire si : FA_front > FA_défenseur × 1.15 × Aléa(0.80 à 1.20)
```

Le défenseur bénéficie toujours de +15 % fixe (avantage du terrain, fortifications). L'aléatoire ±20 % représente le brouillard de guerre sur la résistance réelle — jamais prévisible à 100 %. Transport maritime (bateaux) obligatoire pour atteindre une région séparée par la mer.

**Règles d'allocation :**
- Somme des % d'un même type d'unité sur tous les fronts ≤ 100 %
- Maximum 3 fronts actifs simultanément
- Chaque front supplémentaire au-delà du premier coûte 1 action additionnelle
- Maintenance calculée sur l'armée totale, indépendamment du déploiement

**Modal "Planification des opérations" :**

```
╔══════════════════════════════════════════════════════════════════╗
║  ⚔  PLANIFICATION DES OPÉRATIONS                               ║
╠══════════════════════════════════════════════════════════════════╣
║  ARMÉE TOTALE  Infanterie : 50 000  │  Chars : 10 000           ║
║                Avions : 150         │  Efficacité armes : 85 %  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  ▶ RÉGION 1 — Lystor              Mode : ⚔ Invasion            ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │           [  %  ]   Unités envoyées                      │   ║
║  │ Infanterie [ 30 ]   15 000 / 50 000  ██████░░░░░░░░░░░   │   ║
║  │ Chars      [ 40 ]    4 000 / 10 000  ████████░░░░░░░░░   │   ║
║  │ Avions     [  0 ]        0 /    150  ░░░░░░░░░░░░░░░░░   │   ║
║  │                                                           │   ║
║  │ ⚔ Force envoyée    26.4 FA  ██████████░░░░░░░░░░         │   ║
║  │ 🛡 Défense estimée  28.7 FA  ███████████░░░               │   ║
║  │ Résultat : ~30 %   [ RISQUÉ — concentre ou recule ]      │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                                                                  ║
║  ▶ RÉGION 2 — Fort Kael          Mode : 💣 Siège + Frappe      ║
║  ┌──────────────────────────────────────────────────────────┐   ║
║  │           [  %  ]   Unités envoyées                      │   ║
║  │ Infanterie [ 20 ]   10 000 / 50 000  ████░░░░░░░░░░░░░   │   ║
║  │ Chars      [  0 ]        0 / 10 000  ░░░░░░░░░░░░░░░░░   │   ║
║  │ Avions     [ 10 ]       15 /    150  ██░░░░░░░░░░░░░░░   │   ║
║  │                                                           │   ║
║  │ ⚔ Pression sol      8.5 FA  ████░░░░░░░░░░░░░░░░         │   ║
║  │ 💣 Frappe aérienne  15 avions → −15 à −20 % infra ciblée │   ║
║  │ 🛡 Défense sol est. 11.5 FA  ░░░ (FA < 50 : pas d'interc.)│   ║
║  │ Résultat : percée improbable / bombardement réussit      │   ║
║  └──────────────────────────────────────────────────────────┘   ║
║                                                                  ║
║  Réserve nationale : 25 000 inf │ 6 000 chars │ 135 avions      ║
║  [+ Ajouter un front (max 3)]        [✓ Confirmer les ordres]  ║
╚══════════════════════════════════════════════════════════════════╝
```

*Chaque champ `%` est modifiable directement (ou via slider). Le nombre absolu s'affiche en temps réel. La probabilité de victoire se recalcule à chaque changement. La réserve nationale se met à jour automatiquement en bas du modal.*

**Exemple concret — Joueur A : 50 000 inf + 10 000 chars + 150 avions (eff. 85 %)**

| | Région 1 — Lystor | Région 2 — Fort Kael | Réserve |
|:---|:-:|:-:|:-:|
| Infanterie | 30 % → 15 000 | 20 % → 10 000 | 50 % → 25 000 |
| Chars | 40 % → 4 000 | 0 % → 0 | 60 % → 6 000 |
| Avions | 0 % → 0 | 10 % → 15 | 90 % → 135 |

*Région 1 — invasion :*
```
FA_brut = (15 000/1 000) + (4 000/250) = 15 + 16 = 31
FA_eff  = 31 × 0.85 = 26.4
Défenseur FA=25 → Défense = 28.75 × Aléa(0.80–1.20)
Break-even : Aléa = 26.4 / 28.75 = 0.918
P(victoire) = (0.918 − 0.80) / 0.40 ≈ 30 %  [RISQUÉ]
```

*Région 2 — siège + frappe aérienne :*
```
Pression sol = (10 000/1 000) × 0.85 = 8.5 FA
Défenseur FA=10 → Défense sol = 11.5 × Aléa → min 9.2
Break-even : Aléa = 8.5 / 11.5 = 0.74 < 0.80 → percée impossible
Bombardement : FA_défenseur = 10 < 50 → pas d'interception
→ Frappe réussit : −15 à −20 % capacité infrastructure ciblée
```

*Lecture stratégique :* Région 1 est sous-pourvue en chars (40 % d'une armée de 10k = 4k chars). Envoyer 70 % des chars sur R1 (7 000) porterait FA_eff à 33.9 et la probabilité à ~60 %. Région 2 est une feinte armée efficace : l'infanterie cloue le défenseur, les avions font des dégâts réels sans risque de perte au sol.

**Intérêts stratégiques du fractionnement :**

| Situation | Résultat naturel |
|:---|:---|
| 80 %+ sur 1 seul front | Victoire probable si supériorité de FA |
| 50 / 50 sur 2 fronts | Sous-puissant partout → défaites probables |
| Feinte 5–10 % | Force le défenseur à mobiliser inutilement |
| 0 % en réserve | Capitale vulnérable à une contre-attaque ce même tour |
| 3 fronts à 33 % chacun | Dilution totale → défaite quasi certaine |

**Protections anti-abus :**
- Aléa borne basse 0.80 : un défenseur très faible garde une chance de tenir grâce au +15 % fixe
- 3 fronts max : pas de spam d'actions, lisibilité préservée
- Entretien sur armée totale : aucune économie à laisser des unités en réserve
- Bombardement = consommable (bombes s'épuisent) : impossible de bombarder 10 régions par tour

##### 12.5 — Bombardement conventionnel

Un pays possédant des avions (Tier 2+) et des bombes peut menacer publiquement de bombarder une infrastructure ciblée d'un pays adjacent, accompagné d'une demande (produit, accord, retrait). La cible a 1 tour pour accepter ou refuser. Si refusé, l'attaquant peut exécuter ou reculer. Un bluff sans avions/bombes entraîne -10 % influence si démasqué. Les dégâts d'un bombardement sont de -20 à -30 % de capacité sur la cible pendant 3-5 tours. Un monument bombardé est détruit définitivement. Les Forces Armées élevées (> 50) du défenseur interceptent partiellement, réduisant les dégâts de 20-40 %.

##### 12.6 — Bombe nucléaire

Nécessite recherche Tier 4 (75+), 15-20 % du PIB sur 3-5 tours de développement, 5-8 % du PIB par bombe, 1 % du PIB d'entretien par bombe par tour. Effets sur la région ciblée : destruction totale des infrastructures, -60 à -80 % population, région inutilisable 10-15 tours (radiations). Effets sur la cible : -40 % bonheur immédiat, -15 % bonheur autres régions pendant 5 tours. Effets sur l'attaquant : -50 % influence, -25 % bonheur propre, expulsion de toutes les organisations, preuve automatique (un champignon atomique se voit). Effets globaux : +15-20 % pollution mondiale, -5 % santé tous les joueurs pendant 3 tours. Riposte nucléaire possible au tour suivant si la cible possède l'arme (destruction mutuelle assurée). Le nucléaire est conçu pour être dissuasif, pas rentable : le posséder sans l'utiliser est la vraie valeur stratégique.

Les mécaniques de sabotage et de guerre sont détaillées dans la section 5 (Mécaniques transversales).

---

## 5. Mécaniques transversales

### Sabotage

Le sabotage est une opération secrète visant à endommager l'économie d'un adversaire. Chaque opération coûte 3-5 % du PIB. Les cibles sont à granularité fine : une usine spécifique, une centrale, un laboratoire — pas un secteur entier. L'effet d'un sabotage réussi est de -10 à -15 % de capacité dans le secteur ciblé pendant 2-3 tours.

**Le sabotage peut échouer.** La résolution se fait en deux étapes :

**Étape 1 — Jet de réussite** (différentiel Renseignement attaquant vs défenseur) :

| Différentiel | Chance de réussite |
|:---|:-:|
| Attaquant +30 ou plus | ~90 % |
| Attaquant +10 à +29 | ~75 % |
| Niveaux égaux | ~55 % |
| Défenseur +10 à +29 | ~35 % |
| Défenseur +30 ou plus | ~20 % |

**Étape 2a — Si réussi, jet de visibilité :**

| Différentiel | Invisible | Soupçon | Preuve irréfutable |
|:---|:-:|:-:|:-:|
| Att. +30 ou plus | 85 % | 12 % | 3 % |
| Niveaux égaux | 45 % | 35 % | 20 % |
| Déf. +30 ou plus | 5 % | 50 % | 45 % |

**Étape 2b — Si échoué :** le défenseur reçoit une alerte (« tentative de sabotage neutralisée »). Probabilité d'identifier l'attaquant : 30-60 % selon le différentiel.

**Conséquences par issue :**
- **Invisible** : dégâts appliqués, personne ne sait.
- **Soupçon** : la victime connaît l'identité. Elle peut sanctionner unilatéralement (+30 % prix des échanges avec le saboteur) ou lancer un appel public (sans preuve, pas de malus bonheur pour ceux qui ignorent).
- **Preuve** : tout le monde voit. Chaque joueur décide librement de sanctionner. Refuser malgré une preuve = -20 % bonheur.

### Guerre et invasion

La guerre est conçue pour être longue, destructrice et rarement rentable. C'est l'option de dernier recours.

**Mobilisation** : déclarer la guerre coûte immédiatement -30 % de production nationale (ouvriers mobilisés) et 15-20 % du budget militaire.

**Avantage défenseur** : +25 % d'efficacité à équipement égal.

**Durée selon le différentiel de Forces Armées :**

| Différentiel | Durée (tours) | Prob. guerre longue (≥ 15 tours) |
|:---|:-:|:-:|
| Att. +30 ou plus | 6–9 | Faible |
| Att. +10 à +29 | 10–14 | ~40 % |
| Niveaux égaux | 15–22 | 85–95 % |
| Déf. +10 ou plus | 18–25 | ~95 % |

**Force de production récupérée après victoire :**

| Durée | Force prod. restante |
|:---|:-:|
| ≤ 8 tours | 75–85 % |
| 9–14 tours | 50–65 % |
| 15–19 tours | 30–45 % |
| 20+ tours | 15–25 % |

**Régions** : chaque pays commence avec 5-6 régions. L'attaquant conquiert des régions une par une, récupérant la population et la production réduite. Les régions annexées subissent -30 % de productivité supplémentaire pendant 5 tours (résistance locale). Après la guerre, le vainqueur subit -15 % de productivité globale pendant 3-5 tours (reconstruction). Le malus bonheur est très lourd pour les deux camps et s'aggrave avec la durée, plus punitif pour l'attaquant.

**Armistice** : après 5 tours de guerre, les deux camps peuvent proposer un armistice (accord mutuel). Une organisation diplomatique peut proposer une médiation avec des termes (cession de région, réparations).

### Organisations internationales

Voir catégorie 11 pour les règles complètes. En résumé : création par 3+ joueurs, cotisation sur PIB réel, expulsion quasi unanime, départ volontaire avec pénalité d'1 tour de cotisation. Les modifications structurelles (frais de transaction, taux de cotisation) requièrent une majorité renforcée de 80 %. Les accords ponctuels et investissements communs passent à la majorité simple. Pas de leader fixe. Les alliances militaires obligent à un vote en cas d'attaque sur un membre.

### Bombardement conventionnel et menaces

Un joueur possédant des avions (Tier 2+) et des bombes peut menacer publiquement de bombarder une infrastructure d'un pays adjacent. La menace est accompagnée d'une demande (produit, accord, retrait de guerre). La cible a 1 tour pour accepter ou refuser. Si elle refuse, l'attaquant exécute le bombardement ou recule. Un bluff (menace sans avions/bombes) démasqué entraîne -10 % influence. La menace et le bombardement coûtent chacun 1 action. Les bombes sont des consommables (s'épuisent, à refabriquer). Les Forces Armées du défenseur (> 50) interceptent partiellement (-20 à -40 % dégâts).

### Bombe nucléaire

Arme de dissuasion ultime. Développement : Tier 4, 15-20 % PIB sur 3-5 tours. Fabrication : 5-8 % PIB par bombe. Entretien : 1 % PIB par bombe par tour. Utilisation : détruit une région entière (10-15 tours d'inutilisabilité), -40 % bonheur cible, -50 % influence et -25 % bonheur pour l'attaquant, expulsion de toutes les organisations, +15-20 % pollution mondiale, -5 % santé globale pendant 3 tours, preuve automatique (champignon atomique visible par tous). Riposte possible si la cible possède l'arme (destruction mutuelle assurée). Le nucléaire est anti-rentable par conception : le posséder sans l'utiliser est la vraie valeur stratégique.

### Journal d'Actualité Mondiale — « Le Monde en Bref »

Fil d'actualité satirique généré automatiquement, 1 à 3 gros titres par tour. Ton provocateur et humoristique (style Le Gorafi), pique l'ego des joueurs, crée des réactions dans le chat. Les articles commentent uniquement les événements publics (preuves de sabotage, guerres, trades publics, classement, bannissements, événements aléatoires). Jamais d'information secrète révélée. Des allusions vagues sont possibles pour créer de la paranoïa sans donner d'info exploitable. Le journal est purement cosmétique : aucun effet mécanique, uniquement de l'animation sociale. Exemples de templates : « SCANDALE — {Pays} pris la main dans le sac en sabotant {Pays}. La communauté internationale feint la surprise. » / « CLASSEMENT — {Pays} occupe fièrement la dernière place pour le 3e tour consécutif. 'C'est une stratégie à long terme', affirme le dirigeant. » / « ESPIONNAGE — {Pays} tente de saboter {Pays} et se fait attraper comme un stagiaire. »

### Événements aléatoires

1 à 2 événements par tour, tirés d'un pool pondéré. Peuvent être globaux (tous les joueurs) ou locaux (un pays, pondéré par ses caractéristiques — un pays pollueur a plus de chances de subir une catastrophe climatique). Les événements ne sont jamais éliminatoires : ils perturbent, pas ils détruisent.

---

## 6. Équilibrage global

### Archétypes stratégiques et contrepoids

| Archétype | Forces | Faiblesses | Contré par |
|:---|:---|:---|:---|
| **Commerçant pacifique** | PIB élevé, bonheur max, tourisme, alliances | Vulnérable militairement | Blocus, sabotage |
| **Technocrate** | Usines efficaces, brevets, outils | Démarrage lent | Sabotage ciblé des labos |
| **Impérialiste** | Masse productive, dissuasion | Entretien ruineux, bonheur bas, isolation | Coalition défensive, sanctions |
| **Diplomate** | Réseau d'alliances, intelligence commerciale | Pas de force propre | Dissolution d'orga, trahison |
| **Espion** | Sabotage, information | PIB faible (coût opérations), risque d'exposition | Contre-espionnage, preuves |
| **Écologiste** | Bonheur max, vente crédits carbone | Production limitée | Dépendance aux acheteurs |

### Mécanismes anti-déséquilibre

- **Coûts croissants** : entretien usines, militaire exponentiel au-dessus de 50, dette, monuments à rendement décroissant. Empêche le snowball d'un seul axe.
- **Plafond autoritaire** : le militaire compense le bonheur jusqu'à -30 % max. En dessous de 20 %, révoltes incontrôlables.
- **Plafond tourisme** : 15-20 % du PIB maximum. Empêche le « paradis touristique passif ».
- **Sabotage faillible** : 20-90 % de réussite selon le différentiel. Un sabotage raté trahit l'espion.
- **Guerre destructrice** : mobilisation -30 % prod, reconstruction post-victoire, résistance régionale. Même une guerre éclair coûte cher.
- **Sanctions sociales** : refus de sanctionner malgré preuve = -20 % bonheur. Crée une pression collective naturelle.
- **Limite d'actions** : 4-6 par tour. Impossible de tout optimiser simultanément.
- **Score tri-axe** : PIB seul ne suffit pas. Un militariste avec bonheur bas et zéro influence perd face à un diplomate équilibré.
- **Coût diplomatique du bannissement** : -5 % influence pour le pays qui bannit. Empêche les bannissements gratuits par les pays non-attractifs.
- **Majorité renforcée (80 %) pour les modifications structurelles d'organisation** : empêche le vote prédateur d'une coalition de membres autosuffisants contre les membres dépendants du commerce interne.

### Ratios clés de référence

| Paramètre | Valeur |
|:---|:-:|
| Actions par tour | 4-6 |
| Plafond tourisme | 15-20 % du PIB |
| Entretien militaire (niv. 80) | 20-25 % du PIB |
| Coût par sabotage | 3-5 % du PIB |
| Réussite sabotage (niveaux égaux) | ~55 % |
| Plafond effet autoritaire | Compense jusqu'à -30 % bonheur |
| Mobilisation guerre | -30 % prod nationale |
| Reconstruction post-guerre | -15 % prod, 3-5 tours |
| Résistance annexion | -30 % prod supplémentaire, 5 tours |
| Cotisation organisation | 0.5-2 % PIB réel |
| Soutien alliance militaire | +10-15 % efficacité, coût 5 % PIB |
| Non-intervention alliance | Expulsion + -10 % bonheur |
| Refus sanction malgré preuve | -20 % bonheur |
| Pollution transfrontalière | -2 à -5 % santé voisins (seuil extrême) |
| Bannissement touristique | Malus proportionnel au poids éco du bannisseur + -5 % influence pour le bannisseur |
| Modif. frais internes orga | Majorité renforcée 80 % (anti-vote prédateur) |
| Entretien armes propriétaires | 2-4 % valeur/tour au vendeur |
| Dégradation sans entretien | -20 % efficacité/tour, inutilisable après 5 tours |
| Bombardement (dégâts) | -20 à -30 % capacité cible, 3-5 tours |
| Interception (armée > 50) | Réduit dégâts bombardement de 20-40 % |
| Bluff menace sans moyens | -10 % influence |
| Développement nucléaire | 15-20 % PIB sur 3-5 tours |
| Fabrication bombe | 5-8 % PIB par bombe |
| Entretien bombe | 1 % PIB par bombe par tour |
| Usage nucléaire (attaquant) | -50 % influence, -25 % bonheur, expulsion orgas |
| Usage nucléaire (cible) | -40 % bonheur, région inutilisable 10-15 tours |
| Usage nucléaire (global) | +15-20 % pollution, -5 % santé tous, 3 tours |

---

## 7. Catégories de produits échangeables

Chaque produit peut être commercé librement entre joueurs. Les prix sont librement négociés. Les accords d'organisation réduisent les frais de transaction entre membres.

**1. Matières premières agricoles** — Blé, riz, maïs, coton, café.

**2. Énergie** — Pétrole brut, gaz naturel, uranium, charbon, biocarburants.

**3. Minerais et métaux** — Fer, cuivre, lithium, terres rares, or.

**4. Produits manufacturés de base** — Acier, ciment, textiles, plastiques, verre.

**5. Électronique et haute technologie** — Semi-conducteurs, smartphones, serveurs, logiciels, satellites.

**6. Équipement industriel** — Machines-outils, robots industriels, turbines, équipement minier.

**7. Produits pharmaceutiques** — Vaccins, médicaments génériques, équipement médical, biotechnologie.

**8. Armement et défense** — Véhicules blindés, systèmes de défense, drones militaires, cybersécurité, munitions.

**9. Luxe et tourisme** — Monuments (construction unique), hôtellerie de luxe, produits de luxe, médias et divertissement.

**10. Services financiers** — Prêts, assurances, crédits carbone, obligations souveraines, devises.

**11. Infrastructure** — Composants réseau électrique, équipement télécom, matériaux routiers, équipement portuaire.

**12. Alimentation transformée** — Conserves, produits laitiers, boissons, surgelés, alimentation bio.

---

## 8. Événements aléatoires

| # | Événement | Portée | Effet |
|:-:|:---|:-:|:---|
| 1 | **Sécheresse** | Local | -30 % agriculture du pays touché pendant 2 tours. Pondéré par faible investissement eau. |
| 2 | **Boom technologique** | Global | +20 % efficacité recherche pour tous pendant 1 tour. |
| 3 | **Pandémie** | Global | -15 % productivité pour tous les pays avec un système de santé < 40. Les pays avec santé ≥ 70 sont immunisés. |
| 4 | **Krach boursier** | Global | -10 % valeur de toutes les monnaies. Les pays à finance élevée récupèrent en 1 tour, les autres en 3. |
| 5 | **Scandale de corruption** | Local | -15 % bonheur et -10 % réputation pour un pays (pondéré par finance basse et influence basse). |
| 6 | **Découverte minière** | Local | +1 gisement de minerai rare dans un pays. Pondéré par investissement en prospection. |
| 7 | **Marée noire** | Local | -20 % pêche/agriculture côtière + pollution +30 % pendant 3 tours. Pondéré par extraction pétrolière sans infra environnementale. |
| 8 | **Accord commercial mondial** | Global | -15 % coûts de transport pour tous pendant 2 tours. |
| 9 | **Tremblement de terre** | Local | Destruction d'une infrastructure critique aléatoire. Non pondéré (aléatoire pur). |
| 10 | **Révolution verte** | Global | Coût des investissements en énergie propre -25 % pendant 2 tours. |
| 11 | **Fuite de données** | Local | Toutes les ressources d'un pays deviennent visibles par tous pendant 1 tour. Pondéré par télécom faible. |
| 12 | **Bulle immobilière** | Local | +20 % PIB apparent pendant 2 tours, puis -15 % pendant 2 tours. Pondéré par finance spéculative. |
| 13 | **Afflux migratoire** | Local | +5 % population vers un pays à bonheur élevé. Un autre pays à bonheur bas perd -3 %. |
| 14 | **Embargo pétrolier** | Global | +40 % coût extraction pétrole pour tous pendant 2 tours. Les pays autosuffisants en énergie propre ne sont pas affectés. |
| 15 | **Innovation disruptive** | Local | 1 brevet gratuit dans un secteur aléatoire pour un pays à recherche élevée. |

---

## 9. Wireframe textuel de l'interface

### Écran principal (en jeu)

```
┌─────────────────────────────────────────────────────────────────┐
│  BARRE SUPÉRIEURE                                               │
│  [Tour 14/50]   [Timer: 1:23]   [💬 Chat]   [⚙ Paramètres]     │
├─────────────────────────────────┬───────────────────────────────┤
│                                 │  DASHBOARD NATIONAL           │
│   CARTE MONDIALE                │                               │
│                                 │  Capital: 12,450              │
│  ┌───────────────────────┐      │  PIB: 8,200 (+340)            │
│  │                       │      │  Bonheur: 72 % (↑ 2 %)       │
│  │  Carte hexagonale     │      │  Population: 14.2M            │
│  │  des pays joueurs     │      │  Influence: 1,820             │
│  │                       │      │  Score: 14,320 (#2)           │
│  │  - Couleurs par       │      │                               │
│  │    joueur             │      │  ─────────────────────────    │
│  │  - Routes commer-     │      │  LEADERBOARD                  │
│  │    ciales en trait    │      │  1. Japon ........... 16,200  │
│  │    pointillé          │      │  2. > Vous < ....... 14,320   │
│  │  - Zones de guerre    │      │  3. Brésil ......... 13,100   │
│  │    en rouge           │      │  4. France ......... 11,800   │
│  │  - Orgas = halos      │      │  5. Inde ........... 10,500   │
│  │    colorés autour     │      │                               │
│  │    des membres        │      │  ─────────────────────────    │
│  │                       │      │  RESSOURCES                   │
│  │  [Clic pays → fiche]  │      │  Pétrole  ████░░░  67 %      │
│  │  [Clic route → trade] │      │  Minerais ██░░░░░  34 %      │
│  └───────────────────────┘      │  Agri     █████░░  82 %      │
│                                 │  Eau      ████░░░  61 %      │
│                                 │                               │
│                                 │  ORGANISATIONS                │
│                                 │  🤝 Alliance Nord (5 mbr)     │
│                                 │  📊 Cotis.: 1.2 % PIB        │
│                                 │  [1 vote en cours]            │
├─────────────────────────────────┴───────────────────────────────┤
│  BARRE D'ACTIONS (Phase Choix)                       [3/6 max] │
│                                                                 │
│  [🏭 Investir]  [🔬 Recherche]  [📦 Commerce]  [🤝 Diplomatie] │
│  [🕵 Sabotage]  [🛡 Défendre]   [⚔ Guerre]     [✅ PRÊT]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Modale — Investir

```
┌──────────────────────────────────────────┐
│  INVESTIR                           [X]  │
│──────────────────────────────────────────│
│  Secteur :  [Usine ▼]  [Infra ▼]        │
│             [Énergie ▼] [Recherche ▼]    │
│                                          │
│  Sous-type : [Semi-conducteurs ▼]        │
│  Tier : Avancé (nécessite Recherche 40)  │
│  Coût : 1,200                            │
│  Entretien : +45/tour                    │
│  Effet : +8 % prod. électronique         │
│  ⚠ Pollution : +3 %                     │
│                                          │
│  [Annuler]               [Confirmer 1/6] │
└──────────────────────────────────────────┘
```

### Modale — Sabotage

```
┌──────────────────────────────────────────┐
│  OPÉRATION DE SABOTAGE              [X]  │
│──────────────────────────────────────────│
│  Cible : [Japon ▼]                       │
│  Type :  [Centrale électrique #2 ▼]      │
│                                          │
│  Coût : 620 (4.2 % PIB)                 │
│                                          │
│  Votre Renseignement : 62               │
│  Estimation défense cible : ~50 (±10)    │
│                                          │
│  ┌────────────────────────────────┐      │
│  │ Réussite estimée : ~70-80 %   │      │
│  │ Si réussi :                    │      │
│  │   Invisible : ~65 %           │      │
│  │   Soupçon : ~25 %             │      │
│  │   Preuve : ~10 %              │      │
│  │ Si raté :                      │      │
│  │   Identification : ~35 %      │      │
│  └────────────────────────────────┘      │
│                                          │
│  [Annuler]               [Confirmer 2/6] │
└──────────────────────────────────────────┘
```

### Modale — Commerce

```
┌──────────────────────────────────────────┐
│  PROPOSITION COMMERCIALE            [X]  │
│──────────────────────────────────────────│
│  Avec : [Brésil ▼]                       │
│                                          │
│  VOUS OFFREZ :         VOUS RECEVEZ :    │
│  [Pétrole ×200 ▼]     [Lithium ×50 ▼]   │
│  [+ Ajouter]           [+ Ajouter]       │
│                                          │
│  Bonus Alliance Nord : -8 % frais        │
│  Sanctions actives : Aucune              │
│                                          │
│  [Annuler]               [Proposer 3/6]  │
└──────────────────────────────────────────┘
```

### Modale — Résolution (fin de tour)

```
┌──────────────────────────────────────────┐
│  RÉSOLUTION — TOUR 14                    │
│──────────────────────────────────────────│
│  🛡 Défenses activées                    │
│  💥 Sabotage subi : Centrale #2          │
│     → -12 % énergie, 2 tours            │
│     → Auteur : INCONNU                   │
│  📦 3 échanges commerciaux exécutés      │
│  🏭 Production : +2,100                  │
│  🌍 Événement : Boom technologique !     │
│     → +20 % recherche ce tour            │
│  😊 Bonheur : 72 % → 74 %               │
│  📊 Score : 13,800 → 14,320 (#2)        │
│                                          │
│  [Voir détails]          [Tour suivant]  │
└──────────────────────────────────────────┘
```

### Modale — Organisation

```
┌──────────────────────────────────────────┐
│  ALLIANCE DU NORD (Commerciale)     [X]  │
│──────────────────────────────────────────│
│  Membres : Vous, Japon, Brésil,          │
│            Canada, Allemagne             │
│  Cotisation : 1.2 % PIB réel/tour       │
│  Trésor commun : 4,800                   │
│                                          │
│  VOTES EN COURS :                        │
│  📋 « Accord commercial interne          │
│     -15 % frais » — [Pour] [Contre]     │
│     (3/5 votes)                          │
│                                          │
│  ACTIONS :                               │
│  [Proposer un vote]                      │
│  [Quitter (coût : 1 tour cotisation)]    │
│                                          │
│  ⚠ ALERTE : Le Brésil est attaqué !     │
│  Vote défense collective :               │
│  [Intervenir (5 % PIB)]  [Refuser]      │
│  Refus → expulsion + -10 % bonheur       │
└──────────────────────────────────────────┘
```

### Modale — Guerre

```
┌──────────────────────────────────────────┐
│  DÉCLARER LA GUERRE                 [X]  │
│──────────────────────────────────────────│
│  Cible : [Inde ▼]                        │
│                                          │
│  Vos Forces Armées : 72                  │
│  Estimation cible : ~55 (±15)            │
│                                          │
│  ┌────────────────────────────────┐      │
│  │ Durée estimée : 8-12 tours     │      │
│  │ Prod. récupérable : ~55-70 %   │      │
│  │                                │      │
│  │ COÛTS IMMÉDIATS :              │      │
│  │ → -30 % production nationale   │      │
│  │ → -18 % budget militaire       │      │
│  │ → Malus bonheur : -15 %/tour   │      │
│  │                                │      │
│  │ ⚠ Alliances ennemies :         │      │
│  │   Alliance Sud (3 membres)     │      │
│  └────────────────────────────────┘      │
│                                          │
│  [Annuler]               [Déclarer 4/6]  │
└──────────────────────────────────────────┘
```

---

## 10. Suggestions d'améliorations futures et points à tester

### Points à tester en partie réelle

1. **Le ratio 4-6 actions par tour est-il suffisant ?** Si les joueurs se sentent frustrés par le manque d'actions, envisager 5-8. Si les tours sont trop longs, réduire à 3-5.

2. **La guerre éclair (+30 différentiel, 6-9 tours) reste-t-elle rentable malgré les malus ?** Tester avec des joueurs agressifs pour vérifier que l'impérialisme ne domine pas systématiquement.

3. **Le plafond tourisme de 15-20 % est-il trop restrictif ou trop permissif ?** Tester des parties où un joueur tente le « full tourisme » pour évaluer sa compétitivité réelle.

4. **Le malus -20 % bonheur pour refus de sanctionner est-il dissuasif ?** Si les joueurs ignorent systématiquement les preuves, augmenter à -25 %. Si personne n'ose refuser, réduire à -15 %.

5. **L'expulsion quasi unanime des organisations bloque-t-elle trop ?** Observer si des joueurs toxiques exploitent la difficulté d'expulsion pour saboter les orgas de l'intérieur.

6. **La fréquence des événements aléatoires (1-2/tour) est-elle correcte ?** Trop fréquent = frustrant (les joueurs sentent qu'ils ne contrôlent rien). Trop rare = oubliable.

7. **L'asymétrie de départ crée-t-elle des positions injouables ?** Vérifier qu'aucun profil de pays ne soit systématiquement dernier.

8. **La dépendance d'entretien armes propriétaires crée-t-elle un vassalage trop fort ?** Si un fournisseur contrôle trop facilement ses clients, réduire la dégradation à -10 %/tour ou permettre un « reverse engineering » coûteux (50 % du prix de développement).

9. **La menace de bombardement est-elle trop facile à spammer ?** Si oui, augmenter le coût en actions (2 au lieu de 1) ou ajouter un cooldown de 2 tours entre deux menaces au même joueur.

10. **Le nucléaire est-il suffisamment dissuasif sans être inutile ?** Si personne ne développe jamais le nucléaire, réduire le coût. Si un joueur l'utilise et gagne quand même, augmenter les pénalités.

11. **Le journal satirique est-il drôle sans être toxique ?** Tester les templates avec des joueurs réels pour vérifier que l'humour pique l'ego sans blesser. Ajuster le ton si nécessaire.

### Améliorations futures envisageables

1. **Mode spectateur** : permettre à des observateurs de suivre la partie en temps réel sans jouer.

2. **Rejeu / historique** : revoir une partie tour par tour après coup pour analyser les décisions clés.

3. **Profils de pays personnalisables** : au lieu de profils prédéfinis, un mode « draft » où chaque joueur répartit des points entre les ressources de départ.

4. **Victoire par conditions alternatives** : conquête totale (contrôler X régions), hégémonie culturelle (influence max), monopole économique (PIB > somme des 2 suivants).

5. **Événements en chaîne** : certains événements déclenchent des suites (une pandémie non traitée déclenche un exode migratoire au tour suivant).

6. **Marché noir** : un canal d'échange anonyme avec des prix plus élevés mais sans trace (utile pour les pays sous sanctions).

7. **Système de réputation visible** : un indice public de « fiabilité » basé sur le respect des accords passés, influençant les propositions commerciales des autres.

---

*Fin du document — Empire du Commerce GDD v1.2*
