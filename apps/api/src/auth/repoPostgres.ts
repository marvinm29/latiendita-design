/**
 * Adaptador PostgreSQL (drizzle) del repositorio de auth.
 *
 * Las escrituras y el canje de invitación van en una transacción: o queda el
 * usuario + membresía + sesión y el código marcado como usado, o no queda nada.
 * RLS: donde se conoce el negocio se fija `app.negocio_id` con `set_config`.
 * Las búsquedas previas de /auth (por hash de código o de token) corren con el
 * rol dueño; S4 las mueve a una función SECURITY DEFINER (ver 0001_init.sql).
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { invitacion, membresia, negocio, sesion, usuario } from "../db/schema";
import type {
  CanjeInvitacion,
  FilaInvitacion,
  FilaMembresia,
  FilaNegocio,
  FilaSesion,
  FilaUsuario,
  NuevoNegocio,
  RepositorioAuth,
} from "./tipos";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const fecha = (ms: number): Date => new Date(ms);
const ms = (valor: Date | null): number | null => (valor ? valor.getTime() : null);

export class RepositorioAuthPostgres implements RepositorioAuth {
  constructor(private readonly db: Db) {}

  async crearNegocio(datos: NuevoNegocio): Promise<void> {
    await this.db.transaction(async (tx) => {
      await this.fijarNegocio(tx, datos.negocio.id);
      await tx.insert(negocio).values({
        id: datos.negocio.id,
        nombre: datos.negocio.nombre,
        moneda: datos.negocio.moneda,
        createdAt: fecha(datos.negocio.creadoEn),
      });
      await this.insertarUsuario(tx, datos.usuario);
      await this.insertarMembresia(tx, datos.membresia);
    });
  }

  async buscarNegocio(id: string): Promise<FilaNegocio | null> {
    const [fila] = await this.db.select().from(negocio).where(eq(negocio.id, id)).limit(1);
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
    const [fila] = await this.db
      .select()
      .from(invitacion)
      .where(eq(invitacion.codigoHash, codigoHash))
      .limit(1);
    if (!fila) return null;
    return {
      id: fila.id,
      negocioId: fila.negocioId,
      codigoHash: fila.codigoHash,
      expiraEn: fila.expiraAt.getTime(),
      usadaEn: ms(fila.usadaAt),
      createdBy: fila.createdBy,
      creadoEn: fila.createdAt.getTime(),
    };
  }

  async canjearInvitacion(datos: CanjeInvitacion): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await this.fijarNegocio(tx, datos.membresia.negocioId);

      // Un solo uso: sólo el primero que marque `usada_at` gana la carrera.
      const usadas = await tx
        .update(invitacion)
        .set({ usadaAt: fecha(datos.ahora) })
        .where(and(eq(invitacion.id, datos.invitacionId), isNull(invitacion.usadaAt)))
        .returning({ id: invitacion.id });
      if (usadas.length === 0) return false;

      await this.insertarUsuario(tx, datos.usuario);
      await this.insertarMembresia(tx, datos.membresia);
      await this.insertarSesion(tx, datos.sesion);
      return true;
    });
  }

  async buscarUsuario(id: string): Promise<FilaUsuario | null> {
    const [fila] = await this.db.select().from(usuario).where(eq(usuario.id, id)).limit(1);
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
    const [fila] = await this.db
      .select()
      .from(sesion)
      .where(eq(sesion.tokenHash, tokenHash))
      .limit(1);
    if (!fila) return null;
    return {
      id: fila.id,
      negocioId: fila.negocioId,
      usuarioId: fila.usuarioId,
      tokenHash: fila.tokenHash,
      rol: fila.rol,
      expiraEn: fila.expiraAt.getTime(),
      revocadaEn: ms(fila.revocadaAt),
      ultimoUsoEn: ms(fila.ultimoUsoAt),
      creadoEn: fila.createdAt.getTime(),
    };
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

  async marcarUsoSesion(id: string, ahora: number): Promise<void> {
    await this.db.update(sesion).set({ ultimoUsoAt: fecha(ahora) }).where(eq(sesion.id, id));
  }

  async revocarSesion(id: string, ahora: number): Promise<void> {
    await this.db
      .update(sesion)
      .set({ revocadaAt: fecha(ahora) })
      .where(and(eq(sesion.id, id), isNull(sesion.revocadaAt)));
  }

  private async fijarNegocio(tx: Tx, negocioId: string): Promise<void> {
    await tx.execute(sql`select set_config('app.negocio_id', ${negocioId}, true)`);
  }

  private async insertarUsuario(tx: Tx, fila: FilaUsuario): Promise<void> {
    await tx.insert(usuario).values({
      id: fila.id,
      nombre: fila.nombre,
      pinHash: fila.pinHash,
      createdAt: fecha(fila.creadoEn),
    });
  }

  private async insertarMembresia(tx: Tx, fila: FilaMembresia): Promise<void> {
    await tx.insert(membresia).values({
      id: fila.id,
      negocioId: fila.negocioId,
      usuarioId: fila.usuarioId,
      rol: fila.rol,
    });
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
