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

La population est la ressource la plus fondamentale. Elle croît naturellement de +1 à +3 % par tour, modulée par le bonheur, la santé et les migrations. Les citoyens migrent spontanément vers les pays à bonheur élevé et fuient les pays en guerre ou en crise. La productivité de chaque travailleur dépend du bonheur, de l'éducation et de la santé.

Un régime militaire fort (Forces Armées ≥ 60) peut compenser un bonheur bas sans perdre en productivité : c'est l'effet autoritaire. Ce mécanisme est plafonné à -30 % bonheur. En dessous de 20 % de bonheur, des révoltes éclatent indépendamment de la puissance militaire, causant des destructions d'infrastructures et des pertes de productivité.

#### 2. Ressources primaires

Chaque pays possède un profil de dotation asymétrique en quatre ressources : pétrole, minerais, agriculture et eau douce. Le pétrole est quasi infini (les réserves ne s'épuisent pas réellement) mais le coût d'extraction augmente progressivement avec un très léger renouvellement naturel. Les minerais sont épuisables mais partiellement recyclables. L'agriculture est renouvelable mais sensible aux événements climatiques. L'eau douce est critique, non substituable, et limite la croissance de la population si elle manque.

#### 3. Usines

Les usines transforment les ressources brutes en produits finis commercialisables. Leur efficacité dépend des outils (catégorie 6) et du niveau de recherche (catégorie 5). Chaque usine a un coût de construction, un coût d'entretien croissant et génère de la pollution. Trois tiers d'usines existent : basique, avancé et robotisé, chacun nécessitant un niveau de recherche minimum. Les usines sont des cibles prioritaires de sabotage.

#### 4. Transport

Routes, ports et aéroports déterminent la capacité d'échange commercial et la logistique interne. Un pays enclavé sans ports maritimes doit investir davantage en routes et aéroports pour exporter. Le transport affecte le coût des échanges : des infrastructures transport de qualité réduisent les frais de transaction commerciale. Les infrastructures transport sont des cibles de sabotage à fort impact (elles ralentissent toute la chaîne logistique).

### Couche 2 — Développement

#### 5. Recherche, Éducation et Brevets

La recherche suit un arbre technologique avec des spécialisations (agrotech, nanotech, énergie propre, cybersécurité, etc.). Investir en éducation améliore la qualité de la main-d'œuvre, ce qui augmente l'efficacité de toutes les usines et accélère la recherche future. Les brevets génèrent des royalties passives : chaque brevet déposé rapporte un revenu récurrent à chaque tour.

Bonus militaire : la recherche amplifie l'efficacité des forces armées à raison de +1 point militaire effectif par tranche de 5 niveaux de recherche. Un techno-militariste surpasse un pur militariste à budget égal.

#### 6. Outils

Les outils sont des multiplicateurs d'efficacité pour les usines. Trois tiers existent : outils basiques (×1.2), avancés (×1.5) et robotisés (×2.0). Chaque tier nécessite un niveau de recherche minimum et un coût de maintenance. Les outils s'usent progressivement et doivent être renouvelés, créant un flux de dépenses récurrent.

#### 7. Finance et Monnaie

Chaque pays possède sa monnaie dont la force fluctue selon le PIB, la dette, l'inflation et la balance commerciale. L'inflation volontaire réduit le poids de la dette mais affaiblit la monnaie (importations plus chères). Les prêts entre joueurs sont possibles avec taux d'intérêt librement négocié. Un marché boursier simplifié permet de spéculer sur les secteurs économiques.

Point d'équilibrage clé : toutes les cotisations d'organisations internationales sont calculées sur le PIB réel (ajusté à l'inflation), empêchant la manipulation monétaire pour esquiver les contributions.

#### 8. Infrastructures critiques

Réseau électrique, télécommunications et traitement de l'eau. Ces trois systèmes agissent comme multiplicateurs globaux : un réseau électrique à 100 % booste toute la production ; des télécoms performants accélèrent la recherche et le commerce ; le traitement de l'eau soutient la santé et l'agriculture. Quand une infrastructure critique est sabotée, l'effet est ciblé (une centrale, pas le réseau entier) et cause -10 à -15 % de capacité dans le secteur affecté pendant 2-3 tours.

### Couche 3 — Social et Diplomatique

#### 9. Tourisme et Attractivité

Les touristes étrangers génèrent des revenus passifs proportionnels aux monuments construits, au bonheur du pays et à la réputation internationale. Les revenus dépendent aussi de la richesse des pays dont proviennent les touristes. En parallèle, les citoyens riches dépensent de l'argent en vacances à l'étranger (fuite de capitaux), mais cette fuite est réduite si le pays est lui-même attractif.

Le bannissement d'un pays est une arme diplomatique : on perd les revenus touristiques de ce pays, mais ses citoyens subissent un malus bonheur proportionnel au poids économique du pays qui bannit. Le bannissement a un coût diplomatique fixe de -5 % d'influence pour le pays qui bannit (acte hostile perçu par la communauté internationale), empêchant les bannissements gratuits par les pays non-attractifs. Le tourisme est plafonné à 15-20 % du PIB total (saturation touristique) et les monuments offrent des rendements décroissants.

#### 10. Santé, Environnement et Sanctions

Investir en santé réduit la mortalité et booste la productivité. L'industrie génère de la pollution qui s'accumule, causant des malus santé et bonheur. Au-delà d'un seuil, des événements climatiques aléatoires frappent le pays. La pollution transfrontalière légère (-2 à -5 % santé) affecte les voisins si un joueur dépasse un seuil de pollution extrême. Les crédits carbone sont échangeables entre joueurs.

Les sanctions sont **toujours volontaires, jamais automatiques**. Le mécanisme fonctionne ainsi : un joueur obtient une preuve de sabotage (via le système d'espionnage), présente la preuve à tous, puis chaque joueur décide librement de sanctionner ou non. Un joueur qui refuse de sanctionner malgré une preuve irréfutable subit un malus de -20 % bonheur (indignation populaire). Les sanctions collectives via une organisation bénéficient d'une redistribution partielle du commerce perdu entre les membres sanctionneurs.

#### 11. Organisations internationales

Créées par 3 joueurs minimum via un vote à la majorité. Trois types : commerciale (bonus échanges), militaire (défense collective), diplomatique (médiation, influence). Chaque membre verse une cotisation automatique de 0.5 à 2 % du PIB réel par tour, avec un popup de rappel et option de quitter.

L'expulsion d'un membre requiert l'unanimité de tous les autres membres sauf maximum 1 voix contre. Le départ volontaire est possible à tout moment (coût : 1 tour de cotisation). Les modifications structurelles (frais de transaction internes, taux de cotisation) requièrent une majorité renforcée de 80 % des membres pour éviter le vote prédateur d'une coalition autosuffisante contre les membres dépendants du commerce. Les accords commerciaux ponctuels et investissements communs sont votés à la majorité simple. Aucun leader fixe : toutes les décisions passent par le vote.

En cas d'alliance militaire : quand un membre est attaqué, les autres doivent voter pour intervenir ou non. L'intervention confère +10-15 % d'efficacité au défenseur et coûte 5 % du PIB à l'allié intervenant. La non-intervention entraîne l'expulsion automatique de l'alliance et un malus de -10 % bonheur.

### Couche 4 — Conflit

#### 12. Forces Armées et Renseignement

Deux axes de développement indépendants, chacun sur une échelle de 0 à 100. L'entretien militaire est exponentiel au-dessus de 50 : un niveau 80 consomme 20-25 % du PIB en maintenance, forçant le choix entre puissance militaire et diversification économique.

Le renseignement défensif offre un bonus passif d'intelligence commerciale : à chaque tranche de 20 points, le joueur voit une information supplémentaire sur les échanges des autres joueurs (qui commerce avec qui, à quel prix).

**Armement technologique.** Les armes sont des équipements concrets répartis en 4 tiers nécessitant un niveau de recherche croissant : Tier 1 Conventionnel (recherche 10, +5 à +15 Forces Armées), Tier 2 Avancé (recherche 30, +15 à +30), Tier 3 Haute technologie (recherche 55, +25 à +40), Tier 4 Stratégique (recherche 75, +30 à +50). Un pays peut acheter des armes d'un tier supérieur à sa recherche. Le vendeur choisit entre deux modes : **armes ouvertes** (entretien universel, prix bas, pas de dépendance) ou **armes propriétaires** (entretien exclusif par le vendeur, prix élevé, coût d'entretien 2-4 % de la valeur par tour versé au vendeur). Si l'entretien propriétaire est coupé (guerre, sanctions, refus), l'arme se dégrade de -20 % efficacité par tour et devient inutilisable après 5 tours.

**Bombardement conventionnel.** Un pays possédant des avions (Tier 2+) et des bombes peut menacer publiquement de bombarder une infrastructure ciblée d'un pays adjacent, accompagné d'une demande (produit, accord, retrait). La cible a 1 tour pour accepter ou refuser. Si refusé, l'attaquant peut exécuter ou reculer. Un bluff sans avions/bombes entraîne -10 % influence si démasqué. Les dégâts d'un bombardement sont de -20 à -30 % de capacité sur la cible pendant 3-5 tours. Un monument bombardé est détruit définitivement. Les Forces Armées élevées (> 50) du défenseur interceptent partiellement, réduisant les dégâts de 20-40 %.

**Bombe nucléaire.** Nécessite recherche Tier 4 (75+), 15-20 % du PIB sur 3-5 tours de développement, 5-8 % du PIB par bombe, 1 % du PIB d'entretien par bombe par tour. Effets sur la région ciblée : destruction totale des infrastructures, -60 à -80 % population, région inutilisable 10-15 tours (radiations). Effets sur la cible : -40 % bonheur immédiat, -15 % bonheur autres régions pendant 5 tours. Effets sur l'attaquant : -50 % influence, -25 % bonheur propre, expulsion de toutes les organisations, preuve automatique (un champignon atomique se voit). Effets globaux : +15-20 % pollution mondiale, -5 % santé tous les joueurs pendant 3 tours. Riposte nucléaire possible au tour suivant si la cible possède l'arme (destruction mutuelle assurée). Le nucléaire est conçu pour être dissuasif, pas rentable : le posséder sans l'utiliser est la vraie valeur stratégique.

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
