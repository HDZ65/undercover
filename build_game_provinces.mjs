// build_game_provinces.mjs
// Génère apps/client/public/game-provinces.json
// Utilise adm1_game.geojson (frontières ADM1 réelles) et assigne chaque ADM1 à la province de jeu
// la plus proche par centroïde, puis fusionne avec turf.union.
// Usage: node build_game_provinces.mjs

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const turf = require('@turf/turf');

// ─── Province seed points + coastal flags ──────────────────────
const COUNTRIES = {
  usa:         { iso3: 'USA', provinces: [
    { name: 'Californie',    seed: [-119.4, 36.8], isCoastal: true  },
    { name: 'Texas',         seed: [-99.3,  31.5], isCoastal: true  },
    { name: 'New York',      seed: [-74.0,  41.0], isCoastal: true  },
    { name: 'Midwest',       seed: [-93.0,  42.0], isCoastal: false },
    { name: 'Floride',       seed: [-81.5,  27.5], isCoastal: true  },
  ]},
  brazil:      { iso3: 'BRA', provinces: [
    { name: 'São Paulo',     seed: [-46.6, -23.5], isCoastal: true  },
    { name: 'Amazonie',      seed: [-63.0,  -4.0], isCoastal: false },
    { name: 'Rio',           seed: [-43.2, -22.9], isCoastal: true  },
    { name: 'Minas Gerais',  seed: [-44.4, -19.0], isCoastal: false },
    { name: 'Bahia',         seed: [-41.0, -13.0], isCoastal: true  },
    { name: 'Paraná',        seed: [-51.5, -25.0], isCoastal: true  },
  ]},
  germany:     { iso3: 'DEU', provinces: [
    { name: 'Bavière',       seed: [11.6,  48.1], isCoastal: false },
    { name: 'Rhénanie',      seed: [7.1,   51.0], isCoastal: false },
    { name: 'Saxe',          seed: [13.4,  51.0], isCoastal: false },
    { name: 'Basse-Saxe',    seed: [9.9,   52.4], isCoastal: true  },
    { name: 'Hesse',         seed: [8.7,   50.6], isCoastal: false },
  ]},
  russia:      { iso3: 'RUS', provinces: [
    { name: 'Moscou',             seed: [37.6,  55.7], isCoastal: false },
    { name: 'Saint-Pétersbourg',  seed: [30.3,  59.9], isCoastal: true  },
    { name: 'Oural',              seed: [60.0,  57.0], isCoastal: false },
    { name: 'Sibérie',            seed: [82.9,  55.0], isCoastal: false },
    { name: 'Caucase',            seed: [45.0,  43.0], isCoastal: true  },
    { name: 'Extrême-Orient',     seed: [135.0, 50.0], isCoastal: true  },
  ]},
  india:       { iso3: 'IND', provinces: [
    { name: 'Mumbai',        seed: [72.8,  19.1], isCoastal: true  },
    { name: 'Delhi',         seed: [77.2,  28.6], isCoastal: false },
    { name: 'Bangalore',     seed: [77.6,  12.9], isCoastal: false },
    { name: 'Kolkata',       seed: [88.4,  22.6], isCoastal: true  },
    { name: 'Chennai',       seed: [80.3,  13.1], isCoastal: true  },
    { name: 'Punjab',        seed: [75.8,  31.5], isCoastal: false },
  ]},
  japan:       { iso3: 'JPN', provinces: [
    { name: 'Kanto',         seed: [139.7, 35.7], isCoastal: true },
    { name: 'Kansai',        seed: [135.5, 34.7], isCoastal: true },
    { name: 'Hokkaido',      seed: [143.0, 43.5], isCoastal: true },
    { name: 'Kyushu',        seed: [130.5, 32.8], isCoastal: true },
    { name: 'Tohoku',        seed: [140.9, 39.5], isCoastal: true },
  ]},
  nigeria:     { iso3: 'NGA', provinces: [
    { name: 'Lagos',         seed: [3.4,   6.4],  isCoastal: true  },
    { name: 'Abuja',         seed: [7.5,   9.1],  isCoastal: false },
    { name: 'Delta du Niger',seed: [5.6,   5.0],  isCoastal: true  },
    { name: 'Kano',          seed: [8.5,  12.0],  isCoastal: false },
    { name: 'Imo',           seed: [7.2,   5.5],  isCoastal: true  },
  ]},
  france:      { iso3: 'FRA', provinces: [
    { name: 'Île-de-France', seed: [2.3,   48.9], isCoastal: false },
    { name: 'Provence',      seed: [6.0,   43.3], isCoastal: true  },
    { name: 'Aquitaine',     seed: [-0.6,  44.8], isCoastal: true  },
    { name: 'Bretagne',      seed: [-3.0,  48.2], isCoastal: true  },
    { name: 'Alsace',        seed: [7.5,   48.6], isCoastal: false },
  ]},
  china:       { iso3: 'CHN', provinces: [
    { name: 'Shanghai',      seed: [121.5, 31.2], isCoastal: true  },
    { name: 'Pékin',         seed: [116.4, 40.0], isCoastal: false },
    { name: 'Guangdong',     seed: [113.3, 23.1], isCoastal: true  },
    { name: 'Sichuan',       seed: [104.1, 30.7], isCoastal: false },
    { name: 'Xinjiang',      seed: [87.6,  43.0], isCoastal: false },
    { name: 'Mandchourie',   seed: [125.0, 46.0], isCoastal: false },
  ]},
  saudi:       { iso3: 'SAU', provinces: [
    { name: 'Riyad',         seed: [46.7,  24.7], isCoastal: false },
    { name: 'Djeddah',       seed: [39.2,  21.5], isCoastal: true  },
    { name: 'Province Est',  seed: [50.2,  25.4], isCoastal: true  },
    { name: 'Médine',        seed: [39.6,  24.5], isCoastal: false },
    { name: 'Asir',          seed: [43.5,  18.2], isCoastal: true  },
  ]},
  australia:   { iso3: 'AUS', provinces: [
    { name: 'Sydney',                seed: [151.2, -33.9], isCoastal: true },
    { name: 'Melbourne',             seed: [144.9, -37.8], isCoastal: true },
    { name: 'Queensland',            seed: [144.0, -22.0], isCoastal: true },
    { name: 'Australie-Occidentale', seed: [122.0, -26.0], isCoastal: true },
    { name: 'Territoire du Nord',    seed: [133.0, -20.0], isCoastal: true },
  ]},
  sweden:      { iso3: 'SWE', provinces: [
    { name: 'Stockholm',     seed: [18.1,  59.3], isCoastal: true  },
    { name: 'Göteborg',      seed: [11.9,  57.7], isCoastal: true  },
    { name: 'Malmö',         seed: [13.0,  55.7], isCoastal: true  },
    { name: 'Norrland',      seed: [17.0,  65.0], isCoastal: true  },
    { name: 'Dalécarlie',    seed: [14.5,  61.0], isCoastal: false },
  ]},
  algeria:     { iso3: 'DZA', provinces: [
    { name: 'Alger',         seed: [3.0,   36.7], isCoastal: true  },
    { name: 'Oran',          seed: [-0.6,  35.7], isCoastal: true  },
    { name: 'Constantine',   seed: [6.6,   36.4], isCoastal: true  },
    { name: 'Tamanrasset',   seed: [5.5,   22.8], isCoastal: false },
    { name: 'Annaba',        seed: [7.8,   36.9], isCoastal: true  },
  ]},
  morocco:     { iso3: 'MAR', provinces: [
    { name: 'Casablanca',    seed: [-7.6,  33.6], isCoastal: true  },
    { name: 'Rabat',         seed: [-6.8,  34.0], isCoastal: true  },
    { name: 'Marrakech',     seed: [-8.0,  31.6], isCoastal: false },
    { name: 'Fès',           seed: [-5.0,  34.0], isCoastal: false },
    { name: 'Agadir',        seed: [-9.6,  30.4], isCoastal: true  },
  ]},
  tunisia:     { iso3: 'TUN', provinces: [
    { name: 'Bizerte',       seed: [9.9,   37.3], isCoastal: true },
    { name: 'Tunis',         seed: [10.2,  36.8], isCoastal: true },
    { name: 'Sousse',        seed: [10.6,  35.8], isCoastal: true },
    { name: 'Sfax',          seed: [10.8,  34.7], isCoastal: true },
    { name: 'Gabès',         seed: [10.1,  33.9], isCoastal: true },
  ]},
  libya:       { iso3: 'LBY', provinces: [
    { name: 'Tripoli',       seed: [13.2,  32.9], isCoastal: true  },
    { name: 'Benghazi',      seed: [20.1,  32.1], isCoastal: true  },
    { name: 'Misrata',       seed: [15.1,  32.4], isCoastal: true  },
    { name: 'Sabha',         seed: [14.4,  27.0], isCoastal: false },
    { name: 'Tobrouk',       seed: [24.0,  31.1], isCoastal: true  },
  ]},
  israel:      { iso3: 'ISR', provinces: [
    { name: 'Haïfa',         seed: [35.0,  32.8], isCoastal: true  },
    { name: 'Tel Aviv',      seed: [34.8,  32.1], isCoastal: true  },
    { name: 'Jérusalem',     seed: [35.2,  31.8], isCoastal: false },
    { name: 'Néguev',        seed: [34.9,  30.5], isCoastal: true  },
    { name: 'Galilée',       seed: [35.5,  32.9], isCoastal: false },
  ]},
  palestine:   { iso3: 'PSE', provinces: [
    { name: 'Gaza',          seed: [34.4,  31.4], isCoastal: true  },
    { name: 'Ramallah',      seed: [35.2,  31.9], isCoastal: false },
    { name: 'Naplouse',      seed: [35.3,  32.2], isCoastal: false },
    { name: 'Bethléem',      seed: [35.2,  31.7], isCoastal: false },
    { name: 'Jéricho',       seed: [35.5,  31.8], isCoastal: false },
  ]},
  uk:          { iso3: 'GBR', provinces: [
    { name: 'Angleterre',      seed: [-1.5, 52.0], isCoastal: true },
    { name: 'Écosse',          seed: [-3.0, 57.0], isCoastal: true },
    { name: 'Pays de Galles',  seed: [-3.8, 52.3], isCoastal: true },
    { name: 'Irlande du Nord', seed: [-6.5, 54.7], isCoastal: true },
  ]},
  spain:       { iso3: 'ESP', provinces: [
    { name: 'Catalogne',     seed: [1.5,  41.5], isCoastal: true  },
    { name: 'Castille',      seed: [-3.7, 40.4], isCoastal: false },
    { name: 'Andalousie',    seed: [-4.8, 37.4], isCoastal: true  },
    { name: 'Galice',        seed: [-8.0, 42.8], isCoastal: true  },
  ]},
  italy:       { iso3: 'ITA', provinces: [
    { name: 'Nord',          seed: [10.5, 45.5], isCoastal: false },
    { name: 'Centre',        seed: [12.5, 43.0], isCoastal: true  },
    { name: 'Sud',           seed: [16.0, 40.0], isCoastal: true  },
    { name: 'Sicile',        seed: [14.0, 37.5], isCoastal: true  },
  ]},
  poland:      { iso3: 'POL', provinces: [
    { name: 'Ouest',         seed: [17.0, 52.0], isCoastal: false },
    { name: 'Varsovie',      seed: [21.0, 52.2], isCoastal: false },
    { name: 'Est',           seed: [23.0, 51.5], isCoastal: false },
  ]},
  ukraine:     { iso3: 'UKR', provinces: [
    { name: 'Ouest',         seed: [25.0, 49.5], isCoastal: false },
    { name: 'Kiev',          seed: [30.5, 50.4], isCoastal: false },
    { name: 'Est',           seed: [37.0, 48.5], isCoastal: false },
    { name: 'Crimée',        seed: [34.0, 45.0], isCoastal: true  },
  ]},
  turkey:      { iso3: 'TUR', provinces: [
    { name: 'Istanbul',      seed: [29.0, 41.0], isCoastal: true  },
    { name: 'Ankara',        seed: [32.9, 39.9], isCoastal: false },
    { name: 'Est',           seed: [41.0, 39.0], isCoastal: false },
    { name: 'Anatolie Sud',  seed: [36.0, 37.0], isCoastal: true  },
  ]},
  norway:      { iso3: 'NOR', provinces: [
    { name: 'Laponie',       seed: [25.0, 70.0], isCoastal: true },
    { name: 'Trøndelag',     seed: [14.0, 63.0], isCoastal: true },
    { name: 'Sud',           seed: [8.0,  59.5], isCoastal: true },
  ]},
  netherlands: { iso3: 'NLD', provinces: [
    { name: 'Hollande-Nord', seed: [5.0,  52.8], isCoastal: true },
    { name: 'Hollande-Sud',  seed: [4.5,  51.8], isCoastal: true },
  ]},
  greece:      { iso3: 'GRC', provinces: [
    { name: 'Nord',          seed: [22.0, 41.0], isCoastal: true },
    { name: 'Attique',       seed: [23.7, 38.0], isCoastal: true },
    { name: 'Péloponnèse',   seed: [22.0, 37.3], isCoastal: true },
  ]},
  south_korea: { iso3: 'KOR', provinces: [
    { name: 'Séoul',         seed: [127.0, 37.5], isCoastal: false },
    { name: 'Busan',         seed: [129.1, 35.2], isCoastal: true  },
    { name: 'Centre',        seed: [127.5, 36.5], isCoastal: false },
  ]},
  indonesia:   { iso3: 'IDN', provinces: [
    { name: 'Sumatra',       seed: [104.0,  0.0], isCoastal: true },
    { name: 'Java',          seed: [110.0, -7.0], isCoastal: true },
    { name: 'Bornéo',        seed: [116.0,  0.5], isCoastal: true },
    { name: 'Sulawesi',      seed: [120.0, -2.0], isCoastal: true },
    { name: 'Papouasie',     seed: [138.0, -4.0], isCoastal: true },
  ]},
  vietnam:     { iso3: 'VNM', provinces: [
    { name: 'Hanoi',         seed: [105.8, 21.0], isCoastal: true },
    { name: 'Centre',        seed: [107.5, 16.0], isCoastal: true },
    { name: 'Hô Chi Minh',   seed: [106.7, 10.8], isCoastal: true },
  ]},
  thailand:    { iso3: 'THA', provinces: [
    { name: 'Bangkok',       seed: [100.5, 13.7], isCoastal: true  },
    { name: 'Nord',          seed: [100.0, 18.0], isCoastal: false },
    { name: 'Sud',           seed: [99.5,   9.0], isCoastal: true  },
  ]},
  pakistan:    { iso3: 'PAK', provinces: [
    { name: 'Pendjab',       seed: [74.0,  31.0], isCoastal: false },
    { name: 'Sindh',         seed: [68.0,  26.0], isCoastal: true  },
    { name: 'Khyber',        seed: [71.0,  34.0], isCoastal: false },
    { name: 'Baloutchistan', seed: [65.0,  28.0], isCoastal: true  },
  ]},
  iran:        { iso3: 'IRN', provinces: [
    { name: 'Téhéran',       seed: [51.4,  35.7], isCoastal: false },
    { name: 'Isfahan',       seed: [51.7,  32.7], isCoastal: false },
    { name: 'Khuzestan',     seed: [48.7,  31.3], isCoastal: true  },
    { name: 'Khorasan',      seed: [59.6,  36.3], isCoastal: false },
  ]},
  iraq:        { iso3: 'IRQ', provinces: [
    { name: 'Bagdad',        seed: [44.4,  33.3], isCoastal: false },
    { name: 'Basra',         seed: [47.8,  30.5], isCoastal: true  },
    { name: 'Kurdistan',     seed: [44.0,  36.5], isCoastal: false },
  ]},
  south_africa:{ iso3: 'ZAF', provinces: [
    { name: 'Johannesburg',  seed: [28.1,  -26.2], isCoastal: false },
    { name: 'Cape Town',     seed: [18.4,  -33.9], isCoastal: true  },
    { name: 'KwaZulu-Natal', seed: [30.9,  -29.6], isCoastal: true  },
    { name: 'Limpopo',       seed: [28.5,  -23.5], isCoastal: false },
  ]},
  egypt:       { iso3: 'EGY', provinces: [
    { name: 'Caire',         seed: [31.2,  30.1], isCoastal: false },
    { name: 'Delta',         seed: [31.0,  31.3], isCoastal: true  },
    { name: 'Haute-Égypte',  seed: [31.5,  26.0], isCoastal: false },
  ]},
  kenya:       { iso3: 'KEN', provinces: [
    { name: 'Nairobi',       seed: [36.8,  -1.3], isCoastal: false },
    { name: 'Côte',          seed: [40.0,  -3.0], isCoastal: true  },
    { name: 'Nord',          seed: [38.0,   2.0], isCoastal: false },
  ]},
  ethiopia:    { iso3: 'ETH', provinces: [
    { name: 'Addis-Abeba',   seed: [38.8,   9.0], isCoastal: false },
    { name: 'Amhara',        seed: [37.9,  11.6], isCoastal: false },
    { name: 'Tigray',        seed: [39.5,  14.0], isCoastal: false },
    { name: 'Ogaden',        seed: [42.0,   7.0], isCoastal: false },
  ]},
  canada:      { iso3: 'CAN', provinces: [
    { name: 'Colombie-Britannique', seed: [-125.0, 53.0], isCoastal: true  },
    { name: 'Prairies',             seed: [-107.0, 53.0], isCoastal: false },
    { name: 'Ontario',              seed: [-83.0,  47.0], isCoastal: false },
    { name: 'Québec',               seed: [-72.0,  50.0], isCoastal: true  },
    { name: 'Arctique',             seed: [-97.0,  70.0], isCoastal: true  },
  ]},
  mexico:      { iso3: 'MEX', provinces: [
    { name: 'Nord',          seed: [-106.0, 28.0], isCoastal: false },
    { name: 'Centre',        seed: [-100.0, 23.0], isCoastal: false },
    { name: 'Oaxaca',        seed: [-96.7,  17.0], isCoastal: true  },
    { name: 'Yucatan',       seed: [-89.0,  19.0], isCoastal: true  },
  ]},
  argentina:   { iso3: 'ARG', provinces: [
    { name: 'Buenos Aires',  seed: [-58.4, -34.6], isCoastal: true  },
    { name: 'Patagonie',     seed: [-68.0, -45.0], isCoastal: true  },
    { name: 'Córdoba',       seed: [-64.2, -31.4], isCoastal: false },
    { name: 'Norte',         seed: [-65.0, -24.0], isCoastal: false },
  ]},
  chile:       { iso3: 'CHL', provinces: [
    { name: 'Atacama',       seed: [-69.0, -24.0], isCoastal: true },
    { name: 'Santiago',      seed: [-70.7, -33.5], isCoastal: true },
    { name: 'Bio-Bio',       seed: [-72.6, -37.0], isCoastal: true },
    { name: 'Patagonie',     seed: [-72.0, -46.0], isCoastal: true },
  ]},
  colombia:    { iso3: 'COL', provinces: [
    { name: 'Bogota',        seed: [-74.1,   4.7], isCoastal: false },
    { name: 'Côte Caraïbe',  seed: [-75.5,  10.0], isCoastal: true  },
    { name: 'Amazonie',      seed: [-73.0,   1.0], isCoastal: false },
  ]},
  peru:        { iso3: 'PER', provinces: [
    { name: 'Lima',          seed: [-77.0, -12.1], isCoastal: true  },
    { name: 'Andes',         seed: [-73.0, -14.0], isCoastal: false },
    { name: 'Amazonie',      seed: [-74.0,  -7.0], isCoastal: false },
    { name: 'Arequipa',      seed: [-71.5, -16.4], isCoastal: true  },
  ]},
};

// ─── Détecte si une géométrie traverse l'anti-méridien ─────────
// Si le spread brut de longitude > 180° → les coordonnées sont de part et d'autre de ±180°
function crossesAntimeridian(geometry) {
  if (!geometry || !geometry.coordinates) return false;
  let lngs = [];
  function collect(c, d) { if(d===0){lngs.push(c[0]);return;} for(const x of c) collect(x,d-1); }
  const depths = { Point:0, MultiPoint:1, LineString:1, Polygon:2, MultiPolygon:3 };
  const d = depths[geometry.type];
  if (d === undefined) return false;
  collect(geometry.coordinates, d);
  if (!lngs.length) return false;
  const min = Math.min(...lngs), max = Math.max(...lngs);
  return (max - min) > 180;
}

// ─── Distance anti-méridien entre deux points [lng, lat] ───────
function dist2(a, b) {
  let dlng = Math.abs(a[0] - b[0]);
  if (dlng > 180) dlng = 360 - dlng;
  const dlat = a[1] - b[1];
  return dlng * dlng + dlat * dlat;
}

// ─── Centroïde simple d'une géométrie GeoJSON ──────────────────
// Pour MultiPolygon : utilise uniquement le plus grand polygone (évite
// les centroides faussés par des petites îles lointaines ou l'anti-méridien)
function simpleCentroid(geometry) {
  if (!geometry) return null;

  if (geometry.type === 'MultiPolygon') {
    // Garder seulement le polygone avec le plus grand anneau extérieur
    let bestRing = null, bestLen = 0;
    for (const poly of geometry.coordinates) {
      const ring = poly[0];
      if (ring && ring.length > bestLen) { bestLen = ring.length; bestRing = ring; }
    }
    if (!bestRing || !bestRing.length) return null;
    const lng = bestRing.reduce((s,p)=>s+p[0],0)/bestRing.length;
    const lat = bestRing.reduce((s,p)=>s+p[1],0)/bestRing.length;
    return [lng, lat];
  }

  let pts = [];
  function collect(coords, depth) {
    if (depth === 0) { pts.push(coords); return; }
    for (const c of coords) collect(c, depth - 1);
  }
  const depths = { Point:0, MultiPoint:1, LineString:1, Polygon:2 };
  const d = depths[geometry.type];
  if (d === undefined) return null;
  collect(geometry.coordinates, d);
  if (!pts.length) return null;
  const lng = pts.reduce((s,p)=>s+p[0],0)/pts.length;
  const lat = pts.reduce((s,p)=>s+p[1],0)/pts.length;
  return [lng, lat];
}

async function main() {
  // ─── Charger adm1_game.geojson ──────────────────────────────
  console.log('Loading adm1_game.geojson...');
  const adm1Data = JSON.parse(readFileSync('./apps/client/public/adm1_game.geojson', 'utf8'));
  console.log(`  ${adm1Data.features.length} ADM1 features`);

  // Grouper les ADM1 par ISO3
  const byIso3 = new Map();
  for (const f of adm1Data.features) {
    const iso3 = f.properties.adm0_a3;
    if (!byIso3.has(iso3)) byIso3.set(iso3, []);
    byIso3.get(iso3).push(f);
  }

  const allFeatures = [];
  let totalProvinces = 0;
  let fallbackCount = 0;

  for (const [countryId, config] of Object.entries(COUNTRIES)) {
    const adm1s = byIso3.get(config.iso3);
    if (!adm1s || adm1s.length === 0) {
      console.warn(`  ⚠ No ADM1 data for ${countryId} (${config.iso3})`);
      continue;
    }

    const N = config.provinces.length;

    // Seuil max de distance : évite d'assigner des territoires ultra-marins
    const seedLngs = config.provinces.map(p => p.seed[0]);
    const seedLats = config.provinces.map(p => p.seed[1]);
    const seedSpanLng = Math.max(...seedLngs) - Math.min(...seedLngs);
    const seedSpanLat = Math.max(...seedLats) - Math.min(...seedLats);
    const seedDiag = Math.sqrt(seedSpanLng * seedSpanLng + seedSpanLat * seedSpanLat);
    const maxDist = Math.max(20, seedDiag * 0.8);

    // Pour chaque ADM1, calculer son centroïde et l'assigner à la province la plus proche
    const groups = Array.from({ length: N }, () => []);
    for (const adm1 of adm1s) {
      // Ignorer les features qui traversent l'anti-méridien (causent des artefacts d3-geo)
      if (crossesAntimeridian(adm1.geometry)) continue;

      let center;
      try { center = simpleCentroid(adm1.geometry); } catch { center = null; }
      if (!center || !isFinite(center[0]) || !isFinite(center[1])) continue;

      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < N; i++) {
        const d = dist2(center, config.provinces[i].seed);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      // Exclure les territoires ultra-marins trop éloignés de tout seed
      if (Math.sqrt(bestDist) > maxDist) continue;
      groups[bestIdx].push(adm1);
    }

    // Pour chaque groupe, fusionner les ADM1 en une province
    for (let i = 0; i < N; i++) {
      const province = config.provinces[i];
      const group = groups[i];

      if (group.length === 0) {
        // Aucun ADM1 assigné → créer un petit point symbolique au seed
        console.warn(`  ⚠ No ADM1 for ${countryId}/${province.name} — using seed point`);
        continue;
      }

      let geom;
      if (group.length === 1) {
        geom = group[0].geometry;
      } else {
        // Fusionner tous les ADM1 du groupe
        try {
          let merged = group[0];
          for (let j = 1; j < group.length; j++) {
            const result = turf.union(turf.featureCollection([merged, group[j]]));
            if (result) merged = result;
          }
          geom = merged.geometry;
        } catch (e) {
          // Fallback : utiliser le plus grand ADM1 du groupe
          geom = group.reduce((a, b) => {
            const sa = JSON.stringify(a.geometry).length;
            const sb = JSON.stringify(b.geometry).length;
            return sa > sb ? a : b;
          }).geometry;
          fallbackCount++;
        }
      }

      if (!geom) continue;

      allFeatures.push({
        type: 'Feature',
        id: `${countryId}-region-${i}`,
        properties: {
          regionId: `${countryId}-region-${i}`,
          name: province.name,
          countryId,
          isCoastal: province.isCoastal,
          adjacentTo: [],
        },
        geometry: geom,
      });
      totalProvinces++;
    }
  }

  // adjacence calculée plus tard (après auto-provinces) pour tout couvrir

  // ─── Nettoyage des géométries dégénérées ───────────────────
  for (const f of allFeatures) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'MultiPolygon') {
      g.coordinates = g.coordinates.filter(poly => poly && poly[0] && poly[0].length >= 3);
      if (g.coordinates.length === 0) {
        console.warn(`  ⚠ Empty MultiPolygon after cleanup: ${f.properties.regionId}`);
        f.geometry = null;
      } else if (g.coordinates.length === 1) {
        f.geometry = { type: 'Polygon', coordinates: g.coordinates[0] };
      }
    }
    if (g && g.type === 'Polygon' && (!g.coordinates[0] || g.coordinates[0].length < 3)) {
      console.warn(`  ⚠ Degenerate Polygon: ${f.properties.regionId}`);
      f.geometry = null;
    }
  }

  // ─── Auto-provinces pour les pays hors-jeu (ADM1 réelles via ne_adm1_10m.geojson) ──
  console.log('Generating auto-provinces for non-game countries using real ADM1 data...');
  const worldData = JSON.parse(readFileSync('./apps/client/public/world-countries.json', 'utf8'));
  const adm1Extra = JSON.parse(readFileSync('./ne_adm1_10m.geojson', 'utf8'));

  // Index ADM1 features par adm0_a3
  const adm1ByISO3 = new Map();
  for (const f of adm1Extra.features) {
    const iso = f.properties.adm0_a3;
    if (!adm1ByISO3.has(iso)) adm1ByISO3.set(iso, []);
    adm1ByISO3.get(iso).push(f);
  }

  // Mapping world-countries.json name → adm0_a3
  const WORLD_NAME_TO_ISO3 = {
    'Tanzania':'TZA','W. Sahara':'SAH','Kazakhstan':'KAZ','Uzbekistan':'UZB',
    'Papua New Guinea':'PNG','Dem. Rep. Congo':'COD','Somalia':'SOM','Sudan':'SDN',
    'Chad':'TCD','Haiti':'HTI','Dominican Rep.':'DOM','Bahamas':'BHS',
    'Falkland Is.':'FLK','Greenland':'GRL','Fr. S. Antarctic Lands':'ATF',
    'Timor-Leste':'TLS','Lesotho':'LSO','Uruguay':'URY','Bolivia':'BOL',
    'Panama':'PAN','Costa Rica':'CRI','Nicaragua':'NIC','Honduras':'HND',
    'El Salvador':'SLV','Guatemala':'GTM','Belize':'BLZ','Venezuela':'VEN',
    'Guyana':'GUY','Suriname':'SUR','Ecuador':'ECU','Puerto Rico':'PRI',
    'Jamaica':'JAM','Cuba':'CUB','Zimbabwe':'ZWE','Botswana':'BWA',
    'Namibia':'NAM','Senegal':'SEN','Mali':'MLI','Mauritania':'MRT',
    'Benin':'BEN','Niger':'NER','Cameroon':'CMR','Togo':'TGO','Ghana':'GHA',
    "Côte d'Ivoire":'CIV','Guinea':'GIN','Guinea-Bissau':'GNB','Liberia':'LBR',
    'Sierra Leone':'SLE','Burkina Faso':'BFA','Central African Rep.':'CAF',
    'Congo':'COG','Gabon':'GAB','Eq. Guinea':'GNQ','Zambia':'ZMB',
    'Malawi':'MWI','Mozambique':'MOZ','eSwatini':'SWZ','Angola':'AGO',
    'Burundi':'BDI','Lebanon':'LBN','Madagascar':'MDG','Gambia':'GMB',
    'Jordan':'JOR','United Arab Emirates':'ARE','Qatar':'QAT','Kuwait':'KWT',
    'Oman':'OMN','Vanuatu':'VUT','Cambodia':'KHM','Laos':'LAO','Myanmar':'MMR',
    'North Korea':'PRK','Mongolia':'MNG','Bangladesh':'BGD','Bhutan':'BTN',
    'Nepal':'NPL','Afghanistan':'AFG','Tajikistan':'TJK','Kyrgyzstan':'KGZ',
    'Turkmenistan':'TKM','Syria':'SYR','Armenia':'ARM','Belarus':'BLR',
    'Austria':'AUT','Hungary':'HUN','Moldova':'MDA','Romania':'ROU',
    'Lithuania':'LTU','Latvia':'LVA','Estonia':'EST','Bulgaria':'BGR',
    'Albania':'ALB','Croatia':'HRV','Switzerland':'CHE','Luxembourg':'LUX',
    'Belgium':'BEL','Portugal':'PRT','Ireland':'IRL','New Caledonia':'NCL',
    'Solomon Is.':'SLB','New Zealand':'NZL','Sri Lanka':'LKA','Taiwan':'TWN',
    'Denmark':'DNK','Iceland':'ISL','Azerbaijan':'AZE','Georgia':'GEO',
    'Philippines':'PHL','Malaysia':'MYS','Brunei':'BRN','Slovenia':'SVN',
    'Finland':'FIN','Slovakia':'SVK','Czechia':'CZE','Eritrea':'ERI',
    'Paraguay':'PRY','Yemen':'YEM','N. Cyprus':'CYN','Cyprus':'CYP',
    'Djibouti':'DJI','Somaliland':'SOL','Uganda':'UGA','Rwanda':'RWA',
    'Bosnia and Herz.':'BIH','Macedonia':'MKD','Serbia':'SRB','Montenegro':'MNE',
    'Kosovo':'KOS','Trinidad and Tobago':'TTO','S. Sudan':'SDS',
  };

  const GAME_NAMES = new Set([
    'United States of America','Brazil','Germany','Russia','India','Japan','Nigeria',
    'France','China','Saudi Arabia','Australia','Sweden','Algeria','Morocco','Tunisia',
    'Libya','Israel','Palestine','United Kingdom','Spain','Italy','Poland','Ukraine',
    'Turkey','Norway','Netherlands','Greece','South Korea','Indonesia','Vietnam',
    'Thailand','Pakistan','Iran','Iraq','South Africa','Egypt','Kenya','Ethiopia',
    'Canada','Mexico','Argentina','Chile','Colombia','Peru',
  ]);

  function autoCountryId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  // Génère N seeds répartis sur la bbox selon l'axe le plus long
  function generateSeeds(N, minLng, minLat, maxLng, maxLat) {
    const width = maxLng - minLng;
    const height = maxLat - minLat;
    const splitByLng = width >= height;
    const seeds = [];
    for (let i = 0; i < N; i++) {
      if (splitByLng) {
        seeds.push([minLng + (i + 0.5) * width / N, (minLat + maxLat) / 2]);
      } else {
        seeds.push([(minLng + maxLng) / 2, minLat + (i + 0.5) * height / N]);
      }
    }
    return seeds;
  }

  let autoCount = 0;
  for (const feature of worldData.features) {
    const name = feature.properties.name;
    if (GAME_NAMES.has(name)) continue;
    if (crossesAntimeridian(feature.geometry)) continue;

    const cid = autoCountryId(name);
    let bbox;
    try { bbox = turf.bbox(feature); } catch { continue; }
    const [minLng, minLat, maxLng, maxLat] = bbox;
    if (maxLng - minLng <= 0 || maxLat - minLat <= 0) continue;

    let area = 0;
    try { area = turf.area(feature); } catch { area = 0; }
    const N = area > 3e12 ? 5 : area > 8e11 ? 4 : area > 2e11 ? 3 : 2;

    const iso3 = WORLD_NAME_TO_ISO3[name];
    const adm1List = iso3 ? (adm1ByISO3.get(iso3) || []) : [];

    if (adm1List.length > 0) {
      // ── Méthode ADM1 : regrouper les ADM1 en N provinces par k-means simple ──
      const seeds = generateSeeds(N, minLng, minLat, maxLng, maxLat);
      const groups = Array.from({ length: N }, () => []);

      for (const adm1f of adm1List) {
        const lat = adm1f.properties.latitude ?? 0;
        const lng = adm1f.properties.longitude ?? 0;
        let bestIdx = 0, bestDist = Infinity;
        for (let i = 0; i < N; i++) {
          const dx = lng - seeds[i][0];
          const dy = lat - seeds[i][1];
          const d = dx * dx + dy * dy;
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        groups[bestIdx].push(adm1f);
      }

      let idx = 0;
      for (let i = 0; i < N; i++) {
        if (groups[i].length === 0) continue;

        let geom;
        if (groups[i].length === 1) {
          geom = groups[i][0].geometry;
        } else {
          try {
            let merged = groups[i][0];
            for (let j = 1; j < groups[i].length; j++) {
              const result = turf.union(turf.featureCollection([merged, groups[i][j]]));
              if (result) merged = result;
            }
            geom = merged.geometry;
          } catch {
            // Fallback : plus grand ADM1 du groupe
            geom = groups[i].reduce((a, b) =>
              JSON.stringify(a.geometry).length > JSON.stringify(b.geometry).length ? a : b
            ).geometry;
          }
        }
        if (!geom) continue;

        // Nettoyer MultiPolygon
        if (geom.type === 'MultiPolygon') {
          geom.coordinates = geom.coordinates.filter(p => p?.[0]?.length >= 3);
          if (geom.coordinates.length === 0) continue;
          if (geom.coordinates.length === 1) geom = { type: 'Polygon', coordinates: geom.coordinates[0] };
        }
        if (geom.type === 'Polygon' && (!geom.coordinates[0] || geom.coordinates[0].length < 3)) continue;

        allFeatures.push({
          type: 'Feature',
          id: `${cid}-region-${idx}`,
          properties: { regionId: `${cid}-region-${idx}`, name: `${name} ${idx + 1}`, countryId: cid, isCoastal: false, adjacentTo: [] },
          geometry: geom,
        });
        idx++;
        totalProvinces++;
        autoCount++;
      }
    } else {
      // ── Fallback bboxClip pour pays sans données ADM1 ──
      const width = maxLng - minLng;
      const height = maxLat - minLat;
      const splitByLng = width >= height;
      const step = splitByLng ? width / N : height / N;
      let idx = 0;
      for (let i = 0; i < N; i++) {
        const clipBbox = splitByLng
          ? [minLng + i * step - 0.01, minLat - 0.01, minLng + (i + 1) * step + 0.01, maxLat + 0.01]
          : [minLng - 0.01, minLat + i * step - 0.01, maxLng + 0.01, minLat + (i + 1) * step + 0.01];
        let clipped;
        try { clipped = turf.bboxClip(feature, clipBbox); } catch { continue; }
        if (!clipped?.geometry) continue;
        const g = clipped.geometry;
        if (g.type === 'MultiPolygon') {
          g.coordinates = g.coordinates.filter(p => p?.[0]?.length >= 3);
          if (g.coordinates.length === 0) continue;
          if (g.coordinates.length === 1) clipped.geometry = { type: 'Polygon', coordinates: g.coordinates[0] };
        }
        if (clipped.geometry.type === 'Polygon' && clipped.geometry.coordinates[0]?.length < 3) continue;
        let clipArea = 0;
        try { clipArea = turf.area(clipped); } catch { continue; }
        if (clipArea < 5e8) continue;
        allFeatures.push({
          type: 'Feature',
          id: `${cid}-region-${idx}`,
          properties: { regionId: `${cid}-region-${idx}`, name: `${name} ${idx + 1}`, countryId: cid, isCoastal: false, adjacentTo: [] },
          geometry: clipped.geometry,
        });
        idx++; totalProvinces++; autoCount++;
      }
    }
  }
  console.log(`  ${autoCount} auto-provinces generated for non-game countries`);

  // ─── Adjacence complète : intra-pays + cross-frontière ────────
  // Réinitialiser tous les adjacentTo (en cas de rebuild)
  for (const f of allFeatures) f.properties.adjacentTo = [];

  console.log('Computing full adjacency (intra + cross-border)...');
  const BUFFER_DEG = 0.12;

  // Pré-calcul des bbox pour filtre rapide
  const bboxes = allFeatures.map(f => {
    try { return turf.bbox(f); } catch { return null; }
  });

  const validIdx = allFeatures.map((_, i) => i).filter(i => bboxes[i] && allFeatures[i].geometry);
  let adjPairs = 0;

  for (let ii = 0; ii < validIdx.length; ii++) {
    const i = validIdx[ii];
    const bi = bboxes[i];
    for (let jj = ii + 1; jj < validIdx.length; jj++) {
      const j = validIdx[jj];
      const bj = bboxes[j];
      // Filtre bbox rapide
      if (bi[2] + BUFFER_DEG < bj[0] || bj[2] + BUFFER_DEG < bi[0]) continue;
      if (bi[3] + BUFFER_DEG < bj[1] || bj[3] + BUFFER_DEG < bi[1]) continue;
      try {
        const buf = turf.buffer(allFeatures[i], BUFFER_DEG, { units: 'degrees' });
        if (buf && turf.booleanIntersects(buf, allFeatures[j])) {
          allFeatures[i].properties.adjacentTo.push(allFeatures[j].id);
          allFeatures[j].properties.adjacentTo.push(allFeatures[i].id);
          adjPairs++;
        }
      } catch { /* skip */ }
    }
    if (ii % 50 === 0) process.stdout.write(`\r  ${ii}/${validIdx.length} provinces checked...`);
  }
  console.log(`\r  ${adjPairs} adjacency pairs computed (intra + cross-border)   `);

  // ─── Correction winding order pour d3-geo ──────────────────
  // d3-geo v1 attend des anneaux extérieurs CW (signed area > 0 en lon/lat)
  // turf produit du GeoJSON RFC 7946 CCW → inverser si nécessaire
  function signedArea2(ring) {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++)
      a += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
    return a;
  }
  function fixRing(ring, exterior) {
    const cw = signedArea2(ring) > 0;
    return exterior === cw ? ring : [...ring].reverse();
  }
  function fixWinding(geom) {
    if (!geom) return;
    if (geom.type === 'Polygon')
      geom.coordinates = geom.coordinates.map((r, i) => fixRing(r, i === 0));
    else if (geom.type === 'MultiPolygon')
      geom.coordinates = geom.coordinates.map(poly => poly.map((r, i) => fixRing(r, i === 0)));
  }
  for (const f of allFeatures) fixWinding(f.geometry);

  const output = { type: 'FeatureCollection', features: allFeatures.filter(f => f.geometry) };
  const json = JSON.stringify(output);
  writeFileSync('./apps/client/public/game-provinces.json', json);

  const mb = (Buffer.byteLength(json, 'utf8') / 1048576).toFixed(2);
  console.log(`\n✓ Generated ${totalProvinces} provinces (${mb} MB)`);
  if (fallbackCount > 0) console.log(`  ⚠ ${fallbackCount} union fallbacks`);
}

main().catch(console.error);
