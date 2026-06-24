# ARBA Arica — App de Competencias · v3.2

Este documento registra **qué se cambió, por qué, y los pasos exactos para desplegarlo**, además del **historial de prompts** usado para producir esta actualización. Sirve como referencia para futuras mejoras: copia y adapta los prompts de la sección final cuando quieras pedir un cambio similar.

---

## 1. Qué cambió en esta versión (v3.2)

### Panel administrador
1. **Cerrar temporada** ahora sí deja un historial con datos reales (antes el filtro por temporada no funcionaba porque las ligas nunca quedaban amarradas a una temporada).
2. **Crear una temporada nueva** ya no arrastra ligas/equipos/partidos de la anterior — nace en blanco. Los datos viejos no se borran: quedan guardados, solo dejan de mostrarse como "activos".
3. **Historial de temporadas** muestra solo nombre + fecha de cierre + botón de descarga PDF — sin tablas expuestas en pantalla. Si se necesita el detalle, se descarga el PDF.
4. **Nuevo modal "Configurar período"**: permite fijar a mano si la temporada es Apertura, Clausura, Verano, Invierno u "Otro" (nombre personalizado) + el año. Ese texto alimenta directamente el header del panel público.

### Panel público
1. Solo se muestra la **temporada activa**. Las cerradas se movieron al **footer**, con un botón de descarga PDF cada una (nada de tablas en pantalla).
2. El **header** ahora muestra "BASQUET XV REGIÓN / ARICA · CHILE" centrado, con el período del torneo activo debajo (ej. "TORNEO APERTURA 2026"), calculado automáticamente desde la configuración de temporada. *(El logo circular se probó y se quitó por feedback de diseño — el título centrado sin logo se veía mejor.)*
3. **Switch de tema claro/oscuro** en el header, con detección automática de `prefers-color-scheme` al entrar.
4. El **footer** es una franja blanca de ancho completo (full-bleed) con el banner de auspiciadores (Mesa Regional, ABA, ARBA, Municipalidad, SEREMI), igual al diseño aprobado — sin texto adicional debajo.
5. Los cards de "Próximo partido" y "Resultado" comparten el mismo layout centrado (equipo · VS o marcador · equipo, con cancha/fase/fecha debajo). En "Resultado", el equipo **ganador** y su marcador quedan resaltados; el perdedor en gris.

---

## 2. Pasos para desplegar (en orden)

### Paso 1 — Migración de base de datos (Supabase)
Abre **Supabase → SQL Editor → New query**, pega el contenido de `migracion_temporadas.sql` (incluido en esta entrega) y ejecútalo. Agrega:
- `temporadas.periodo` (text), `temporadas.anio` (integer), `temporadas.nombre_personalizado` (text)
- `ligas.id_temporada` (uuid, referencia a `temporadas.id`) — si no existía ya

Es seguro ejecutarlo más de una vez.

### Paso 2 — Subir el banner de auspiciadores
El footer público referencia esta URL:
```
https://lwsyntjhbcdfuhfjdjqf.supabase.co/storage/v1/object/public/imagenes/banner_auspiciadores.png
```
Sube el archivo `banner.png` (el mismo que ya tienes en el proyecto, con el marco azul y los 5 logos) a ese bucket/ruta en **Supabase Storage**, con ese nombre exacto — o ajusta la URL en `index.html` (buscar `pf-banner-strip`) si prefieres otra ruta o usar Netlify/otro hosting de imágenes.

### Paso 3 — Desplegar `admin.js`
Reemplaza `netlify/functions/admin.js` por la versión incluida. Variables de entorno sin cambios (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_PASSWORD`).

### Paso 4 — Desplegar `index.html`
Reemplaza el archivo principal de tu sitio (Netlify/WordPress/donde lo tengas alojado) por la nueva versión.

### Paso 5 — Primera configuración
1. Entra al panel admin → pestaña **Temporada**.
2. Si ya existe una temporada activa de antes de esta actualización, usa **"✎ Configurar período"** para fijar su Período + Año (por ejemplo, Apertura 2026) — así el header público mostrará el texto correcto desde el primer momento.
3. Si quieres que las ligas existentes queden formalmente amarradas a esa temporada (recomendado para que el cierre futuro las archive correctamente), ejecuta el `UPDATE` opcional comentado en `migracion_temporadas.sql` después del paso 1.

---

## 3. Decisiones de diseño (para no repetirlas a ciegas en el futuro)

- El **splash/listado de partidos** (próximos, resultados, tabla de posiciones) vive siempre en un esquema oscuro fijo tipo "tarjeta deportiva" — el switch de tema claro/oscuro **no** lo afecta, solo afecta el header y el footer públicos. Esto fue intencional para mantener buen contraste de colores de equipo sobre fondo oscuro.
- Las ligas/partidos/sanciones **sin `id_temporada` asignado** (datos previos a esta actualización) se siguen mostrando junto a la temporada activa para no perder información existente. Una vez que se crean ligas nuevas después de esta actualización, quedan correctamente amarradas y el comportamiento de "nace en blanco" aplica de lleno.
- El historial (tanto en admin como en el footer público) deliberadamente **no** muestra tablas — solo nombre, fecha de cierre y botón PDF. Si en el futuro se pide mostrar algo más ahí, conviene preguntar primero si de verdad debe estar visible o si conviene mantenerlo "bajo demanda" vía PDF.

---

## 4. Historial de prompts (para reusar en futuras actualizaciones)

Copia y adapta estos prompts como plantilla cuando quieras pedir cambios similares — mientras más específico seas sobre **qué se ve mal y qué debería pasar en su lugar**, menos vueltas se necesitan.

### Prompt 1 — Plantear los cambios y pedir borrador
> "Panel admin: [problema 1], [problema 2]... Panel público: [problema 1], [problema 2]...
> Antes de hacer los cambios, veamos todo en modo borrador y luego de la revisión, hacemos el cambio de código. Te adjunto el HTML y el admin.js. Además agrégame el README.md con esta actualización en modo prompts para futuras actualizaciones."

### Prompt 2 — Afinar el borrador con feedback puntual
> "El footer se adapta bien para teléfonos móviles? Podría ser más sutil... Abajo dice [X], debe decir [Y]... En el header debe decir [X]... Donde dice [sección], debe estar centrado, esta información debe ser igual en [otra sección], solo se agrega [diferencia]."

### Prompt 3 — Ajuste fino con referencia visual
> "[Adjuntar imagen de referencia] En el footer, solo eso debe aparecer, siguiendo el borde de la línea azul, el resto está de más... En el header, debe ir el título centrado, dependerá si el torneo es apertura o clausura, crear un modal en el panel admin para indicar de forma manual el período y año."

### Prompt 4 — Aprobar y pasar a código real
> "Perfecto, solo que [detalle final menor], pasemos al código real, ya que es un cambio mínimo."

### Tips para la próxima vez
- Si vas a pedir un cambio de **colores o paleta**, indica si aplica al splash/tarjetas deportivas o solo al header/footer (recordar la decisión de diseño de la sección 3).
- Si vas a pedir cambios de **temporada/período**, recuerda que el texto del header se genera automáticamente desde Período + Año — no hace falta pedir que se edite "a mano" en el header, se edita desde el modal del admin.
- Si subes una **imagen de referencia**, indica explícitamente qué partes de la imagen son textuales (deben copiarse igual) y cuáles son solo composición/diseño (pueden adaptarse).

---

## 5. Archivos de esta entrega

| Archivo | Qué es | Dónde va |
|---|---|---|
| `index.html` | App completa (panel público + admin) | Raíz del sitio (Netlify/WordPress/hosting) |
| `admin.js` | Función serverless | `netlify/functions/admin.js` |
| `migracion_temporadas.sql` | Script SQL de migración | Supabase → SQL Editor (ejecutar una vez) |
| `README.md` | Este documento | Repositorio del proyecto, para referencia futura |
