/**
 * Adaptador en memoria del repositorio de auth: tests y desarrollo sin
 * PostgreSQL. Las filas se copian al entrar y salir para que nadie mute el
 * estado "por referencia" (misma semántica que una base).
 */
import type {
  CanjeInvitacion,
  FilaInvitacion,
  FilaNegocio,
  FilaSesion,
  FilaUsuario,
  FilaMembresia,
  NuevoNegocio,
  RepositorioAuth,
} from "./tipos";

function copiar<T extends object>(fila: T): T {
  return { ...fila };
}

export class RepositorioAuthMemoria implements RepositorioAuth {
  private readonly negocios = new Map<string, FilaNegocio>();
  private readonly usuarios = new Map<string, FilaUsuario>();
  private readonly membresias = new Map<string, FilaMembresia>();
  private readonly invitacionesPorId = new Map<string, FilaInvitacion>();
  private readonly invitacionesPorCodigo = new Map<string, FilaInvitacion>();
  private readonly sesionesPorId = new Map<string, FilaSesion>();
  private readonly sesionesPorToken = new Map<string, FilaSesion>();

  async crearNegocio(datos: NuevoNegocio): Promise<void> {
    this.negocios.set(datos.negocio.id, copiar(datos.negocio));
    this.usuarios.set(datos.usuario.id, copiar(datos.usuario));
    this.membresias.set(datos.membresia.id, copiar(datos.membresia));
  }

  async buscarNegocio(id: string): Promise<FilaNegocio | null> {
    const fila = this.negocios.get(id);
    return fila ? copiar(fila) : null;
  }

  async crearInvitacion(invitacion: FilaInvitacion): Promise<void> {
    this.invitacionesPorId.set(invitacion.id, copiar(invitacion));
    this.invitacionesPorCodigo.set(invitacion.codigoHash, copiar(invitacion));
  }

  async buscarInvitacionPorCodigo(codigoHash: string): Promise<FilaInvitacion | null> {
    const fila = this.invitacionesPorCodigo.get(codigoHash);
    return fila ? copiar(fila) : null;
  }

  async canjearInvitacion(datos: CanjeInvitacion): Promise<boolean> {
    const invitacion = this.invitacionesPorId.get(datos.invitacionId);
    if (!invitacion || invitacion.usadaEn !== null || invitacion.expiraEn <= datos.ahora) {
      return false;
    }

    const usada = { ...invitacion, usadaEn: datos.ahora };
    this.invitacionesPorId.set(usada.id, usada);
    this.invitacionesPorCodigo.set(usada.codigoHash, copiar(usada));
    this.usuarios.set(datos.usuario.id, copiar(datos.usuario));
    this.membresias.set(datos.membresia.id, copiar(datos.membresia));
    this.guardarSesion(datos.sesion);
    return true;
  }

  async buscarUsuario(id: string): Promise<FilaUsuario | null> {
    const fila = this.usuarios.get(id);
    return fila ? copiar(fila) : null;
  }

  async crearSesion(sesion: FilaSesion): Promise<void> {
    this.guardarSesion(sesion);
  }

  async buscarSesionPorToken(tokenHash: string): Promise<FilaSesion | null> {
    const fila = this.sesionesPorToken.get(tokenHash);
    return fila ? copiar(fila) : null;
  }

  async rotarSesion(idAnterior: string, nueva: FilaSesion): Promise<boolean> {
    const anterior = this.sesionesPorId.get(idAnterior);
    if (!anterior || anterior.revocadaEn !== null) return false;

    const revocada = { ...anterior, revocadaEn: nueva.creadoEn };
    this.sesionesPorId.set(revocada.id, revocada);
    this.sesionesPorToken.set(revocada.tokenHash, copiar(revocada));
    this.guardarSesion(nueva);
    return true;
  }

  async marcarUsoSesion(id: string, ahora: number): Promise<void> {
    const sesion = this.sesionesPorId.get(id);
    if (!sesion) return;
    const usada = { ...sesion, ultimoUsoEn: ahora };
    this.sesionesPorId.set(id, usada);
    this.sesionesPorToken.set(usada.tokenHash, copiar(usada));
  }

  async revocarSesion(id: string, ahora: number): Promise<void> {
    const sesion = this.sesionesPorId.get(id);
    if (!sesion) return;
    const revocada = { ...sesion, revocadaEn: ahora };
    this.sesionesPorId.set(id, revocada);
    this.sesionesPorToken.set(revocada.tokenHash, copiar(revocada));
  }

  private guardarSesion(sesion: FilaSesion): void {
    this.sesionesPorId.set(sesion.id, copiar(sesion));
    this.sesionesPorToken.set(sesion.tokenHash, copiar(sesion));
  }
}
