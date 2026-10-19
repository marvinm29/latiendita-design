/**
 * Cámara del escáner (C3) — chunk perezoso: este módulo SOLO se carga con
 * `import("./camara")` desde Escanear.tsx, nunca en el bundle inicial.
 *
 * Cadena de decisión (T-06): BarcodeDetector nativo → si no existe (o no
 * produce resultados en N frames), ZXing-wasm por import() dinámico (chunk
 * aparte) → teclado manual siempre visible (C3.2, nunca se bloquea).
 */

/** Tipos de zxing-wasm: sólo tipos, cero impacto en el bundle. */
import type { ReadInputBarcodeFormat } from "zxing-wasm/reader";

export type MotivoCamara = "permiso" | "detector" | "fallo" | "wasm";

export type ResultadoCamara =
  | { ok: true; control: ControlCamara }
  | { ok: false; motivo: MotivoCamara };

interface Lectura {
  rawValue: string;
}

/** BarcodeDetector nativo (no está en lib.dom — declaración mínima local). */
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Lectura[]>;
}

type BarcodeDetectorCtor = new (opciones?: { formats?: string[] }) => BarcodeDetectorLike;

export interface ControlCamara {
  /** Detiene el loop de detección y todas las pistas del stream. */
  apagar(): void;
  /** Intenta alternar la linterna (torch). Devuelve el estado final, false si falla. */
  alternarLinterna(): Promise<boolean>;
  /** El track del dispositivo soporta torch (linterna). */
  linternaDisponible: boolean;
}

/** ¿Hay getUserMedia? Único requisito duro: la detección puede ser nativa o ZXing. */
export function hayCamara(): boolean {
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

const FORMATOS_NATIVOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

/** Formatos del spec (003 T-06): EAN-13, EAN-8, UPC-A, Code128. */
const FORMATOS_ZXING: ReadInputBarcodeFormat[] = ["EAN13", "EAN8", "UPCA", "Code128"];

/** Frames nativos sin lectura (~12 s a 300 ms) antes de escalar a ZXing. */
const FRAMES_VACIOS_ANTES_ZXING = 40;
const INTERVALO_NATIVO_MS = 300;
/** ~4 fps en ZXing: decodificar en WASM cuesta CPU (gama baja, presupuesto 003). */
const INTERVALO_ZXING_MS = 250;
/** Lado mayor del frame que llega a ZXing: legible para EAN y barato de procesar. */
const LADO_MAX_ZXING = 640;

type LectorZXing = (imagen: ImageData) => Promise<Lectura[]>;

/** El override de locateFile solo se fija una vez por sesión de página. */
let zxingConfigurado = false;

/**
 * Carga perezosa de ZXing-wasm: `import()` dinámico ⇒ chunk separado del
 * bundle inicial. El `.wasm` se emite como asset y se localiza vía override.
 */
async function cargarZXing(): Promise<LectorZXing> {
  const [modulo, wasm] = await Promise.all([
    import("zxing-wasm/reader"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  if (!zxingConfigurado) {
    modulo.setZXingModuleOverrides({ locateFile: () => wasm.default });
    zxingConfigurado = true;
  }
  return async (imagen) => {
    const resultados = await modulo.readBarcodes(imagen, { formats: FORMATOS_ZXING });
    return resultados.map((lectura) => ({ rawValue: lectura.text }));
  };
}

/** Dígito verificador EAN-13 (trivial; un UPC-A es un EAN-13 con 0 delante). */
function digitoEan13Valido(codigo: string): boolean {
  let suma = 0;
  for (let i = 0; i < 12; i += 1) {
    suma += Number(codigo[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (suma % 10)) % 10 === Number(codigo[12]);
}

/**
 * Enciende la cámara y escanea en loop hasta `apagar()`.
 * `alDetectar` se llama con el código crudo; la página lo deduplica.
 */
export async function encender(
  video: HTMLVideoElement,
  alDetectar: (codigo: string) => void,
): Promise<ResultadoCamara> {
  if (!hayCamara()) return { ok: false, motivo: "detector" };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
  } catch (error) {
    const nombre = (error as DOMException | undefined)?.name;
    return {
      ok: false,
      motivo:
        nombre === "NotAllowedError" || nombre === "SecurityError" ? "permiso" : "fallo",
    };
  }

  try {
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error("sin pistas de video");

    const capacidades = track.getCapabilities?.() as
      | (MediaTrackCapabilities & { torch?: boolean })
      | undefined;
    const linternaDisponible = Boolean(capacidades?.torch);
    let linternaEncendida = false;

    // Detector nativo si existe; si no, ZXing-wasm (carga perezosa abajo).
    let detectarNativo: ((origen: HTMLVideoElement) => Promise<Lectura[]>) | null = null;
    if ("BarcodeDetector" in window) {
      const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
        .BarcodeDetector;
      let detector: BarcodeDetectorLike;
      try {
        detector = new Detector({ formats: FORMATOS_NATIVOS });
      } catch {
        // Un formato no soportado lanza al construir: sin formatos explícitos.
        detector = new Detector();
      }
      detectarNativo = (origen) => detector.detect(origen);
    }

    let usarZXing = detectarNativo === null;
    let leerZXing: LectorZXing | null = null;
    if (usarZXing) {
      try {
        leerZXing = await cargarZXing();
      } catch {
        // Fallback no cargó (p. ej. sin conexión y sin caché): mensaje claro y
        // teclado manual — el flujo nunca depende de la cámara (C3.2).
        for (const pista of stream.getTracks()) pista.stop();
        return { ok: false, motivo: "wasm" };
      }
    }

    let vivo = true;
    let ocupado = false;
    let dudosoPendiente: string | null = null;
    let framesVaciosNativo = 0;
    let escalacionFallida = false;

    // Lienzo reutilizado: frame reducido ⇒ getImageData y WASM cuestan menos.
    let lienzo: HTMLCanvasElement | null = null;
    let contexto: CanvasRenderingContext2D | null = null;
    const capturarFrame = (): ImageData | null => {
      const anchoVideo = video.videoWidth;
      const altoVideo = video.videoHeight;
      if (!anchoVideo || !altoVideo) return null;
      if (!lienzo || !contexto) {
        lienzo = document.createElement("canvas");
        contexto = lienzo.getContext("2d", { willReadFrequently: true });
        if (!contexto) return null;
      }
      const escala = Math.min(1, LADO_MAX_ZXING / Math.max(anchoVideo, altoVideo));
      const ancho = Math.round(anchoVideo * escala);
      const alto = Math.round(altoVideo * escala);
      if (lienzo.width !== ancho || lienzo.height !== alto) {
        lienzo.width = ancho;
        lienzo.height = alto;
      }
      contexto.drawImage(video, 0, 0, ancho, alto);
      return contexto.getImageData(0, 0, ancho, alto);
    };

    const tick = async (): Promise<void> => {
      if (!vivo || ocupado || video.readyState < 2) return;
      ocupado = true;
      try {
        if (!usarZXing && detectarNativo) {
          const lecturas = await detectarNativo(video);
          if (lecturas.length > 0) {
            if (vivo) alDetectar(lecturas[0]!.rawValue);
            ocupado = false;
            return;
          }
          framesVaciosNativo += 1;
          // El nativo existe pero no produce resultados en N frames: escalar a
          // ZXing una sola vez; si la carga falla, la cámara nativa sigue.
          if (
            vivo &&
            !escalacionFallida &&
            framesVaciosNativo >= FRAMES_VACIOS_ANTES_ZXING
          ) {
            escalacionFallida = true;
            try {
              leerZXing = await cargarZXing();
              usarZXing = true;
              clearInterval(intervalo);
              intervalo = setInterval(() => void tick(), INTERVALO_ZXING_MS);
            } catch {
              // Sin fallback disponible: seguimos con el detector nativo.
            }
          }
        } else if (usarZXing && leerZXing) {
          const imagen = capturarFrame();
          if (imagen) {
            const lecturas = await leerZXing(imagen);
            if (vivo && lecturas.length > 0) {
              const codigo = lecturas[0]!.rawValue.trim();
              if (codigo !== "") {
                // EAN-13 con dígito válido se acepta al primer frame; con dígito
                // dudoso se exige una lectura repetida y luego se pasa tal cual.
                const dudoso =
                  /^\d{13}$/.test(codigo) && !digitoEan13Valido(codigo);
                if (!dudoso || dudosoPendiente === codigo) {
                  dudosoPendiente = null;
                  alDetectar(codigo);
                } else {
                  dudosoPendiente = codigo;
                }
              }
            }
          }
        }
      } catch {
        // Frame ilegible (autofocus, blur): el siguiente tick lo reintenta.
      }
      ocupado = false;
    };
    let intervalo = setInterval(
      () => void tick(),
      usarZXing ? INTERVALO_ZXING_MS : INTERVALO_NATIVO_MS,
    );

    return {
      ok: true,
      control: {
        linternaDisponible,
        async alternarLinterna(): Promise<boolean> {
          linternaEncendida = !linternaEncendida;
          try {
            await track.applyConstraints({
              advanced: [{ torch: linternaEncendida } as MediaTrackConstraintSet],
            });
            return linternaEncendida;
          } catch {
            return false;
          }
        },
        apagar(): void {
          vivo = false;
          clearInterval(intervalo);
          for (const pista of stream.getTracks()) pista.stop();
        },
      },
    };
  } catch {
    for (const pista of stream.getTracks()) pista.stop();
    return { ok: false, motivo: "fallo" };
  }
}
