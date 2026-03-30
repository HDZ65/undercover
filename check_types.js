const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('./ne_adm1_10m.geojson', 'utf8'));

// Check France features
console.log('=== FRANCE features ===');
for (const f of raw.features) {
  if (f.properties.adm0_a3 === 'FRA') {
    console.log(`  ${(f.properties.name || '').padEnd(30)} type_en=${(f.properties.type_en || '').padEnd(20)} scalerank=${f.properties.scalerank}`);
  }
}

// Check types for countries with many features
console.log('\n=== UK features (first 10) ===');
let uk = 0;
for (const f of raw.features) {
  if (f.properties.adm0_a3 === 'GBR' && uk < 10) {
    console.log(`  ${(f.properties.name || '').padEnd(30)} type_en=${(f.properties.type_en || '').padEnd(20)} scalerank=${f.properties.scalerank}`);
    uk++;
  }
}

// Count types globally
const typeCounts = {};
for (const f of raw.features) {
  const t = f.properties.type_en || 'unknown';
  typeCounts[t] = (typeCounts[t] || 0) + 1;
}
console.log('\n=== Global type_en counts ===');
for (const [t, c] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${t.padEnd(30)} ${c}`);
}

// Check scalerank distribution
const srCounts = {};
for (const f of raw.features) {
  const sr = f.properties.scalerank;
  srCounts[sr] = (srCounts[sr] || 0) + 1;
}
console.log('\n=== Scalerank distribution ===');
for (const [sr, c] of Object.entries(srCounts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`  scalerank ${sr}: ${c}`);
}
