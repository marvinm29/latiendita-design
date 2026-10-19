/**
 * Límite de intentos en memoria (T-05): frena la fuerza bruta de códigos de
 * invitación por IP y por código. Ventana deslizante simple; suficiente para
 * un solo proceso. Si la API escala a varias instancias, S4 lo mueve a Redis
 * o a la base (deuda anotada en specs/003 §7).
 */
export interface OpcionesLimitador {
  maximo?: number;
  ventanaMs?: number;
  ahora?: () => number;
  maxClaves?: number;
}

export class LimitadorIntentos {
  private readonly fallos = new Map<string, number[]>();
  private readonly maximo: number;
  private readonly ventanaMs: number;
  private readonly ahora: () => number;
  private readonly maxClaves: number;

  constructor(opciones: OpcionesLimitador = {}) {
    this.maximo = opciones.maximo ?? 5;
    this.ventanaMs = opciones.ventanaMs ?? 10 * 60 * 1000;
    this.ahora = opciones.ahora ?? (() => Date.now());
    this.maxClaves = opciones.maxClaves ?? 5_000;
  }

  /** ¿Todavía puede intentarlo? No cuenta el intento; ver `registrarFallo`. */
  permitir(clave: string): boolean {
    return this.vigentes(clave).length < this.maximo;
  }

  registrarFallo(clave: string): void {
    const ahora = this.ahora();
    const lista = this.vigentes(clave);
    lista.push(ahora);
    this.fallos.set(clave, lista);

    if (this.fallos.size > this.maxClaves) {
      const primera = this.fallos.keys().next().value;
      if (primera !== undefined) this.fallos.delete(primera);
    }
  }

  /** Un acierto limpia la clave (no penaliza a quien ya entró). */
  limpiar(clave: string): void {
    this.fallos.delete(clave);
  }

  private vigentes(clave: string): number[] {
    const desde = this.ahora() - this.ventanaMs;
    const lista = (this.fallos.get(clave) ?? []).filter((instante) => instante > desde);
    if (lista.length === 0) this.fallos.delete(clave);
    else this.fallos.set(clave, lista);
    return lista;
  }
}
