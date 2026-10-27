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

export function requirePermission(codigo: string) {
  return (handler: IpcHandler): IpcHandler =>
    async (event, ...args) => {
      const session = getSession();
      if (!session) throw { code: 'UNAUTHENTICATED' };
      if (!session.permisos.has(codigo)) throw { code: 'FORBIDDEN', permiso: codigo };
      return handler(event, ...args);
    };
}
