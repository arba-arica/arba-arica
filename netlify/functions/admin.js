/**
 * netlify/functions/admin.js — v3.0
 * Variables de entorno en Netlify:
 *   SUPABASE_URL        = https://lwsyntjhbcdfuhfjdjqf.supabase.co
 *   SUPABASE_SERVICE_KEY = eyJ...service_role...
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

    // Acciones públicas (sin contraseña)
    const PUBLIC_ACTIONS = ['checkPassword', 'likeNoticia', 'checkLogin'];

    if (!PUBLIC_ACTIONS.includes(action) && adminPassword !== ADMIN_PWD) {
      return ok({ success: false, message: 'Contraseña incorrecta' });
    }

    let result;

    switch (action) {

      // ─── AUTH ────────────────────────────────────────────────
      case 'checkPassword':
        result = adminPassword === ADMIN_PWD
          ? { success: true }
          : { success: false, message: 'Contraseña incorrecta' };
        break;

      // ─── LOGIN CON EMAIL + CONTRASEÑA ────────────────────────
      case 'checkLogin': {
        // Admin fijo
        if (data.email === 'arba.arica@gmail.com' && data.password === ADMIN_PWD) {
          result = { success: true, usuario: { nombre: 'Admin ARBA', email: data.email, rol: 'admin' } };
          break;
        }
        // Buscar delegado en tabla usuarios
        const { data: usuario, error: errU } = await db
          .from('usuarios')
          .select('*')
          .eq('email', data.email.toLowerCase())
          .eq('activo', true)
          .maybeSingle();
        if (errU || !usuario) {
          result = { success: false, message: 'Email o contraseña incorrectos' };
          break;
        }
        // Comparar contraseña (plain text por ahora — mejorar con bcrypt en v3.1)
        if (usuario.password_hash !== data.password) {
          result = { success: false, message: 'Email o contraseña incorrectos' };
          break;
        }
        // Actualizar last_login
        await db.from('usuarios').update({ last_login: new Date().toISOString() }).eq('id', usuario.id);
        result = { success: true, usuario: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, id_equipo: usuario.id_equipo } };
        break;
      }

      // ─── PERSONAS PENDIENTES (para panel validar) ─────────────
      case 'getPersonasPendientes': {
        const { data: pendientes, error: errP } = await db
          .from('personas')
          .select('*')
          .eq('estado', 'pendiente')
          .order('created_at');
        result = errP ? fail(errP) : { success: true, data: pendientes || [] };
        break;
      }

      // ─── LIGAS ───────────────────────────────────────────────
      case 'createLeague': {
        const dep = data.nombreDeporte || 'Básquetbol';
        const pts = isBasket(dep) ? { v:2, e:0, d:1 } : { v:3, e:1, d:0 };
        const { error } = await db.from('ligas').insert({
          nombre_deporte:   dep,
          categoria:        ['Varones','Damas','Mixto'].includes(data.categoria) ? data.categoria : 'Varones',
          nombre_fantasia:  data.nombreFantasia || '',
          puntos_victoria:  pts.v, puntos_empate: pts.e, puntos_derrota: pts.d,
          estado_torneo:    data.estadoTorneo === 'Finalizado' ? 'Finalizado' : 'Activo',
        });
        result = error ? fail(error) : { success:true, message:'Liga creada' };
        break;
      }
      case 'updateLeague': {
        const dep = data.nombreDeporte || 'Básquetbol';
        const pts = isBasket(dep) ? { v:2, e:0, d:1 } : { v:3, e:1, d:0 };
        const { error } = await db.from('ligas').update({
          nombre_deporte:   dep,
          categoria:        data.categoria,
          nombre_fantasia:  data.nombreFantasia,
          puntos_victoria:  pts.v, puntos_empate: pts.e, puntos_derrota: pts.d,
          estado_torneo:    data.estadoTorneo === 'Finalizado' ? 'Finalizado' : 'Activo',
        }).eq('id', data.leagueId);
        result = error ? fail(error) : { success:true, message:'Liga actualizada' };
        break;
      }
      case 'deleteLeague': {
        const { error } = await db.from('ligas').delete().eq('id', data.leagueId);
        result = error ? fail(error) : { success:true, message:'Liga eliminada' };
        break;
      }

      // ─── EQUIPOS ─────────────────────────────────────────────
      case 'createTeam': {
        const { error } = await db.from('equipos').insert({
          id_liga:               data.idLiga,
          nombre_equipo:         data.nombreEquipo      || '',
          color_uniforme_local:  data.colorLocal        || '',
          color_uniforme_visita: data.colorVisita       || '',
          logo_url:              data.logoUrl           || '',
          delegado_nombre:       data.delegadoNombre    || '',
          delegado_email:        data.delegadoEmail     || '',
          delegado_telefono:     data.delegadoTelefono  || '',
          limite_jugadores:      parseInt(data.limiteJugadores) || 15,
          estado_validacion:     'pendiente',
        });
        result = error ? fail(error) : { success:true, message:'Equipo registrado' };
        break;
      }
      case 'updateTeam': {
        const { error } = await db.from('equipos').update({
          nombre_equipo:         data.nombreEquipo      || '',
          color_uniforme_local:  data.colorLocal        || '',
          color_uniforme_visita: data.colorVisita       || '',
          logo_url:              data.logoUrl           || '',
          delegado_nombre:       data.delegadoNombre    || '',
          delegado_email:        data.delegadoEmail     || '',
          delegado_telefono:     data.delegadoTelefono  || '',
          limite_jugadores:      parseInt(data.limiteJugadores) || 15,
          updated_at:            new Date().toISOString(),
        }).eq('id', data.teamId);
        result = error ? fail(error) : { success:true, message:'Equipo actualizado' };
        break;
      }
      case 'validateTeam': {
        // data.accion: 'aprobar' | 'rechazar'
        const update = data.accion === 'aprobar'
          ? { estado_validacion: 'validado', motivo_rechazo: null, updated_at: new Date().toISOString() }
          : { estado_validacion: 'rechazado', motivo_rechazo: data.motivo || '', updated_at: new Date().toISOString() };
        const { error } = await db.from('equipos').update(update).eq('id', data.teamId);
        result = error ? fail(error) : { success:true, message: data.accion === 'aprobar' ? 'Equipo aprobado' : 'Equipo rechazado' };
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
          foto_url:    data.fotoUrl     || '',
          enlace:      data.enlace      || '',
          me_gusta:    0,
        });
        result = error ? fail(error) : { success:true, message:'Noticia publicada' };
        break;
      }
      case 'updateNews': {
        const { error } = await db.from('noticias').update({
          titulo:      data.titulo      || '',
          descripcion: data.descripcion || '',
          imagen_url:  data.imagenUrl   || '',
          foto_url:    data.fotoUrl     || '',
          enlace:      data.enlace      || '',
        }).eq('id', data.newsId);
        result = error ? fail(error) : { success:true, message:'Noticia actualizada' };
        break;
      }
      case 'likeNoticia': {
        // Acción pública — suma 1 like
        const { data: noticia, error: errGet } = await db
          .from('noticias').select('me_gusta').eq('id', data.newsId).single();
        if (errGet) { result = fail(errGet); break; }
        const nuevoTotal = (noticia.me_gusta || 0) + (data.accion === 'unlike' ? -1 : 1);
        const { error } = await db.from('noticias')
          .update({ me_gusta: Math.max(0, nuevoTotal) }).eq('id', data.newsId);
        result = error ? fail(error) : { success:true, me_gusta: Math.max(0, nuevoTotal) };
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

      // ─── PERSONAS (jugadores, técnicos, delegados) ────────────
      case 'createPersona': {
        // Validar edad mínima 11 años
        if (data.fechaNacimiento) {
          const edad = calcularEdad(data.fechaNacimiento);
          if (edad < 11) {
            result = { success:false, message:`Edad mínima 11 años. Este jugador tiene ${edad} años.` };
            break;
          }
        }
        // Verificar si ya existe en otro equipo (mismo nombre + fecha)
        const { data: existe } = await db.from('personas')
          .select('id, id_equipo')
          .eq('nombre_completo', data.nombreCompleto)
          .eq('fecha_nacimiento', data.fechaNacimiento)
          .neq('id_equipo', data.idEquipo)
          .maybeSingle();
        const yaExiste = existe && existe.id;
        const { error } = await db.from('personas').insert({
          id_equipo:        data.idEquipo,
          id_liga:          data.idLiga,
          nombre_completo:  data.nombreCompleto    || '',
          fecha_nacimiento: data.fechaNacimiento   || null,
          rut:              data.rut               || '',
          rol:              ['jugador','cuerpo_tecnico','delegado'].includes(data.rol) ? data.rol : 'jugador',
          categoria:        ['Varones','Damas','Mixto'].includes(data.categoria) ? data.categoria : 'Varones',
          federado:         data.federado === true || data.federado === 'true',
          foto_rostro_url:  data.fotoRostroUrl     || '',
          email:            data.email             || '',
          telefono:         data.telefono          || '',
          estado:           'pendiente',
        });
        if (error) { result = fail(error); break; }
        result = {
          success: true,
          message: 'Jugador agregado y enviado a validación',
          aviso: yaExiste ? '⚠ Este jugador ya está registrado en otro equipo' : null,
        };
        break;
      }
      case 'updatePersona': {
        const { error } = await db.from('personas').update({
          nombre_completo:  data.nombreCompleto  || '',
          fecha_nacimiento: data.fechaNacimiento || null,
          rol:              data.rol             || 'jugador',
          categoria:        data.categoria       || 'Varones',
          federado:         data.federado === true || data.federado === 'true',
          foto_rostro_url:  data.fotoRostroUrl   || '',
          email:            data.email           || '',
          telefono:         data.telefono        || '',
          updated_at:       new Date().toISOString(),
        }).eq('id', data.personaId);
        result = error ? fail(error) : { success:true, message:'Jugador actualizado' };
        break;
      }
      case 'validatePersona': {
        // data.accion: 'aprobar' | 'rechazar'
        // data.ids: array de IDs para acción masiva, o data.personaId para individual
        const ids = data.ids || (data.personaId ? [data.personaId] : []);
        if (!ids.length) { result = { success:false, message:'No hay jugadores seleccionados' }; break; }
        const update = data.accion === 'aprobar'
          ? { estado: 'oficial', motivo_rechazo: null, validado_at: new Date().toISOString() }
          : { estado: 'rechazado', motivo_rechazo: data.motivo || 'Rechazado por admin', validado_at: new Date().toISOString() };
        const { error } = await db.from('personas').update(update).in('id', ids);
        result = error ? fail(error) : {
          success: true,
          message: data.accion === 'aprobar'
            ? `${ids.length} jugador(es) aprobado(s)`
            : `${ids.length} jugador(es) rechazado(s)`,
        };
        break;
      }
      case 'deletePersona': {
        const { error } = await db.from('personas').delete().eq('id', data.personaId);
        result = error ? fail(error) : { success:true, message:'Jugador eliminado' };
        break;
      }

      // ─── ESTADÍSTICAS (1P, 2P, 3P) ───────────────────────────
      case 'updateStats': {
        // Upsert stats de carrera por jugador + liga
        const { error } = await db.from('stats_carrera').upsert({
          id_jugador: data.idJugador,
          id_liga:    data.idLiga,
          partidos:   parseInt(data.partidos) || 0,
          pts_1p:     parseInt(data.pts1p)    || 0,
          pts_2p:     parseInt(data.pts2p)    || 0,
          pts_3p:     parseInt(data.pts3p)    || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id_jugador,id_liga' });
        result = error ? fail(error) : { success:true, message:'Estadísticas actualizadas' };
        break;
      }

      // ─── USUARIOS (Admin crea cuentas de delegados) ───────────
      case 'createUsuario': {
        const { error } = await db.from('usuarios').insert({
          nombre:        data.nombre    || '',
          email:         (data.email || '').toLowerCase(),
          password_hash: data.password  || '',
          rol:           ['admin','delegado','publico'].includes(data.rol) ? data.rol : 'delegado',
          id_equipo:     data.idEquipo  || null,
          activo:        true,
        });
        result = error ? fail(error) : { success:true, message:'Usuario creado. Se enviará acceso por correo.' };
        break;
      }
      case 'updateUsuario': {
        const { error } = await db.from('usuarios').update({
          nombre:    data.nombre    || '',
          email:     data.email     || '',
          rol:       data.rol       || 'delegado',
          id_equipo: data.idEquipo  || null,
          activo:    data.activo !== false,
        }).eq('id', data.usuarioId);
        result = error ? fail(error) : { success:true, message:'Usuario actualizado' };
        break;
      }
      case 'deleteUsuario': {
        const { error } = await db.from('usuarios').delete().eq('id', data.usuarioId);
        result = error ? fail(error) : { success:true, message:'Usuario eliminado' };
        break;
      }
      case 'aprobarSolicitudEdicion': {
        // Admin aprueba/rechaza solicitud de edición de delegado
        result = { success:true, message: data.accion === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada' };
        break;
      }

      // ─── DELETE GENÉRICO ─────────────────────────────────────
      case 'deleteItem': {
        const map = {
          Ligas:'ligas', Equipos:'equipos', Encuentros:'encuentros',
          Sanciones:'sanciones', Noticias:'noticias',
          Personas:'personas', Usuarios:'usuarios',
        };
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

// ─── HELPERS ──────────────────────────────────────────────────
const ok      = body => ({ statusCode:200, headers:HEADERS, body: JSON.stringify(body) });
const fail    = err  => ({ success:false, message: err.message || err.details || 'Error BD' });
const isBasket = d  => /básquet|basket|volei/i.test(d);

function calcularEdad(fechaNacimiento) {
  const hoy  = new Date();
  const nac  = new Date(fechaNacimiento);
  let edad   = hoy.getFullYear() - nac.getFullYear();
  const m    = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}
