/**
 * Límite de intentos de autenticación (revisión 2026-10-20, P1).
 *
 * Tres fallos seguidos para un mismo usuario lo bloquean 15 minutos, tanto en el login como en
 * la autorización de Supervisor del POS (comparten clave: un usuario bloqueado no puede hacer
 * ninguna de las dos cosas). El estado vive en memoria del proceso main: se reinicia al cerrar
 * la app, algo aceptable para un equipo local (quien puede reiniciarla ya tiene acceso al equipo
 * y a la base). Persistirlo requeriría una migración.
 */

export const MAX_FALLOS = 3;
export const BLOQUEO_MS = 15 * 60 * 1000;

export interface LimiteIntentosOpts {
  maxFallos?: number;
  bloqueoMs?: number;
  /** Reloj inyectable (por defecto `Date.now`), para probar sin esperar. */
  ahora?: () => number;
}

export interface LimiteIntentos {
  /** Lanza `Error('CUENTA_BLOQUEADA:<segundos restantes>')` si la clave está bloqueada. */
  verificar(clave: string): void;
  registrarFallo(clave: string): void;
  registrarExito(clave: string): void;
  reiniciar(): void;
}

type Estado = { fallos: number; bloqueadoHasta: number };

const normalizar = (clave: string): string => String(clave ?? '').trim().toLowerCase();

export function crearLimiteIntentos(opts: LimiteIntentosOpts = {}): LimiteIntentos {
  const maxFallos = opts.maxFallos ?? MAX_FALLOS;
  const bloqueoMs = opts.bloqueoMs ?? BLOQUEO_MS;
  // Referencia tardía: `Date.now` se resuelve en cada llamada (respeta timers falsos en tests).
  const ahora = opts.ahora ?? (() => Date.now());
  const estados = new Map<string, Estado>();

  return {
    verificar(clave) {
      const k = normalizar(clave);
      const e = estados.get(k);
      if (!e || e.bloqueadoHasta === 0) return;
      const restanteMs = e.bloqueadoHasta - ahora();
      if (restanteMs > 0) throw new Error(`CUENTA_BLOQUEADA:${Math.ceil(restanteMs / 1000)}`);
      // El bloqueo venció: se vuelve a empezar con el contador en cero.
      estados.delete(k);
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
    },

    registrarExito(clave) {
      estados.delete(normalizar(clave));
    },

    reiniciar() {
      estados.clear();
    },
  };
}

/** Instancia compartida por login, verificación de contraseña y autorización de Supervisor. */
export const limiteIntentos: LimiteIntentos = crearLimiteIntentos();
