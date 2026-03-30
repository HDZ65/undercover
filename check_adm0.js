const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./ne_adm1_50m_lakes.geojson', 'utf8'));
const pairs = new Map();
for (const f of data.features) {
  const a3 = f.properties.adm0_a3;
  const admin = f.properties.admin;
  const key = a3 + '|' + admin;
  if (!pairs.has(key)) pairs.set(key, { adm0_a3: a3, admin, count: 0 });
  pairs.get(key).count++;
}
const sorted = [...pairs.values()].sort((a,b) => a.admin.localeCompare(b.admin));
for (const {adm0_a3, admin, count} of sorted) {
  console.log(adm0_a3.padEnd(6) + admin.padEnd(45) + count);
}
