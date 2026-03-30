import { readFileSync } from 'fs';
const world = JSON.parse(readFileSync('apps/client/public/world-countries.json', 'utf8'));

const GAME_IDS = new Set(['usa','brazil','france','germany','sweden','russia','nigeria','morocco','algeria','tunisia','libya','israel','palestine','saudi','india','china','japan','australia','uk','spain','italy','poland','ukraine','turkey','norway','netherlands','greece','south_korea','indonesia','vietnam','thailand','pakistan','iran','iraq','south_africa','egypt','kenya','ethiopia','canada','mexico','argentina','chile','colombia','peru']);

const NAME_TO_ID = {
  'Fiji':'fiji','Tanzania':'tanzania','W. Sahara':'w_sahara','Kazakhstan':'kazakhstan',
  'Uzbekistan':'uzbekistan','Papua New Guinea':'papua_new_guinea','Dem. Rep. Congo':'dem_rep_congo',
  'Somalia':'somalia','Sudan':'sudan','Chad':'chad','Haiti':'haiti','Dominican Rep.':'dominican_rep',
  'Bahamas':'bahamas','Falkland Is.':'falkland_is','Greenland':'greenland',
  'Fr. S. Antarctic Lands':'fr_s_antarctic_lands','Timor-Leste':'timor_leste','Lesotho':'lesotho',
  'Uruguay':'uruguay','Bolivia':'bolivia','Panama':'panama','Costa Rica':'costa_rica',
  'Nicaragua':'nicaragua','Honduras':'honduras','El Salvador':'el_salvador','Guatemala':'guatemala',
  'Belize':'belize','Venezuela':'venezuela','Guyana':'guyana','Suriname':'suriname','Ecuador':'ecuador',
  'Puerto Rico':'puerto_rico','Jamaica':'jamaica','Cuba':'cuba','Zimbabwe':'zimbabwe',
  'Botswana':'botswana','Namibia':'namibia','Senegal':'senegal','Mali':'mali','Mauritania':'mauritania',
  'Benin':'benin','Niger':'niger','Cameroon':'cameroon','Togo':'togo','Ghana':'ghana',
  "Cote d'Ivoire":'c_te_d_ivoire',"Côte d'Ivoire":'c_te_d_ivoire',
  'Guinea':'guinea','Guinea-Bissau':'guinea_bissau','Liberia':'liberia','Sierra Leone':'sierra_leone',
  'Burkina Faso':'burkina_faso','Central African Rep.':'central_african_rep','Congo':'congo',
  'Gabon':'gabon','Eq. Guinea':'eq_guinea','Zambia':'zambia','Malawi':'malawi',
  'Mozambique':'mozambique','eSwatini':'eswatini','Angola':'angola','Burundi':'burundi',
  'Lebanon':'lebanon','Madagascar':'madagascar','Gambia':'gambia','Jordan':'jordan',
  'United Arab Emirates':'united_arab_emirates','Qatar':'qatar','Kuwait':'kuwait','Oman':'oman',
  'Vanuatu':'vanuatu','Cambodia':'cambodia','Laos':'laos','Myanmar':'myanmar','North Korea':'north_korea',
  'Mongolia':'mongolia','Bangladesh':'bangladesh','Bhutan':'bhutan','Nepal':'nepal',
  'Afghanistan':'afghanistan','Tajikistan':'tajikistan','Kyrgyzstan':'kyrgyzstan',
  'Turkmenistan':'turkmenistan','Syria':'syria','Armenia':'armenia','Belarus':'belarus',
  'Austria':'austria','Hungary':'hungary','Moldova':'moldova','Romania':'romania',
  'Lithuania':'lithuania','Latvia':'latvia','Estonia':'estonia','Bulgaria':'bulgaria',
  'Albania':'albania','Croatia':'croatia','Switzerland':'switzerland','Luxembourg':'luxembourg',
  'Belgium':'belgium','Portugal':'portugal','Ireland':'ireland','New Caledonia':'new_caledonia',
  'Solomon Is.':'solomon_is','New Zealand':'new_zealand','Sri Lanka':'sri_lanka','Taiwan':'taiwan',
  'Denmark':'denmark','Iceland':'iceland','Azerbaijan':'azerbaijan','Georgia':'georgia',
  'Philippines':'philippines','Malaysia':'malaysia','Brunei':'brunei','Slovenia':'slovenia',
  'Finland':'finland','Slovakia':'slovakia','Czechia':'czechia','Eritrea':'eritrea',
  'Paraguay':'paraguay','Yemen':'yemen','N. Cyprus':'n_cyprus','Cyprus':'cyprus',
  'Djibouti':'djibouti','Somaliland':'somaliland','Uganda':'uganda','Rwanda':'rwanda',
  'Bosnia and Herz.':'bosnia_and_herz','Macedonia':'macedonia','Serbia':'serbia',
  'Montenegro':'montenegro','Kosovo':'kosovo','Trinidad and Tobago':'trinidad_and_tobago',
  'S. Sudan':'s_sudan',
};

function getBBoxCenter(geom) {
  let minLng=Infinity,maxLng=-Infinity,minLat=Infinity,maxLat=-Infinity;
  function processRing(ring) {
    for (const [lng,lat] of ring) {
      if(lng<minLng)minLng=lng; if(lng>maxLng)maxLng=lng;
      if(lat<minLat)minLat=lat; if(lat>maxLat)maxLat=lat;
    }
  }
  if(geom.type==='Polygon')geom.coordinates.forEach(r=>processRing(r));
  else if(geom.type==='MultiPolygon')geom.coordinates.forEach(p=>p.forEach(r=>processRing(r)));
  return [Math.round((minLng+maxLng)/2), Math.round((minLat+maxLat)/2)];
}

const entries = [];
for (const f of world.features) {
  const id = NAME_TO_ID[f.properties.name];
  if (!id || GAME_IDS.has(id)) continue;
  const [lng,lat] = getBBoxCenter(f.geometry);
  entries.push(`  ${id}: [${lng}, ${lat}]`);
}
console.log(entries.join(',\n'));
