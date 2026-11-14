-- Ejecutar como migrador, después de las migraciones, en la base de la app.
-- Antes: SELECT set_config('latiendita.rol_app', '<rol de conexión API>', false);
-- No concede propiedad, membresía administrativa, DDL ni acceso a sync experimental.
DO $$
DECLARE rol text := current_setting('latiendita.rol_app');
BEGIN
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', rol);
  EXECUTE format('GRANT SELECT ON public.negocio, public.usuario, public.membresia, public.invitacion, public.sesion TO %I', rol);
  EXECUTE format('GRANT INSERT ON public.invitacion, public.sesion TO %I', rol);
  EXECUTE format('GRANT UPDATE (revocada_at, ultimo_uso_at) ON public.sesion TO %I', rol);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.auth_buscar_invitacion(text), public.auth_buscar_sesion(text), public.auth_crear_negocio(uuid, text, text, timestamptz, uuid, text, text, uuid, uuid, text, timestamptz), public.auth_canjear_invitacion(uuid, uuid, timestamptz, uuid, text, text, uuid, uuid, text, timestamptz) TO %I', rol);
END;
$$;
