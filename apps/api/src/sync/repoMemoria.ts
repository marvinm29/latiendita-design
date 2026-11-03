/** Solo para pruebas: registro de operaciones, todavía sin materializar entidades. */
import { ErrorSync, type EventoSync, type OperacionSync, type RepositorioSync } from "./servicio";

export class RepositorioSyncMemoria implements RepositorioSync {
  private readonly operaciones = new Map<string, { negocioId: string; huella: string; evento: EventoSync }>();
  private readonly eventos = new Map<string, EventoSync[]>();

  async registrar(negocioId: string, operacion: OperacionSync, huella: string): Promise<EventoSync> {
    const existente = this.operaciones.get(operacion.id);
    if (existente) {
      if (existente.negocioId !== negocioId || existente.huella !== huella) throw new ErrorSync("op_conflictiva");
      return structuredClone(existente.evento);
    }
    const anteriores = this.eventos.get(negocioId) ?? [];
    const evento: EventoSync = { secuencia: anteriores.length + 1, operacion: structuredClone(operacion) };
    this.operaciones.set(operacion.id, { negocioId, huella, evento });
    anteriores.push(evento);
    this.eventos.set(negocioId, anteriores);
    return structuredClone(evento);
  }

  async leer(negocioId: string, desde: number, limite: number): Promise<EventoSync[]> {
    return structuredClone((this.eventos.get(negocioId) ?? []).filter((e) => e.secuencia > desde).slice(0, limite));
  }
}
