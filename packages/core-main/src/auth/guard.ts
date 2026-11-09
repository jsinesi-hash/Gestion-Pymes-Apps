import { getSession } from './session';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler = (event: unknown, ...args: any[]) => Promise<unknown>;

/**
 * Devuelve la sesión activa o lanza `UNAUTHENTICATED`. Es la única definición: antes cada archivo
 * de handlers tenía su propia copia (23 en total; revisión 2026-10-20, P2).
 */
export function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

/**
 * Devuelve la sesión si tiene el permiso; si no, lanza `FORBIDDEN:<codigo>` (ADR-145). Siempre
 * lanza `Error`: un objeto plano cruza el IPC de Electron como "[object Object]" y el renderer
 * no puede traducirlo.
 */
export function requirePermiso(codigo: string) {
  const session = requireSession();
  if (!session.permisos.has(codigo)) throw new Error(`FORBIDDEN:${codigo}`);
  return session;
}

/** Envuelve un handler IPC para que exija `codigo` antes de ejecutarse. */
export function requirePermission(codigo: string) {
  return (handler: IpcHandler): IpcHandler =>
    async (event, ...args) => {
      requirePermiso(codigo);
      return handler(event, ...args);
    };
}
