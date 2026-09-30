/**
 * Cámara del escáner (C3) — chunk perezoso: este módulo SOLO se carga con
 * `import("./camara")` desde Escanear.tsx, nunca en el bundle inicial.
 *
 * Detector: BarcodeDetector nativo si existe (T-06). El fallback ZXing-wasm
 * perezoso queda para un chunk posterior — hoy no se añade librería pesada
 * al bundle (presupuesto 003 §8: JS inicial ≤150KB gzip).
 */

export type MotivoCamara = "permiso" | "detector" | "fallo";

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

/** ¿Hay soporte nativo de detección + getUserMedia? Guard de la página. */
export function hayDetector(): boolean {
  return (
    "BarcodeDetector" in window &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

/**
 * Enciende la cámara y escanea en loop hasta `apagar()`.
 * `alDetectar` se llama con el código crudo; la página lo deduplica.
 */
export async function encender(
  video: HTMLVideoElement,
  alDetectar: (codigo: string) => void,
): Promise<ResultadoCamara> {
  if (!hayDetector()) return { ok: false, motivo: "detector" };

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

    const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
      .BarcodeDetector;
    let detector: BarcodeDetectorLike;
    try {
      detector = new Detector({ formats: FORMATOS });
    } catch {
      // Un formato no soportado lanza al construir: sin formatos explícitos.
      detector = new Detector();
    }

    let vivo = true;
    let ocupado = false;
    const tick = async (): Promise<void> => {
      if (!vivo || ocupado || video.readyState < 2) return;
      ocupado = true;
      try {
        const lecturas = await detector.detect(video);
        if (vivo && lecturas.length > 0) alDetectar(lecturas[0]!.rawValue);
      } catch {
        // Frame ilegible (autofocus, blur): el siguiente tick lo reintenta.
      }
      ocupado = false;
    };
    const intervalo = setInterval(() => void tick(), 300);

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
