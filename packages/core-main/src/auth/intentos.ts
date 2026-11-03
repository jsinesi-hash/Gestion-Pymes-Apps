/**
 * Límite de intentos de autenticación (revisión 2026-10-20, P1).
 *
 * Tres fallos seguidos para un mismo usuario lo bloquean 15 minutos, tanto en el login como en
 * la autorización de Supervisor del POS (comparten clave: un usuario bloqueado no puede hacer
 * ninguna de las dos cosas). El estado vive en memoria del proceso main y, desde el ADR-138, se
 * puede persistir con `persistirEn(almacen)` (un archivo de userData, ver `intentos-persistente.ts`):
 * así cerrar y volver a abrir la app ya no reinicia el contador ni el bloqueo.
 */

export const MAX_FALLOS = 3;
export const BLOQUEO_MS = 15 * 60 * 1000;

export interface LimiteIntentosOpts {
  maxFallos?: number;
  bloqueoMs?: number;
  /** Reloj inyectable (por defecto `Date.now`), para probar sin esperar. */
  ahora?: () => number;
}

export type EstadoIntentos = { fallos: number; bloqueadoHasta: number };

/** Dónde se guarda el estado entre reinicios. Lo implementa `crearAlmacenArchivo`. */
export interface AlmacenIntentos {
  cargar(): Record<string, EstadoIntentos>;
  guardar(estados: Record<string, EstadoIntentos>): void;
}

export interface LimiteIntentos {
  /** Lanza `Error('CUENTA_BLOQUEADA:<segundos restantes>')` si la clave está bloqueada. */
  verificar(clave: string): void;
  registrarFallo(clave: string): void;
  registrarExito(clave: string): void;
  reiniciar(): void;
  /**
   * Conecta (o con `null` desconecta) un almacén: carga lo guardado y desde entonces escribe cada
   * cambio. Un fallo del almacén nunca rompe un login: se registra y se sigue en memoria.
   */
  persistirEn(almacen: AlmacenIntentos | null): void;
}

const normalizar = (clave: string): string => String(clave ?? '').trim().toLowerCase();

function esEstadoValido(e: unknown): e is EstadoIntentos {
  if (typeof e !== 'object' || e === null) return false;
  const { fallos, bloqueadoHasta } = e as Record<string, unknown>;
  return typeof fallos === 'number' && Number.isInteger(fallos) && fallos >= 0
    && typeof bloqueadoHasta === 'number' && Number.isFinite(bloqueadoHasta) && bloqueadoHasta >= 0;
}

export function crearLimiteIntentos(opts: LimiteIntentosOpts = {}): LimiteIntentos {
  const maxFallos = opts.maxFallos ?? MAX_FALLOS;
  const bloqueoMs = opts.bloqueoMs ?? BLOQUEO_MS;
  // Referencia tardía: `Date.now` se resuelve en cada llamada (respeta timers falsos en tests).
  const ahora = opts.ahora ?? (() => Date.now());
  const estados = new Map<string, EstadoIntentos>();
  let almacen: AlmacenIntentos | null = null;

  const guardar = (): void => {
    if (!almacen) return;
    try {
      almacen.guardar(Object.fromEntries(estados));
    } catch (e) {
      console.error('[lockout] no se pudo guardar el límite de intentos:', (e as Error).message);
    }
  };

  return {
    verificar(clave) {
      const k = normalizar(clave);
      const e = estados.get(k);
      if (!e || e.bloqueadoHasta === 0) return;
      const restanteMs = e.bloqueadoHasta - ahora();
      if (restanteMs > 0) throw new Error(`CUENTA_BLOQUEADA:${Math.ceil(restanteMs / 1000)}`);
      // El bloqueo venció: se vuelve a empezar con el contador en cero.
      estados.delete(k);
      guardar();
    },

    registrarFallo(clave) {
      const k = normalizar(clave);
      const e = estados.get(k) ?? { fallos: 0, bloqueadoHasta: 0 };
      // Un fallo durante un bloqueo vigente no lo extiende.
      if (e.bloqueadoHasta > ahora()) return;
      if (e.bloqueadoHasta !== 0) { e.fallos = 0; e.bloqueadoHasta = 0; } // venció: reinicia
      e.fallos += 1;
      if (e.fallos >= maxFallos) e.bloqueadoHasta = ahora() + bloqueoMs;
      estados.set(k, e);
      guardar();
    },

    registrarExito(clave) {
      if (estados.delete(normalizar(clave))) guardar();
    },

    reiniciar() {
      estados.clear();
      guardar();
    },

    persistirEn(nuevo) {
      almacen = nuevo;
      if (!nuevo) return;
      let guardado: Record<string, EstadoIntentos> = {};
      try {
        guardado = nuevo.cargar();
      } catch (e) {
        console.error('[lockout] no se pudo leer el límite de intentos guardado:', (e as Error).message);
      }
      const t = ahora();
      for (const [k, e] of Object.entries(guardado)) {
        if (!esEstadoValido(e) || estados.has(k)) continue;
        // Un bloqueo vencido no se carga; uno que excede la duración (reloj atrasado o archivo
        // tocado) se acota a la duración normal.
        if (e.bloqueadoHasta !== 0 && e.bloqueadoHasta <= t) continue;
        estados.set(k, { fallos: e.fallos, bloqueadoHasta: e.bloqueadoHasta === 0 ? 0 : Math.min(e.bloqueadoHasta, t + bloqueoMs) });
      }
    },
  };
}

/** Instancia compartida por login, verificación de contraseña y autorización de Supervisor. */
export const limiteIntentos: LimiteIntentos = crearLimiteIntentos();
