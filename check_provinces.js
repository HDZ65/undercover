const d = JSON.parse(require('fs').readFileSync('./apps/client/public/game-provinces.json','utf8'));
let bad = 0;
for (const f of d.features) {
  const g = f.geometry;
  if (!g || !g.coordinates || g.coordinates.length === 0) {
    bad++;
    console.log('Empty/null:', f.properties.regionId);
    continue;
  }
  if (g.type === 'Polygon') {
    if (!g.coordinates[0] || g.coordinates[0].length < 3) {
      bad++;
      console.log('Bad Polygon ring:', f.properties.regionId, 'len=', g.coordinates[0]?.length);
    }
  }
  if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates) {
      if (!poly || !poly[0] || poly[0].length < 3) {
        bad++;
        console.log('Bad MultiPolygon ring:', f.properties.regionId, 'ring len=', poly?.[0]?.length);
      }
    }
  }
}
console.log('Bad geometries:', bad);
