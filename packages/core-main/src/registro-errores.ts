import crypto from 'node:crypto';

// Registro de los errores del sistema que antes solo iban al log (ADR-140): los de los jobs
// programados (avisos, cambios de precio, vencimiento de presupuestos) y los no capturados del
// proceso main. Un anillo de los últimos 100, persistible con `persistirEn` (un archivo de userData,
// ver `registro-errores-archivo.ts`), para que un Supervisor los vea en Backup y restauración.
// Registrar nunca lanza: un fallo del registro no puede tumbar al job que ya estaba fallando.

export const MAX_ERRORES = 100;
const MAX_MENSAJE = 500;
const MAX_DETALLE = 2000;

export type ErrorRegistrado = {
  id: string;
  /** Milisegundos Unix. */
  fecha: number;
  /** Quién falló, p. ej. `tarea:avisos-reintentos` o `main:uncaughtException`. */
  origen: string;
  mensaje: string;
  /** Stack, si el error era un `Error`. */
  detalle: string | null;
};

/** Dónde se guarda el registro entre reinicios. Lo implementa `crearAlmacenErroresArchivo`. */
export interface AlmacenErrores {
  cargar(): unknown;
  guardar(errores: ErrorRegistrado[]): void;
}

export interface RegistroErrores {
  registrar(origen: string, error: unknown): void;
  /** Del más reciente al más viejo. Devuelve copias. */
  listar(): ErrorRegistrado[];
  limpiar(): void;
  /** Conecta (o con `null` desconecta) un almacén: carga lo guardado y desde entonces escribe cada cambio. */
  persistirEn(almacen: AlmacenErrores | null): void;
}

export interface RegistroErroresOpts {
  maximo?: number;
  /** Reloj inyectable (por defecto `Date.now`). */
  ahora?: () => number;
}

const recortar = (texto: string, max: number): string => (texto.length > max ? `${texto.slice(0, max)}…` : texto);

function mensajeDe(error: unknown): string {
  try {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null) return JSON.stringify(error);
    return String(error);
  } catch {
    return '[no se pudo convertir el error en texto]';
  }
}

function detalleDe(error: unknown): string | null {
  return error instanceof Error && error.stack ? recortar(error.stack, MAX_DETALLE) : null;
}

function esErrorValido(e: unknown): e is ErrorRegistrado {
  if (typeof e !== 'object' || e === null) return false;
  const x = e as Record<string, unknown>;
  return typeof x.id === 'string' && typeof x.origen === 'string' && typeof x.mensaje === 'string'
    && typeof x.fecha === 'number' && Number.isFinite(x.fecha)
    && (x.detalle === null || typeof x.detalle === 'string');
}

export function crearRegistroErrores(opts: RegistroErroresOpts = {}): RegistroErrores {
  const maximo = opts.maximo ?? MAX_ERRORES;
  const ahora = opts.ahora ?? (() => Date.now());
  // Del más viejo al más nuevo (se agrega al final y se recorta por el principio).
  let items: ErrorRegistrado[] = [];
  let almacen: AlmacenErrores | null = null;

  const recortarAlTope = (): void => { if (items.length > maximo) items = items.slice(items.length - maximo); };
  const guardar = (): void => {
    if (!almacen) return;
    try {
      almacen.guardar(items.map((e) => ({ ...e })));
    } catch (e) {
      console.error('[errores] no se pudo guardar el registro de errores:', (e as Error).message);
    }
  };

  return {
    registrar(origen, error) {
      try {
        items.push({
          id: crypto.randomUUID(),
          fecha: ahora(),
          origen,
          mensaje: recortar(mensajeDe(error), MAX_MENSAJE),
          detalle: detalleDe(error),
        });
        recortarAlTope();
        guardar();
      } catch (e) {
        console.error('[errores] no se pudo registrar el error:', (e as Error).message);
      }
    },

    listar() {
      return items.map((e) => ({ ...e })).reverse();
    },

    limpiar() {
      items = [];
      guardar();
    },

    persistirEn(nuevo) {
      almacen = nuevo;
      if (!nuevo) return;
      let crudo: unknown = [];
      try {
        crudo = nuevo.cargar();
      } catch (e) {
        console.error('[errores] no se pudo leer el registro de errores guardado:', (e as Error).message);
      }
      const cargados = (Array.isArray(crudo) ? crudo : []).filter(esErrorValido).map((e) => ({ ...e }));
      const hayPrevios = items.length > 0;
      const idsPrevios = new Set(items.map((e) => e.id));
      // Lo guardado es más viejo que lo que se registró antes de conectar el almacén.
      items = [...cargados.filter((e) => !idsPrevios.has(e.id)), ...items].sort((a, b) => a.fecha - b.fecha);
      recortarAlTope();
      if (hayPrevios) guardar();
    },
  };
}

/** Instancia compartida por los jobs, los errores no capturados y el canal de consulta del Supervisor. */
export const registroErrores: RegistroErrores = crearRegistroErrores();
