-- seguridad_datos.sql · v3.4
-- Ejecutar en Supabase → SQL Editor DESPUÉS de desplegar el nuevo index.html y admin.js.
-- Es seguro ejecutarlo más de una vez. No borra datos.

-- 1) usuarios: nadie la lee ni la modifica con la clave pública.
--    Solo admin.js (clave service_role) puede usarla.
alter table public.usuarios enable row level security;
drop policy if exists "Lectura publica" on public.usuarios;
revoke all on public.usuarios from anon, authenticated;

-- 2) personas: tiene RUT y fecha de nacimiento (muchos menores de edad).
--    Se quita la lectura pública. El panel la sigue usando a través de admin.js.
alter table public.personas enable row level security;
drop policy if exists "Lectura publica" on public.personas;
revoke all on public.personas from anon, authenticated;

-- 3) Resto de tablas: lectura pública se mantiene, escritura solo vía admin.js.
do $$
declare t text;
begin
  foreach t in array array['ligas','equipos','encuentros','sanciones','noticias','stats_carrera','temporadas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 4) Comprobación: debe mostrar rls = true en todas y ninguna política sobre personas/usuarios.
select c.relname as tabla, c.relrowsecurity as rls,
       (select string_agg(policyname || ' (' || cmd || ')', ', ') from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as politicas
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
