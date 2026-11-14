-- A · Auth sin conexión de la API como dueño de tablas.
-- El migrador conserva la propiedad. Sólo estas funciones acotadas cruzan RLS.
BEGIN;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- SET LOCAL deja una cadena vacía en conexiones reutilizadas: vacío = sin contexto.
ALTER POLICY negocio_aislamiento ON negocio
  USING (id = nullif(current_setting('app.negocio_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.negocio_id', true), '')::uuid);
ALTER POLICY membresia_aislamiento ON membresia
  USING (negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid)
  WITH CHECK (negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid);
DROP POLICY usuario_aislamiento ON usuario;
CREATE POLICY usuario_aislamiento ON usuario FOR SELECT USING (
  deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM public.membresia m WHERE m.usuario_id = usuario.id
      AND m.negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid
      AND m.deleted_at IS NULL
  )
);
ALTER POLICY invitacion_aislamiento ON invitacion
  USING (negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid)
  WITH CHECK (
    negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid
    AND EXISTS (SELECT 1 FROM public.membresia m
      WHERE m.usuario_id = invitacion.created_by AND m.negocio_id = invitacion.negocio_id
        AND m.rol = 'dueña' AND m.deleted_at IS NULL)
  );
ALTER POLICY sesion_aislamiento ON sesion
  USING (negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid)
  WITH CHECK (
    negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid
    AND EXISTS (SELECT 1 FROM public.membresia m
      WHERE m.usuario_id = sesion.usuario_id AND m.negocio_id = sesion.negocio_id
        AND m.rol = sesion.rol AND m.deleted_at IS NULL)
  );

CREATE FUNCTION public.auth_buscar_invitacion(p_hash text)
RETURNS SETOF public.invitacion LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT i.* FROM public.invitacion i JOIN public.negocio n ON n.id = i.negocio_id
  WHERE i.codigo_hash = p_hash AND n.deleted_at IS NULL;
$$;

CREATE FUNCTION public.auth_buscar_sesion(p_hash text)
RETURNS SETOF public.sesion LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT s.* FROM public.sesion s
  JOIN public.negocio n ON n.id = s.negocio_id AND n.deleted_at IS NULL
  JOIN public.usuario u ON u.id = s.usuario_id AND u.deleted_at IS NULL
  WHERE s.token_hash = p_hash AND EXISTS (
    SELECT 1 FROM public.membresia m WHERE m.negocio_id = s.negocio_id
      AND m.usuario_id = s.usuario_id AND m.rol = s.rol AND m.deleted_at IS NULL
  );
$$;

CREATE FUNCTION public.auth_crear_negocio(
  p_negocio uuid, p_nombre text, p_moneda text, p_fecha timestamptz,
  p_usuario uuid, p_nombre_usuario text, p_pin text, p_membresia uuid,
  p_sesion uuid, p_token text, p_expira timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF p_moneda <> 'USD' OR btrim(p_nombre) = '' OR btrim(p_nombre_usuario) = '' THEN
    RAISE EXCEPTION 'Datos de alta inválidos' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.negocio (id, nombre, moneda, created_at)
    VALUES (p_negocio, p_nombre, p_moneda, p_fecha);
  INSERT INTO public.usuario (id, nombre, pin_hash, created_at)
    VALUES (p_usuario, p_nombre_usuario, p_pin, p_fecha);
  INSERT INTO public.membresia (id, negocio_id, usuario_id, rol)
    VALUES (p_membresia, p_negocio, p_usuario, 'dueña');
  INSERT INTO public.sesion (id, negocio_id, usuario_id, token_hash, rol, expira_at, created_at)
    VALUES (p_sesion, p_negocio, p_usuario, p_token, 'dueña', p_expira, p_fecha);
END;
$$;

CREATE FUNCTION public.auth_canjear_invitacion(
  p_invitacion uuid, p_negocio uuid, p_ahora timestamptz,
  p_usuario uuid, p_nombre text, p_pin text, p_membresia uuid,
  p_sesion uuid, p_token text, p_expira timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE public.invitacion i SET usada_at = p_ahora
  WHERE i.id = p_invitacion AND i.negocio_id = p_negocio
    AND i.usada_at IS NULL AND i.expira_at > p_ahora
    AND EXISTS (SELECT 1 FROM public.negocio n WHERE n.id = p_negocio AND n.deleted_at IS NULL);
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.usuario (id, nombre, pin_hash, created_at)
    VALUES (p_usuario, p_nombre, p_pin, p_ahora);
  INSERT INTO public.membresia (id, negocio_id, usuario_id, rol)
    VALUES (p_membresia, p_negocio, p_usuario, 'empleado');
  INSERT INTO public.sesion (id, negocio_id, usuario_id, token_hash, rol, expira_at, created_at)
    VALUES (p_sesion, p_negocio, p_usuario, p_token, 'empleado', p_expira, p_ahora);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_buscar_invitacion(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_buscar_sesion(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_crear_negocio(uuid, text, text, timestamptz, uuid, text, text, uuid, uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_canjear_invitacion(uuid, uuid, timestamptz, uuid, text, text, uuid, uuid, text, timestamptz) FROM PUBLIC;

COMMIT;
