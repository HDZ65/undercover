/**
 * Génère apps/client/public/adm1_game.geojson
 * Extrait les features ADM1 du 10m Natural Earth pour tous les pays du jeu.
 * Max 30 features par pays (on garde les plus hauts niveaux administratifs).
 * Usage: node build_adm1.js
 */
const fs = require('fs');

const GAME_ISO3 = new Set([
  'USA','BRA','FRA','DEU','SWE','RUS','NGA','MAR','DZA','TUN','LBY','ISR',
  'PSE','SAU','IND','CHN','JPN','AUS','GBR','ESP','ITA','POL','UKR','ROU',
  'NLD','BEL','AUT','CHE','PRT','GRC','NOR','FIN','DNK','CZE','SVK','HUN',
  'BGR','SRB','HRV','BIH','SVN','ALB','MKD','XKX','MNE','MDA','BLR','EST',
  'LVA','LTU','ISL','IRL','LUX','MLT','CYP','AND','SMR','LIE','MCO',
  'TUR','IRN','IRQ','SYR','JOR','LBN','YEM','OMN','ARE','QAT','BHR','KWT',
  'PAK','AFG','KAZ','UZB','TKM','TJK','KGZ','MNG','PRK','KOR','MMR','THA',
  'VNM','KHM','LAO','MYS','IDN','PHL','SGP','BRN','TLS','LKA','NPL','BTN',
  'MDV','BGD','GEO','ARM','AZE',
  'EGY','SDN','SSD','ETH','SOM','KEN','TZA','UGA','RWA','BDI','COD','COG',
  'CMR','CAF','TCD','NER','MLI','SEN','GIN','GNB','SLE','LBR','CIV','GHA',
  'BFA','BEN','TGO','MRT','GMB','CPV','STP','GNQ','GAB','AGO','NAM','BWA',
  'ZWE','ZMB','MWI','MOZ','ZAF','LSO','SWZ','DJI','ERI','MDG','SYC','COM',
  'MUS','ESH',
  'CAN','MEX','GTM','BLZ','HND','SLV','NIC','CRI','PAN','CUB','JAM','HTI',
  'DOM','TTO','BRB','GRD','LCA','VCT','ATG','DMA','KNA','BHS',
  'COL','VEN','GUY','SUR','GUF','ECU','PER','BOL','CHL','ARG','PRY','URY',
  'NZL','PNG','FJI','SLB','VUT','WSM','TON','KIR','FSM','MHL','PLW','NRU','TUV',
]);

const NE_REMAP = {
  'PSX': 'PSE', 'SDS': 'SSD', 'KOS': 'XKX',
  'SAH': 'ESH', 'SOL': 'SOM', 'CYN': 'CYP',
};

console.log('Loading...');
const raw = JSON.parse(fs.readFileSync('./ne_adm1_10m.geojson', 'utf8'));
console.log(`Total: ${raw.features.length} features`);

// Group features by country
const byCountry = new Map();
for (const f of raw.features) {
  const a3 = NE_REMAP[f.properties.adm0_a3] || f.properties.adm0_a3;
  if (!GAME_ISO3.has(a3)) continue;
  if (!byCountry.has(a3)) byCountry.set(a3, []);
  byCountry.get(a3).push(f);
}

// For each country: sort by scalerank ASC (most important first), keep max 30
const MAX_PER_COUNTRY = 120;
const kept = [];

for (const [a3, features] of byCountry) {
  // Sort ascending scalerank = most important features first
  features.sort((a, b) => (a.properties.scalerank || 9) - (b.properties.scalerank || 9));
  const take = features.slice(0, MAX_PER_COUNTRY);
  for (const f of take) {
    kept.push({
      type: 'Feature',
      properties: { adm0_a3: a3, name: f.properties.name },
      geometry: simplify(f.geometry),
    });
  }
}

console.log(`Kept: ${kept.length} features across ${byCountry.size} countries`);

// Spot-check problem countries
for (const a3 of ['FRA','GBR','ITA','DEU','ESP','PRT','POL','SVN','LVA']) {
  const c = kept.filter(f => f.properties.adm0_a3 === a3).length;
  console.log(`  ${a3}: ${c} features`);
}

function simplify(geom) {
  if (!geom) return geom;
  return { type: geom.type, coordinates: rc(geom.coordinates, geom.type) };
}
function rc(c, t) {
  if (t === 'Point') return [r(c[0]), r(c[1])];
  if (t === 'LineString' || t === 'MultiPoint') return dedup(c.map(p => [r(p[0]), r(p[1])]));
  if (t === 'Polygon' || t === 'MultiLineString') return c.map(ring => dedup(ring.map(p => [r(p[0]), r(p[1])])));
  if (t === 'MultiPolygon') return c.map(poly => poly.map(ring => dedup(ring.map(p => [r(p[0]), r(p[1])]))));
  return c;
}
function r(n) { return Math.round(n * 10) / 10; }  // 1 décimale ≈ 10km

// Supprime les points consécutifs identiques après arrondi
function dedup(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1];
    if (p[0] !== q[0] || p[1] !== q[1]) out.push(p);
  }
  return out;
}

const out = { type: 'FeatureCollection', features: kept };
const json = JSON.stringify(out);
const outPath = './apps/client/public/adm1_game.geojson';
fs.writeFileSync(outPath, json);
const mb = (Buffer.byteLength(json, 'utf8') / 1048576).toFixed(2);
console.log(`\n✓ Output: ${outPath} — ${mb} MB`);
