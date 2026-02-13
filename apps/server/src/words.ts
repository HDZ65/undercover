import type { WordCategory, WordPair } from '@undercover/shared';

/**
 * Word database for Undercover game
 * 50+ French word pairs across 5 categories
 */
export const wordDatabase: Record<WordCategory, WordPair[]> = {
  facile: [
    { civil: 'Chat', undercover: 'Chien' },
    { civil: 'Pizza', undercover: 'Hamburger' },
    { civil: 'Café', undercover: 'Thé' },
    { civil: 'Vélo', undercover: 'Moto' },
    { civil: 'Livre', undercover: 'Magazine' },
    { civil: 'Pomme', undercover: 'Poire' },
    { civil: 'Soleil', undercover: 'Lune' },
    { civil: 'Mer', undercover: 'Océan' },
    { civil: 'Montagne', undercover: 'Colline' },
    { civil: 'Été', undercover: 'Printemps' },
    { civil: 'Voiture', undercover: 'Camion' },
    { civil: 'Chaussures', undercover: 'Baskets' },
  ],

  expert: [
    { civil: 'Démocratie', undercover: 'République' },
    { civil: 'Yoga', undercover: 'Pilates' },
    { civil: 'Philosophie', undercover: 'Psychologie' },
    { civil: 'Jazz', undercover: 'Blues' },
    { civil: 'Roman', undercover: 'Nouvelle' },
    { civil: 'Sculpture', undercover: 'Peinture' },
    { civil: 'Stratégie', undercover: 'Tactique' },
    { civil: 'Théorie', undercover: 'Pratique' },
    { civil: 'Éthique', undercover: 'Morale' },
    { civil: 'Science', undercover: 'Technologie' },
    { civil: 'Architecture', undercover: 'Ingénierie' },
    { civil: 'Économie', undercover: 'Finance' },
  ],

  adulte: [
    { civil: 'Tinder', undercover: 'Bumble' },
    { civil: 'Gueule de bois', undercover: 'Indigestion' },
    { civil: 'Netflix', undercover: 'Amazon Prime' },
    { civil: 'Instagram', undercover: 'TikTok' },
    { civil: 'Ex', undercover: 'Crush' },
    { civil: 'Ghosting', undercover: 'Friendzone' },
    { civil: 'Burnout', undercover: 'Dépression' },
    { civil: 'Stalker', undercover: 'Fan' },
    { civil: 'Influenceur', undercover: 'Youtubeur' },
    { civil: 'Spam', undercover: 'Pub' },
    { civil: 'Swiper', undercover: 'Liker' },
    { civil: 'Story', undercover: 'Post' },
  ],

  gastronomie: [
    { civil: 'Croissant', undercover: 'Pain au chocolat' },
    { civil: 'Champagne', undercover: 'Prosecco' },
    { civil: 'Café', undercover: 'Espresso' },
    { civil: 'Vin rouge', undercover: 'Vin blanc' },
    { civil: 'Fromage', undercover: 'Yaourt' },
    { civil: 'Chocolat', undercover: 'Nutella' },
    { civil: 'Burger', undercover: 'Sandwich' },
    { civil: 'Sushi', undercover: 'Sashimi' },
    { civil: 'Bière', undercover: 'Cidre' },
    { civil: 'Gâteau', undercover: 'Tarte' },
    { civil: 'Steak', undercover: 'Côtelette' },
    { civil: 'Baguette', undercover: 'Pain de mie' },
  ],

  voyage: [
    { civil: 'Avion', undercover: 'Hélicoptère' },
    { civil: 'Paris', undercover: 'Londres' },
    { civil: 'Hôtel', undercover: 'Auberge' },
    { civil: 'Valise', undercover: 'Sac à dos' },
    { civil: 'Plage', undercover: 'Piscine' },
    { civil: 'Train', undercover: 'Métro' },
    { civil: 'Passeport', undercover: 'Visa' },
    { civil: 'Croisière', undercover: 'Ferry' },
    { civil: 'Touriste', undercover: 'Voyageur' },
    { civil: 'Montagne', undercover: 'Campagne' },
    { civil: 'Camping', undercover: 'Randonnée' },
    { civil: 'Réservation', undercover: 'Billet' },
  ],
};
