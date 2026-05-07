/**
 * LigaPro — Migración Google Sheets → Supabase
 * node migrate.js
 */
const { createClient } = require('@supabase/supabase-js');

const SHEET_ID       = '1um07vUGnRs7Dnym5m1I9J646FkQ8qcrpScH3l6cRNag';
const SHEETS_API_KEY = 'AIzaSyAVXcke5pxu8DGPT3JPIbfBZDt8656b858';
const SUPABASE_URL   = 'https://lwsyntjhbcdfuhfjdjqf.supabase.co';
const SERVICE_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3c3ludGpoYmNkZnVoZmpkanFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODExMTc2NiwiZXhwIjoyMDkzNjg3NzY2fQ.KVEkvuJhwKiWbas1tI-qhZ1aas2JQ9_Jxc6cMxnnybw';

const db = createClient(SUPABASE_URL, SERVICE_KEY);

async function readSheet(name) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(name)}?key=${SHEETS_API_KEY}`;
  const res  = await fetch(url);
  const json = await res.json();
  const rows = json.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r[0]).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h === 'PuntosLocal')  h = 'GolesLocal';
      if (h === 'PuntosVisita') h = 'GolesVisita';
      obj[h] = row[i] !== undefined ? row[i] : '';
    });
    return obj;
  });
}

function parseFecha(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const num = parseFloat(s);
  if (!isNaN(num) && num > 1000) {
    const d = new Date((num - 25569) * 86400000);
    return d.toISOString().split('T')[0];
  }
  return null;
}

async function upsert(table, rows) {
  if (!rows.length) { console.log(`  ${table}: sin datos`); return; }
  const { error } = await db.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ✓ ${table}: ${rows.length} filas`);
}

async function migrate() {
  console.log('\n🏀 Migración Google Sheets → Supabase\n');
  console.log('📖 Leyendo Sheets...');
  const [ligas, equipos, encuentros, sanciones, noticias] = await Promise.all([
    readSheet('Ligas'), readSheet('Equipos'), readSheet('Encuentros'),
    readSheet('Sanciones'), readSheet('Noticias'),
  ]);
  console.log(`   Ligas:${ligas.length} Equipos:${equipos.length} Encuentros:${encuentros.length} Sanciones:${sanciones.length} Noticias:${noticias.length}\n`);

  console.log('📤 Subiendo a Supabase...');

  await upsert('ligas', ligas.map(r => ({
    id: r.ID,
    nombre_deporte:   r.NombreDeporte  || 'Básquetbol',
    categoria:        ['Varones','Damas','Mixto'].includes(r.Categoria) ? r.Categoria : 'Varones',
    nombre_fantasia:  r.NombreFantasia || '',
    puntos_victoria:  parseInt(r.PuntosVictoria) || 2,
    puntos_empate:    parseInt(r.PuntosEmpate)   || 0,
    puntos_derrota:   parseInt(r.PuntosDerrota)  || 1,
    estado_torneo:    r.EstadoTorneo === 'Finalizado' ? 'Finalizado' : 'Activo',
  })));

  await upsert('equipos', equipos.map(r => ({
    id:                    r.ID,
    id_liga:               r.ID_Liga,
    nombre_equipo:         r.NombreEquipo         || '',
    color_uniforme_local:  r.ColorUniformeLocal   || '',
    color_uniforme_visita: r.ColorUniformeVisita  || '',
  })));

  const estadosOk = ['Programado','1° Cuarto','2° Cuarto','3° Cuarto','4° Cuarto','Finalizado'];
  const fasesOk   = ['Regular','Grupo A','Grupo B','Grupo C','Grupo D','Semifinales','Tercer Lugar','Final'];
  await upsert('encuentros', encuentros.map(r => ({
    id:               r.ID,
    id_liga:          r.ID_Liga,
    partidos:         parseInt(r.Partidos) || 0,
    fecha:            parseFecha(r.Fecha),
    hora:             r.Hora    || '',
    cancha:           r.Cancha  || '',
    fase:             fasesOk.includes(r.Fase) ? r.Fase : 'Regular',
    id_equipo_local:  r.ID_EquipoLocal,
    goles_local:      r.GolesLocal  !== '' ? parseInt(r.GolesLocal)  : null,
    goles_visita:     r.GolesVisita !== '' ? parseInt(r.GolesVisita) : null,
    id_equipo_visita: r.ID_EquipoVisita,
    estado:           estadosOk.includes(r.Estado) ? r.Estado : 'Programado',
    youtube_url:      r.YoutubeURL || '',
  })));

  await upsert('sanciones', sanciones.map(r => ({
    id:              r.ID,
    id_liga:         r.ID_Liga   || null,
    id_equipo:       r.ID_Equipo || null,
    nombre_jugador:  r.NombreJugador  || '',
    tipo_falta:      r.TipoFalta      || '',
    sancion:         r.Sancion        || '',
    termino_sancion: r.TerminoSancion || '',
  })));

  await upsert('noticias', noticias.map(r => ({
    id:          r.ID,
    fecha:       parseFecha(r.Fecha) ? parseFecha(r.Fecha)+'T12:00:00Z' : new Date().toISOString(),
    titulo:      r.Titulo      || '',
    descripcion: r.Descripcion || '',
    imagen_url:  r.ImagenURL   || '',
    enlace:      r.Enlace      || '',
  })));

  console.log('\n🔍 Verificando...');
  for (const t of ['ligas','equipos','encuentros','sanciones','noticias']) {
    const { count } = await db.from(t).select('*', { count:'exact', head:true });
    console.log(`   ${t}: ${count} filas`);
  }
  console.log('\n✅ Migración completa. Ya puedes conectar el frontend.\n');
}

migrate().catch(e => { console.error('\n❌', e.message); process.exit(1); });