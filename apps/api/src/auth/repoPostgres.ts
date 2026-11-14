/**
 * Adaptador PostgreSQL (drizzle) del repositorio de auth.
 *
 * Las escrituras y el canje de invitación van en una transacción: o queda el
 * usuario + membresía + sesión y el código marcado como usado, o no queda nada.
 * RLS: donde se conoce el negocio se fija `app.negocio_id` con `set_config`.
 * Sólo las búsquedas iniciales y altas atómicas usan las funciones acotadas
 * de 0004. La conexión de la API no es dueña ni tiene BYPASSRLS.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { invitacion, negocio, sesion, usuario } from "../db/schema";
import type {
  CanjeInvitacion,
  FilaInvitacion,
  FilaNegocio,
  FilaSesion,
  FilaUsuario,
  NuevoNegocio,
  RepositorioAuth,
} from "./tipos";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const fecha = (ms: number): Date => new Date(ms);

export class RepositorioAuthPostgres implements RepositorioAuth {
  constructor(private readonly db: Db) {}

  async crearNegocio(datos: NuevoNegocio): Promise<void> {
    await this.db.execute(sql`select public.auth_crear_negocio(
      ${datos.negocio.id}::uuid, ${datos.negocio.nombre}, ${datos.negocio.moneda},
      ${fecha(datos.negocio.creadoEn)}::timestamptz, ${datos.usuario.id}::uuid,
      ${datos.usuario.nombre}, ${datos.usuario.pinHash}, ${datos.membresia.id}::uuid,
      ${datos.sesion.id}::uuid, ${datos.sesion.tokenHash}, ${fecha(datos.sesion.expiraEn)}::timestamptz
    )`);
  }

  async buscarNegocio(id: string): Promise<FilaNegocio | null> {
    const [fila] = await this.conNegocio(id, (tx) => tx.select().from(negocio).where(eq(negocio.id, id)).limit(1));
    if (!fila || fila.deletedAt !== null) return null;
    return {
      id: fila.id,
      nombre: fila.nombre,
      moneda: fila.moneda,
      creadoEn: fila.createdAt.getTime(),
    };
  }

  async crearInvitacion(fila: FilaInvitacion): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.fijarNegocio(tx, fila.negocioId);
      await tx.insert(invitacion).values({
        id: fila.id,
        negocioId: fila.negocioId,
        codigoHash: fila.codigoHash,
        expiraAt: fecha(fila.expiraEn),
        usadaAt: fila.usadaEn === null ? null : fecha(fila.usadaEn),
        createdBy: fila.createdBy,
        createdAt: fecha(fila.creadoEn),
      });
    });
  }

  async buscarInvitacionPorCodigo(codigoHash: string): Promise<FilaInvitacion | null> {
    const { rows } = await this.db.execute<FilaInvitacion & Record<string, unknown>>(sql`
      select id, negocio_id as "negocioId", codigo_hash as "codigoHash", created_by as "createdBy",
        (extract(epoch from expira_at) * 1000)::double precision as "expiraEn",
        (extract(epoch from usada_at) * 1000)::double precision as "usadaEn",
        (extract(epoch from created_at) * 1000)::double precision as "creadoEn"
      from public.auth_buscar_invitacion(${codigoHash})
    `);
    return rows[0] ?? null;
  }

  async canjearInvitacion(datos: CanjeInvitacion): Promise<boolean> {
    const { rows } = await this.db.execute<{ canjeado: boolean }>(sql`
      select public.auth_canjear_invitacion(
        ${datos.invitacionId}::uuid, ${datos.membresia.negocioId}::uuid, ${fecha(datos.ahora)}::timestamptz,
        ${datos.usuario.id}::uuid, ${datos.usuario.nombre}, ${datos.usuario.pinHash}, ${datos.membresia.id}::uuid,
        ${datos.sesion.id}::uuid, ${datos.sesion.tokenHash}, ${fecha(datos.sesion.expiraEn)}::timestamptz
      ) as canjeado
    `);
    return rows[0]?.canjeado === true;
  }

  async buscarUsuario(id: string, negocioId: string): Promise<FilaUsuario | null> {
    const [fila] = await this.conNegocio(negocioId, (tx) => tx.select().from(usuario).where(eq(usuario.id, id)).limit(1));
    if (!fila || fila.deletedAt !== null) return null;
    return {
      id: fila.id,
      nombre: fila.nombre,
      pinHash: fila.pinHash,
      creadoEn: fila.createdAt.getTime(),
    };
  }

  async crearSesion(fila: FilaSesion): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.fijarNegocio(tx, fila.negocioId);
      await this.insertarSesion(tx, fila);
    });
  }

  async buscarSesionPorToken(tokenHash: string): Promise<FilaSesion | null> {
    const { rows } = await this.db.execute<FilaSesion & Record<string, unknown>>(sql`
      select id, negocio_id as "negocioId", usuario_id as "usuarioId", token_hash as "tokenHash", rol,
        (extract(epoch from expira_at) * 1000)::double precision as "expiraEn",
        (extract(epoch from revocada_at) * 1000)::double precision as "revocadaEn",
        (extract(epoch from ultimo_uso_at) * 1000)::double precision as "ultimoUsoEn",
        (extract(epoch from created_at) * 1000)::double precision as "creadoEn"
      from public.auth_buscar_sesion(${tokenHash})
    `);
    return rows[0] ?? null;
  }

  async rotarSesion(idAnterior: string, nueva: FilaSesion): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await this.fijarNegocio(tx, nueva.negocioId);
      const revocadas = await tx
        .update(sesion)
        .set({ revocadaAt: fecha(nueva.creadoEn) })
        .where(and(eq(sesion.id, idAnterior), isNull(sesion.revocadaAt)))
        .returning({ id: sesion.id });
      if (revocadas.length === 0) return false;

      await this.insertarSesion(tx, nueva);
      return true;
    });
  }

  async marcarUsoSesion(id: string, ahora: number, negocioId: string): Promise<void> {
    await this.conNegocio(negocioId, (tx) => tx.update(sesion).set({ ultimoUsoAt: fecha(ahora) }).where(eq(sesion.id, id)));
  }

  async revocarSesion(id: string, ahora: number, negocioId: string): Promise<void> {
    await this.conNegocio(negocioId, (tx) => tx
      .update(sesion)
      .set({ revocadaAt: fecha(ahora) })
      .where(and(eq(sesion.id, id), isNull(sesion.revocadaAt))));
  }

  private async conNegocio<T>(negocioId: string, ejecutar: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await this.fijarNegocio(tx, negocioId);
      return ejecutar(tx);
    });
  }

  private async fijarNegocio(tx: Tx, negocioId: string): Promise<void> {
    await tx.execute(sql`select set_config('app.negocio_id', ${negocioId}, true)`);
  }

  private async insertarSesion(tx: Tx, fila: FilaSesion): Promise<void> {
    await tx.insert(sesion).values({
      id: fila.id,
      negocioId: fila.negocioId,
      usuarioId: fila.usuarioId,
      tokenHash: fila.tokenHash,
      rol: fila.rol,
      expiraAt: fecha(fila.expiraEn),
      revocadaAt: fila.revocadaEn === null ? null : fecha(fila.revocadaEn),
      ultimoUsoAt: fila.ultimoUsoEn === null ? null : fecha(fila.ultimoUsoEn),
      createdAt: fecha(fila.creadoEn),
    });
  }
}
