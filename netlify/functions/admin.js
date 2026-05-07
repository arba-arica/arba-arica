/**
 * netlify/functions/admin.js
 * Reemplaza code.gs — mismas acciones, mismo adminPassword
 * Variables de entorno en Netlify:
 *   SUPABASE_URL        = https://lwsyntjhbcdfuhfjdjqf.supabase.co
 *   SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiO...
 *   ADMIN_PASSWORD      = Arba26*XXL
 */
const { createClient } = require('@supabase/supabase-js');

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const ADMIN_PWD = process.env.ADMIN_PASSWORD || 'Arba26*XXL';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };

  try {
    const body = JSON.parse(event.body || '{}');
    const { action, adminPassword, ...data } = body;

    if (action !== 'checkPassword' && adminPassword !== ADMIN_PWD) {
      return ok({ success: false, message: 'Contraseña incorrecta' });
    }

    let result;

    switch (action) {

      case 'checkPassword':
        result = adminPassword === ADMIN_PWD
          ? { success: true }
          : { success: false, message: 'Contraseña incorrecta' };
        break;

      // ─── LIGAS ───────────────────────────────────────────────
      case 'createLeague': {
        const dep = data.nombreDeporte || 'Básquetbol';
        const pts = isBasket(dep) ? { v:2, e:0, d:1 } : { v:3, e:1, d:0 };
        const { error } = await db.from('ligas').insert({
          nombre_deporte:  dep,
          categoria:       ['Varones','Damas','Mixto'].includes(data.categoria) ? data.categoria : 'Varones',
          nombre_fantasia: data.nombreFantasia || '',
          puntos_victoria: pts.v, puntos_empate: pts.e, puntos_derrota: pts.d,
          estado_torneo:   data.estadoTorneo === 'Finalizado' ? 'Finalizado' : 'Activo',
        });
        result = error ? fail(error) : { success:true, message:'Liga creada' };
        break;
      }
      case 'updateLeague': {
        const dep = data.nombreDeporte || 'Básquetbol';
        const pts = isBasket(dep) ? { v:2, e:0, d:1 } : { v:3, e:1, d:0 };
        const { error } = await db.from('ligas').update({
          nombre_deporte:  dep,
          categoria:       data.categoria,
          nombre_fantasia: data.nombreFantasia,
          puntos_victoria: pts.v, puntos_empate: pts.e, puntos_derrota: pts.d,
          estado_torneo:   data.estadoTorneo === 'Finalizado' ? 'Finalizado' : 'Activo',
        }).eq('id', data.leagueId);
        result = error ? fail(error) : { success:true, message:'Liga actualizada' };
        break;
      }
      case 'deleteLeague': {
        // cascade borra equipos + encuentros automáticamente
        const { error } = await db.from('ligas').delete().eq('id', data.leagueId);
        result = error ? fail(error) : { success:true, message:'Liga eliminada' };
        break;
      }

      // ─── EQUIPOS ─────────────────────────────────────────────
      case 'createTeam': {
        const { error } = await db.from('equipos').insert({
          id_liga:               data.idLiga,
          nombre_equipo:         data.nombreEquipo       || '',
          color_uniforme_local:  data.colorLocal         || '',
          color_uniforme_visita: data.colorVisita        || '',
        });
        result = error ? fail(error) : { success:true, message:'Equipo registrado' };
        break;
      }

      // ─── ENCUENTROS ──────────────────────────────────────────
      case 'createMatch': {
        const fasesOk = ['Regular','Grupo A','Grupo B','Grupo C','Grupo D','Semifinales','Tercer Lugar','Final'];
        const { error } = await db.from('encuentros').insert({
          id_liga:          data.idLiga,
          partidos:         parseInt(data.jornada) || 0,
          fecha:            data.fecha || null,
          hora:             data.hora    || '',
          cancha:           data.cancha  || '',
          fase:             fasesOk.includes(data.fase) ? data.fase : 'Regular',
          id_equipo_local:  data.idLocal,
          id_equipo_visita: data.idVisita,
          goles_local:      null,
          goles_visita:     null,
          estado:           'Programado',
          youtube_url:      data.youtubeUrl || '',
        });
        result = error ? fail(error) : { success:true, message:'Partido programado' };
        break;
      }
      case 'updateMatch': {
        const { error } = await db.from('encuentros').update({
          id_liga:  data.idLiga,
          partidos: parseInt(data.partidos) || 0,
          fecha:    data.fecha  || null,
          hora:     data.hora   || '',
          cancha:   data.cancha || '',
          fase:     data.fase   || 'Regular',
        }).eq('id', data.matchId);
        result = error ? fail(error) : { success:true, message:'Partido actualizado' };
        break;
      }
      case 'updateMatchResult': {
        const estadosOk = ['Programado','1° Cuarto','2° Cuarto','3° Cuarto','4° Cuarto','Finalizado'];
        const { error } = await db.from('encuentros').update({
          goles_local:  parseInt(data.golesLocal)  || 0,
          goles_visita: parseInt(data.golesVisita) || 0,
          estado:       estadosOk.includes(data.estado) ? data.estado : 'Programado',
        }).eq('id', data.matchId);
        result = error ? fail(error) : { success:true, message:'Resultado actualizado' };
        break;
      }
      case 'deleteMatch': {
        const { error } = await db.from('encuentros').delete().eq('id', data.matchId);
        result = error ? fail(error) : { success:true, message:'Partido eliminado' };
        break;
      }

      // ─── NOTICIAS ────────────────────────────────────────────
      case 'createNews': {
        const { error } = await db.from('noticias').insert({
          titulo:      data.titulo      || '',
          descripcion: data.descripcion || '',
          imagen_url:  data.imagenUrl   || '',
          enlace:      data.enlace      || '',
        });
        result = error ? fail(error) : { success:true, message:'Noticia publicada' };
        break;
      }

      // ─── SANCIONES ───────────────────────────────────────────
      case 'createSanction': {
        const termino = (data.termino || '') +
          (data.apelacion ? ' | Apelación: ' + data.apelacion : '');
        const { error } = await db.from('sanciones').insert({
          id_liga:         data.idLiga   || null,
          id_equipo:       data.idEquipo || null,
          nombre_jugador:  data.nombreJugador || '',
          tipo_falta:      data.tipoFalta     || '',
          sancion:         data.sancion       || '',
          termino_sancion: termino,
        });
        result = error ? fail(error) : { success:true, message:'Sanción registrada' };
        break;
      }
      case 'updateSanction': {
        const { error } = await db.from('sanciones').update({
          id_liga:         data.idLiga   || null,
          id_equipo:       data.idEquipo || null,
          nombre_jugador:  data.nombreJugador || '',
          tipo_falta:      data.tipoFalta     || '',
          sancion:         data.sancion       || '',
          termino_sancion: data.termino       || '',
        }).eq('id', data.sanctionId);
        result = error ? fail(error) : { success:true, message:'Sanción actualizada' };
        break;
      }

      // ─── DELETE GENÉRICO ─────────────────────────────────────
      case 'deleteItem': {
        const map = { Ligas:'ligas', Equipos:'equipos', Encuentros:'encuentros',
                      Sanciones:'sanciones', Noticias:'noticias' };
        const tabla = map[data.sheet];
        if (!tabla) { result = { success:false, message:'Tabla no permitida' }; break; }
        const { error } = await db.from(tabla).delete().eq('id', data.id);
        result = error ? fail(error) : { success:true, message:'Eliminado' };
        break;
      }

      default:
        result = { success:false, message:'Acción no reconocida: ' + action };
    }

    return ok(result);

  } catch (err) {
    return ok({ success:false, message: err.message });
  }
};

// ─── Helpers ─────────────────────────────────────────────────
const ok   = body => ({ statusCode:200, headers:HEADERS, body: JSON.stringify(body) });
const fail = err  => ({ success:false, message: err.message || err.details || 'Error BD' });
const isBasket = d => /básquet|basket|volei/i.test(d);
