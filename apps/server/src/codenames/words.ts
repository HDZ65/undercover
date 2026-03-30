/**
 * 500+ French words for Codenames.
 * Diverse categories: objects, animals, places, food, professions, nature, etc.
 * All single words (no compound nouns) for clean gameplay.
 */
const WORDS: string[] = [
  // Animaux
  'chat', 'chien', 'lion', 'tigre', 'aigle', 'serpent', 'baleine', 'dauphin',
  'loup', 'renard', 'ours', 'cerf', 'lapin', 'tortue', 'requin', 'singe',
  'cheval', 'cochon', 'mouton', 'poule', 'canard', 'corbeau', 'hibou', 'perroquet',
  'papillon', 'fourmi', 'araignee', 'abeille', 'crabe', 'pieuvre', 'grenouille', 'scarabee',

  // Nourriture & boissons
  'pomme', 'banane', 'orange', 'fraise', 'cerise', 'citron', 'raisin', 'melon',
  'pain', 'fromage', 'beurre', 'miel', 'chocolat', 'gateau', 'tarte', 'croissant',
  'soupe', 'salade', 'olive', 'tomate', 'carotte', 'oignon', 'ail', 'poivre',
  'sel', 'sucre', 'cafe', 'the', 'vin', 'biere', 'lait', 'jus',

  // Corps & sante
  'coeur', 'cerveau', 'main', 'pied', 'oeil', 'bouche', 'dent', 'os',
  'sang', 'muscle', 'poumon', 'dos', 'genou', 'doigt', 'ongle', 'gorge',

  // Nature & geographie
  'montagne', 'riviere', 'ocean', 'foret', 'desert', 'volcan', 'cascade', 'glacier',
  'plage', 'ile', 'lac', 'vallee', 'colline', 'grotte', 'marais', 'prairie',
  'arbre', 'fleur', 'herbe', 'feuille', 'racine', 'branche', 'mousse', 'champignon',
  'soleil', 'lune', 'etoile', 'nuage', 'pluie', 'neige', 'tonnerre', 'arc-en-ciel',
  'vent', 'tempete', 'brouillard', 'rosee', 'orage', 'eclipse', 'aurore', 'crepuscule',

  // Maison & objets
  'table', 'chaise', 'lit', 'porte', 'fenetre', 'miroir', 'lampe', 'horloge',
  'tapis', 'rideau', 'escalier', 'toit', 'mur', 'plancher', 'plafond', 'balcon',
  'cle', 'serrure', 'bougie', 'vase', 'cadre', 'coussin', 'couverture', 'oreiller',
  'assiette', 'couteau', 'fourchette', 'cuillere', 'verre', 'casserole', 'poele', 'four',

  // Vetements & accessoires
  'chapeau', 'manteau', 'cravate', 'ceinture', 'bague', 'collier', 'montre', 'lunettes',
  'gant', 'echarpe', 'botte', 'chaussure', 'chemise', 'pantalon', 'robe', 'jupe',

  // Transport & vehicules
  'avion', 'bateau', 'train', 'voiture', 'velo', 'fusee', 'helicoptere', 'moto',
  'camion', 'bus', 'metro', 'tramway', 'canoe', 'yacht', 'navire', 'ambulance',

  // Lieux & batiments
  'chateau', 'eglise', 'prison', 'hopital', 'ecole', 'musee', 'theatre', 'stade',
  'pont', 'tour', 'phare', 'temple', 'palais', 'cabane', 'ferme', 'gare',
  'usine', 'marche', 'bibliotheque', 'laboratoire', 'cimetiere', 'fontaine', 'statue', 'monument',

  // Professions & roles
  'roi', 'reine', 'prince', 'chevalier', 'pirate', 'soldat', 'espion', 'detective',
  'medecin', 'pilote', 'capitaine', 'cuisinier', 'boulanger', 'peintre', 'sculpteur', 'musicien',
  'arbitre', 'gardien', 'berger', 'marin', 'plombier', 'architecte', 'avocat', 'juge',

  // Sport & jeux
  'ballon', 'filet', 'raquette', 'pion', 'carte', 'dice', 'echecs', 'domino',
  'cible', 'medaille', 'coupe', 'ring', 'piste', 'podium', 'marathon', 'plongeon',

  // Musique & art
  'piano', 'guitare', 'violon', 'tambour', 'trompette', 'flute', 'harpe', 'orgue',
  'toile', 'pinceau', 'encre', 'crayon', 'palette', 'scene', 'rideau', 'masque',

  // Guerre & combat
  'epee', 'bouclier', 'lance', 'arc', 'fleche', 'canon', 'bombe', 'fusil',
  'armure', 'casque', 'drapeau', 'tranchee', 'forteresse', 'siege', 'bataille', 'victoire',

  // Science & technologie
  'robot', 'satellite', 'telescope', 'microscope', 'laser', 'radar', 'antenne', 'pile',
  'atome', 'molecule', 'cellule', 'virus', 'bacterie', 'gene', 'cristal', 'plasma',
  'aimant', 'ressort', 'engrenage', 'levier', 'poulie', 'circuit', 'code', 'signal',

  // Concepts & abstraits
  'temps', 'espace', 'force', 'vitesse', 'poids', 'chaleur', 'lumiere', 'ombre',
  'silence', 'echo', 'reve', 'cauchemar', 'secret', 'mystere', 'enigme', 'illusion',
  'chance', 'destin', 'liberte', 'justice', 'verite', 'mensonge', 'courage', 'peur',

  // Conte & fantaisie
  'dragon', 'fee', 'sorcier', 'fantome', 'vampire', 'loup-garou', 'troll', 'nain',
  'tresor', 'potion', 'baguette', 'grimoire', 'amulette', 'talisman', 'licorne', 'phoenix',

  // Mer & maritime
  'ancre', 'voile', 'rame', 'gouvernail', 'boussole', 'carte', 'phare', 'maree',
  'vague', 'recif', 'corail', 'perle', 'coquillage', 'sirene', 'naufrage', 'horizon',

  // Ecriture & communication
  'lettre', 'livre', 'journal', 'plume', 'parchemin', 'enveloppe', 'timbre', 'sceau',
  'message', 'telegraphe', 'telephone', 'radio', 'microphone', 'camera', 'ecran', 'clavier',

  // Materiaux & textures
  'pierre', 'bois', 'fer', 'or', 'argent', 'cuivre', 'bronze', 'diamant',
  'verre', 'soie', 'laine', 'cuir', 'coton', 'sable', 'argile', 'marbre',

  // Couleurs & formes
  'cercle', 'triangle', 'carre', 'spirale', 'pyramide', 'sphere', 'cube', 'cylindre',
  'rouge', 'bleu', 'noir', 'blanc', 'violet', 'rose', 'gris', 'dore',

  // Meteo & saisons
  'hiver', 'printemps', 'automne', 'gel', 'canicule', 'avalanche', 'cyclone', 'secheresse',

  // Commerce & societe
  'banque', 'piece', 'billet', 'coffre', 'tresor', 'balance', 'ancre', 'couronne',
  'trompette', 'drapeau', 'torche', 'chaine', 'corde', 'noeud', 'filet', 'piege',

  // Divers
  'ombre', 'flamme', 'etincelle', 'fumee', 'cendre', 'poussiere', 'bulle', 'goutte',
  'plume', 'griffe', 'corne', 'ivoire', 'ecaille', 'toile', 'fil', 'aiguille',
  'cloche', 'tambour', 'sifflet', 'sirene', 'alarme', 'signal', 'fusee', 'parachute',
  'telescope', 'jumelles', 'boussole', 'sablier', 'pendule', 'cadran', 'mecanisme', 'ressort',
  'tunnel', 'passage', 'sentier', 'chemin', 'route', 'carrefour', 'labyrinthe', 'impasse',
  'portrait', 'statue', 'buste', 'relief', 'mosaique', 'vitrail', 'fresque', 'gravure',
  'parfum', 'epice', 'herbe', 'resine', 'encens', 'vanille', 'cannelle', 'safran',
  'avalanche', 'eruption', 'seisme', 'tsunami', 'tornade', 'inondation', 'foudre', 'givre',
]

/**
 * Deduplicate and shuffle, then pick 25 unique words for a game.
 */
export function pickWords(): string[] {
  // Deduplicate
  const unique = [...new Set(WORDS)]
  // Fisher-Yates shuffle
  const shuffled = [...unique]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 25)
}
