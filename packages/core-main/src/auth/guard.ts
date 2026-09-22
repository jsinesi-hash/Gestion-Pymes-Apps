import { getSession } from './session';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler = (event: unknown, ...args: any[]) => Promise<unknown>;

export function requirePermission(codigo: string) {
  return (handler: IpcHandler): IpcHandler =>
    async (event, ...args) => {
      const session = getSession();
      if (!session) throw { code: 'UNAUTHENTICATED' };
      if (!session.permisos.has(codigo)) throw { code: 'FORBIDDEN', permiso: codigo };
      return handler(event, ...args);
    };
}
