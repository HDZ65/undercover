/**
 * 1000+ unique French words for Codenames.
 * With this pool, each game picks 25 — probability of seeing
 * the same grid twice is astronomically low.
 */
const WORDS: string[] = [
  // ── Animaux (80) ──
  'chat', 'chien', 'lion', 'tigre', 'aigle', 'serpent', 'baleine', 'dauphin',
  'loup', 'renard', 'ours', 'cerf', 'lapin', 'tortue', 'requin', 'singe',
  'cheval', 'cochon', 'mouton', 'poule', 'canard', 'corbeau', 'hibou', 'perroquet',
  'papillon', 'fourmi', 'araignee', 'abeille', 'crabe', 'pieuvre', 'grenouille', 'scarabee',
  'gazelle', 'chameau', 'crocodile', 'gorille', 'panthere', 'autruche', 'flamant', 'colibri',
  'scorpion', 'meduse', 'hippocampe', 'panda', 'koala', 'kangourou', 'pingouin', 'morse',
  'herisson', 'castor', 'blaireau', 'sanglier', 'bison', 'antilope', 'girafe', 'zebre',
  'vautour', 'cigogne', 'mouette', 'faucon', 'cygne', 'paon', 'puma', 'jaguar',
  'hamster', 'furet', 'belette', 'loutre', 'raton', 'ecureuil', 'taupe', 'chauve-souris',
  'salamandre', 'cameleon', 'iguane', 'cobra', 'vipere', 'mamba', 'python', 'condor',

  // ── Nourriture & boissons (80) ──
  'pomme', 'banane', 'orange', 'fraise', 'cerise', 'citron', 'raisin', 'melon',
  'pain', 'fromage', 'beurre', 'miel', 'chocolat', 'gateau', 'tarte', 'croissant',
  'soupe', 'salade', 'olive', 'tomate', 'carotte', 'oignon', 'ail', 'poivre',
  'sel', 'sucre', 'cafe', 'the', 'vin', 'biere', 'lait', 'jus',
  'brioche', 'baguette', 'crepe', 'macaron', 'eclair', 'mousse', 'flan', 'sorbet',
  'saucisson', 'jambon', 'poulet', 'steak', 'saumon', 'crevette', 'huitre', 'homard',
  'champagne', 'cognac', 'cidre', 'limonade', 'sirop', 'tisane', 'cacao', 'smoothie',
  'avocat', 'mangue', 'ananas', 'kiwi', 'figue', 'grenade', 'noix', 'amande',
  'poire', 'abricot', 'prune', 'noisette', 'pistache', 'moutarde', 'vinaigre', 'mayonnaise',
  'couscous', 'raclette', 'fondue', 'gratin', 'ragout', 'risotto', 'sushi', 'curry',

  // ── Corps & sante (48) ──
  'coeur', 'cerveau', 'main', 'pied', 'oeil', 'bouche', 'dent', 'os',
  'sang', 'muscle', 'poumon', 'dos', 'genou', 'doigt', 'ongle', 'gorge',
  'epaule', 'coude', 'cheville', 'hanche', 'poignet', 'nuque', 'crane', 'tibia',
  'estomac', 'foie', 'rein', 'rate', 'artere', 'tendon', 'cartilage', 'moelle',
  'sourcil', 'cil', 'joue', 'menton', 'front', 'tempe', 'narine', 'levre',
  'paume', 'pouce', 'index', 'majeur', 'mollet', 'talon', 'orteil', 'colonne',

  // ── Nature & geographie (80) ──
  'montagne', 'riviere', 'ocean', 'foret', 'desert', 'volcan', 'cascade', 'glacier',
  'plage', 'ile', 'lac', 'vallee', 'colline', 'grotte', 'marais', 'prairie',
  'arbre', 'fleur', 'herbe', 'feuille', 'racine', 'branche', 'champignon', 'mousse',
  'soleil', 'lune', 'etoile', 'nuage', 'pluie', 'neige', 'tonnerre', 'arc-en-ciel',
  'vent', 'tempete', 'brouillard', 'rosee', 'orage', 'eclipse', 'aurore', 'crepuscule',
  'falaise', 'ravin', 'canyon', 'delta', 'estuaire', 'fjord', 'geyser', 'recif',
  'toundra', 'steppe', 'savane', 'jungle', 'mangrove', 'oasis', 'dune', 'cratere',
  'chene', 'sapin', 'bouleau', 'palmier', 'bambou', 'cactus', 'lierre', 'orchidee',
  'tulipe', 'tournesol', 'lavande', 'lotus', 'iris', 'marguerite', 'pissenlit', 'coquelicot',
  'mousson', 'typhon', 'blizzard', 'bruine', 'grele', 'givre', 'verglas', 'averse',

  // ── Maison & objets (64) ──
  'table', 'chaise', 'lit', 'porte', 'fenetre', 'miroir', 'lampe', 'horloge',
  'tapis', 'rideau', 'escalier', 'toit', 'mur', 'plancher', 'plafond', 'balcon',
  'cle', 'serrure', 'bougie', 'vase', 'cadre', 'coussin', 'couverture', 'oreiller',
  'assiette', 'couteau', 'fourchette', 'cuillere', 'verre', 'casserole', 'poele', 'four',
  'tiroir', 'armoire', 'etagere', 'commode', 'tabouret', 'canape', 'fauteuil', 'berceau',
  'robinet', 'douche', 'baignoire', 'lavabo', 'carrelage', 'paillasson', 'volet', 'gouttiere',
  'ampoule', 'prise', 'interrupteur', 'fusible', 'radiateur', 'ventilateur', 'climatiseur', 'cheminee',
  'panier', 'bocal', 'plateau', 'thermos', 'entonnoir', 'passoire', 'louche', 'spatule',

  // ── Vetements & accessoires (48) ──
  'chapeau', 'manteau', 'cravate', 'ceinture', 'bague', 'collier', 'montre', 'lunettes',
  'gant', 'echarpe', 'botte', 'chaussure', 'chemise', 'pantalon', 'robe', 'jupe',
  'veste', 'gilet', 'blouson', 'parka', 'bermuda', 'maillot', 'pyjama', 'combinaison',
  'sandale', 'mocassin', 'basket', 'talon', 'lacet', 'semelle', 'fermeture', 'bouton',
  'bracelet', 'broche', 'pendentif', 'tiare', 'diademe', 'perruque', 'voile', 'cape',
  'tablier', 'salopette', 'casquette', 'beret', 'turban', 'bandana', 'calecon', 'chaussette',

  // ── Transport & vehicules (48) ──
  'avion', 'bateau', 'train', 'voiture', 'velo', 'fusee', 'helicoptere', 'moto',
  'camion', 'bus', 'metro', 'tramway', 'canoe', 'yacht', 'navire', 'ambulance',
  'dirigeable', 'planeur', 'deltaplane', 'catamaran', 'pedalo', 'kayak', 'radeau', 'gondole',
  'caravane', 'tracteur', 'bulldozer', 'grue', 'chariot', 'luge', 'traineau', 'motoneige',
  'paquebot', 'corvette', 'fregate', 'sous-marin', 'porte-avions', 'chalutier', 'remorqueur', 'barge',
  'scooter', 'quad', 'tandem', 'tricycle', 'trottinette', 'skateboard', 'segway', 'teleporteur',

  // ── Lieux & batiments (64) ──
  'chateau', 'eglise', 'prison', 'hopital', 'ecole', 'musee', 'theatre', 'stade',
  'pont', 'tour', 'phare', 'temple', 'palais', 'cabane', 'ferme', 'gare',
  'usine', 'marche', 'bibliotheque', 'laboratoire', 'cimetiere', 'fontaine', 'statue', 'monument',
  'cathedrale', 'mosquee', 'synagogue', 'monastere', 'pagode', 'pyramide', 'colisee', 'arene',
  'casino', 'cabaret', 'cirque', 'aquarium', 'planetarium', 'observatoire', 'ambassade', 'consulat',
  'mairie', 'tribunal', 'caserne', 'arsenal', 'hangar', 'entrepot', 'silo', 'moulin',
  'refuge', 'auberge', 'taverne', 'brasserie', 'kiosque', 'terrasse', 'veranda', 'pergola',
  'donjon', 'douve', 'rempart', 'citadelle', 'bastion', 'bunker', 'barricade', 'tranchee',

  // ── Professions & roles (64) ──
  'roi', 'reine', 'prince', 'chevalier', 'pirate', 'soldat', 'espion', 'detective',
  'medecin', 'pilote', 'capitaine', 'cuisinier', 'boulanger', 'peintre', 'sculpteur', 'musicien',
  'arbitre', 'gardien', 'berger', 'marin', 'plombier', 'architecte', 'avocat', 'juge',
  'astronaute', 'chirurgien', 'pharmacien', 'dentiste', 'infirmier', 'sage-femme', 'pompier', 'policier',
  'professeur', 'directeur', 'journaliste', 'photographe', 'ecrivain', 'poete', 'acteur', 'danseur',
  'magicien', 'clown', 'acrobate', 'jongleur', 'dompteur', 'gladiateur', 'samourai', 'ninja',
  'empereur', 'pharaon', 'sultan', 'duc', 'comte', 'baron', 'ambassadeur', 'chancelier',
  'forgeron', 'menuisier', 'macon', 'vitrier', 'couturier', 'tailleur', 'cordonnier', 'horloger',

  // ── Sport & jeux (48) ──
  'ballon', 'filet', 'raquette', 'pion', 'echecs', 'domino', 'puzzle', 'carte',
  'cible', 'medaille', 'coupe', 'ring', 'piste', 'podium', 'marathon', 'plongeon',
  'surf', 'ski', 'patinage', 'escalade', 'boxe', 'judo', 'karate', 'escrime',
  'rugby', 'cricket', 'handball', 'volley', 'badminton', 'hockey', 'polo', 'golf',
  'sprint', 'haie', 'relais', 'javelot', 'disque', 'perche', 'marteau', 'trampoline',
  'kayak', 'aviron', 'voile', 'planche', 'luge', 'bobsleigh', 'curling', 'biathlon',

  // ── Musique & art (48) ──
  'piano', 'guitare', 'violon', 'tambour', 'trompette', 'flute', 'harpe', 'orgue',
  'toile', 'pinceau', 'encre', 'crayon', 'palette', 'scene', 'masque', 'statue',
  'saxophone', 'clarinette', 'basson', 'hautbois', 'tuba', 'xylophone', 'banjo', 'ukulele',
  'accordeon', 'harmonica', 'cornemuse', 'luth', 'mandoline', 'cithare', 'gong', 'cymbale',
  'aquarelle', 'fusain', 'pastel', 'gouache', 'gravure', 'lithographie', 'fresque', 'mosaique',
  'opera', 'ballet', 'symphonie', 'concerto', 'sonate', 'requiem', 'chorale', 'fanfare',

  // ── Guerre & combat (48) ──
  'epee', 'bouclier', 'lance', 'arc', 'fleche', 'canon', 'bombe', 'fusil',
  'armure', 'casque', 'drapeau', 'forteresse', 'siege', 'bataille', 'victoire', 'defaite',
  'mousquet', 'baionnette', 'catapulte', 'trebuchet', 'belier', 'arbalete', 'fronde', 'dague',
  'torpille', 'grenade', 'mortier', 'obus', 'missile', 'mine', 'barrage', 'embuscade',
  'regiment', 'bataillon', 'escadron', 'brigade', 'legion', 'milice', 'commando', 'mercenaire',
  'strategie', 'tactique', 'offensive', 'retraite', 'armistice', 'reddition', 'blocus', 'mutinerie',

  // ── Science & technologie (64) ──
  'robot', 'satellite', 'telescope', 'microscope', 'laser', 'radar', 'antenne', 'pile',
  'atome', 'molecule', 'cellule', 'virus', 'bacterie', 'gene', 'cristal', 'plasma',
  'aimant', 'ressort', 'engrenage', 'levier', 'poulie', 'circuit', 'code', 'signal',
  'electron', 'proton', 'neutron', 'quark', 'photon', 'neutrino', 'isotope', 'ion',
  'oxygene', 'azote', 'carbone', 'helium', 'mercure', 'uranium', 'plutonium', 'titane',
  'algorithme', 'logiciel', 'serveur', 'processeur', 'pixel', 'octet', 'binaire', 'reseau',
  'telescope', 'sismographe', 'barographe', 'thermometre', 'stethoscope', 'centrifugeuse', 'distillateur', 'dynamo',
  'hologramme', 'prototype', 'turbine', 'generateur', 'condensateur', 'transistor', 'diode', 'fibre',

  // ── Concepts & abstraits (48) ──
  'temps', 'espace', 'force', 'vitesse', 'poids', 'chaleur', 'lumiere', 'ombre',
  'silence', 'echo', 'reve', 'cauchemar', 'secret', 'mystere', 'enigme', 'illusion',
  'chance', 'destin', 'liberte', 'justice', 'verite', 'mensonge', 'courage', 'peur',
  'sagesse', 'folie', 'passion', 'colere', 'honte', 'orgueil', 'envie', 'jalousie',
  'chaos', 'ordre', 'harmonie', 'equilibre', 'paradoxe', 'dilemme', 'utopie', 'dystopie',
  'infini', 'neant', 'absurde', 'ironie', 'nostalgie', 'euphorie', 'angoisse', 'serenite',

  // ── Conte & fantaisie (48) ──
  'dragon', 'fee', 'sorcier', 'fantome', 'vampire', 'loup-garou', 'troll', 'nain',
  'tresor', 'potion', 'baguette', 'grimoire', 'amulette', 'talisman', 'licorne', 'phoenix',
  'elfe', 'ogre', 'gobelin', 'minotaure', 'centaure', 'sphinx', 'griffon', 'hydre',
  'cyclope', 'kraken', 'chimere', 'basilic', 'golem', 'djinn', 'banshee', 'spectre',
  'sortilege', 'malediction', 'enchantement', 'prophecie', 'oracle', 'rituel', 'incantation', 'rune',
  'donjon', 'labyrinthe', 'portail', 'dimension', 'relique', 'artefact', 'phylactere', 'calice',

  // ── Mer & maritime (32) ──
  'ancre', 'voile', 'rame', 'gouvernail', 'boussole', 'maree', 'horizon', 'phare',
  'vague', 'recif', 'corail', 'perle', 'coquillage', 'sirene', 'naufrage', 'epave',
  'mouillage', 'quai', 'jetee', 'digue', 'ponton', 'bouee', 'hublot', 'proue',
  'poupe', 'mat', 'vigie', 'pavillon', 'cordage', 'tribord', 'babord', 'ecume',

  // ── Ecriture & communication (48) ──
  'lettre', 'livre', 'journal', 'plume', 'parchemin', 'enveloppe', 'timbre', 'sceau',
  'message', 'telegraphe', 'telephone', 'radio', 'microphone', 'camera', 'ecran', 'clavier',
  'roman', 'poeme', 'fable', 'conte', 'legende', 'mythe', 'saga', 'chronique',
  'chapitre', 'preface', 'epilogue', 'manuscrit', 'brouillon', 'signature', 'calligraphie', 'hieroglyphe',
  'imprimerie', 'typographie', 'gazette', 'editorial', 'colonne', 'rubrique', 'titre', 'citation',
  'dialogue', 'monologue', 'discours', 'sermon', 'proverbe', 'devise', 'slogan', 'haiku',

  // ── Materiaux & textures (32) ──
  'pierre', 'bois', 'fer', 'or', 'argent', 'cuivre', 'bronze', 'diamant',
  'verre', 'soie', 'laine', 'cuir', 'coton', 'sable', 'argile', 'marbre',
  'granit', 'obsidienne', 'ambre', 'jade', 'rubis', 'saphir', 'emeraude', 'opale',
  'platine', 'acier', 'etain', 'plomb', 'zinc', 'chrome', 'cobalt', 'tungstene',

  // ── Formes & geometrie (24) ──
  'cercle', 'triangle', 'carre', 'spirale', 'sphere', 'cube', 'cylindre', 'cone',
  'losange', 'hexagone', 'pentagone', 'octogone', 'prisme', 'ellipse', 'parabole', 'helix',
  'fractal', 'symetrie', 'tangente', 'diagonale', 'parallele', 'perpendiculaire', 'arc', 'segment',

  // ── Astronomie & espace (32) ──
  'comete', 'asteroide', 'meteorite', 'nebuleuse', 'galaxie', 'constellation', 'pulsar', 'supernova',
  'orbite', 'apesanteur', 'cratere', 'atmosphere', 'magnetosphere', 'exoplanete', 'quasar', 'trou-noir',
  'jupiter', 'saturne', 'mars', 'venus', 'neptune', 'pluton', 'titan', 'europe',
  'cosmonaute', 'capsule', 'sonde', 'station', 'telescope', 'observatoire', 'lancement', 'alunissage',

  // ── Histoire & civilisation (40) ──
  'revolution', 'empire', 'republique', 'monarchie', 'democratie', 'dictature', 'colonie', 'federation',
  'renaissance', 'croisade', 'inquisition', 'reformation', 'industrialisation', 'abolition', 'decolonisation', 'globalisation',
  'hieroglyphe', 'papyrus', 'amphore', 'aqueduc', 'forum', 'senat', 'consul', 'centurion',
  'viking', 'samurai', 'gladiateur', 'pharaon', 'conquistador', 'mousquetaire', 'corsaire', 'flibustier',
  'parchemin', 'blason', 'heritier', 'dynastie', 'traite', 'alliance', 'embargo', 'tribut',

  // ── Emotions & personnalite (32) ──
  'joie', 'tristesse', 'surprise', 'degout', 'mepris', 'admiration', 'gratitude', 'amour',
  'rage', 'terreur', 'anxiete', 'melancolie', 'extase', 'apathie', 'empathie', 'sympathie',
  'audace', 'prudence', 'patience', 'tenacite', 'modestie', 'arrogance', 'genersite', 'avarice',
  'optimisme', 'pessimisme', 'cynisme', 'idealisme', 'pragmatisme', 'fanatisme', 'scepticisme', 'stoicisme',

  // ── Cuisine & ustensiles (24) ──
  'wok', 'mixeur', 'rouleau', 'fouet', 'mandoline', 'pilon', 'mortier', 'rape',
  'cocotte', 'tajine', 'plancha', 'barbecue', 'fumoir', 'sorbetiere', 'gaufrier', 'crepiere',
  'saladier', 'soupiere', 'carafe', 'pichet', 'timbale', 'ramequin', 'moule', 'planche',

  // ── Fete & celebration (24) ──
  'confetti', 'guirlande', 'lampion', 'feu-artifice', 'deguisement', 'cotillon', 'serpentin', 'ballon',
  'banquet', 'festin', 'toast', 'gala', 'carnaval', 'festival', 'kermesse', 'foire',
  'anniversaire', 'mariage', 'bapteme', 'ceremonie', 'procession', 'parade', 'cortege', 'defile',

  // ── Jardin & agriculture (32) ──
  'semence', 'terreau', 'engrais', 'compost', 'serre', 'potager', 'verger', 'vigne',
  'arrosoir', 'secateur', 'rateau', 'beche', 'brouette', 'tondeuse', 'haie', 'tuteur',
  'recolte', 'moisson', 'vendange', 'semailles', 'irrigation', 'labour', 'sillon', 'jachère',
  'ruche', 'poulailler', 'etable', 'ecurie', 'grange', 'abreuvoir', 'mangeoire', 'enclos',

  // ── Divers objets & inventions (40) ──
  'parapluie', 'parasol', 'eventail', 'loupe', 'boite', 'coffret', 'malle', 'valise',
  'pendule', 'sablier', 'cadran', 'metronome', 'gyroscope', 'periscope', 'kalidoscope', 'jumelles',
  'briquet', 'allumette', 'torche', 'lanterne', 'chandelier', 'bougeoir', 'photophore', 'projecteur',
  'ancre', 'compas', 'sextant', 'astrolabe', 'abaque', 'boulier', 'balance', 'pendule',
  'parachute', 'deltaplane', 'cerf-volant', 'trampoline', 'hamac', 'toboggan', 'manege', 'grande-roue',
]

/**
 * Deduplicate and shuffle, then pick 25 unique words for a game.
 * With 1000+ unique words, you'd need 40+ games to exhaust the pool.
 */
export function pickWords(): string[] {
  const unique = [...new Set(WORDS)]
  // Fisher-Yates shuffle
  const shuffled = [...unique]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 25)
}
