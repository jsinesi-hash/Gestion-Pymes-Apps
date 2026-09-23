import type { ExportRequest } from '@ferreteria/shared';
export type Invoke = (canal: string, ...args: unknown[]) => Promise<any>;

export function coreCanales(invoke: Invoke) {
  return {
    getVersion: () => invoke('app:version'),
    auth: {
      login:  (creds: unknown) => invoke('auth:login', creds),
      logout: () => invoke('auth:logout'),
      whoami: () => invoke('auth:whoami'),
      verifyPassword: (p: unknown) => invoke('auth:verifyPassword', p),
    },
    usuario: {
      list: () => invoke('usuario:list'),
      create: (p: unknown) => invoke('usuario:create', p),
      update: (p: unknown) => invoke('usuario:update', p),
      changePassword: (p: unknown) => invoke('usuario:changePassword', p),
      desactivar: (p: unknown) => invoke('usuario:desactivar', p),
      reactivar: (p: unknown) => invoke('usuario:reactivar', p),
    },
    rol: { list: () => invoke('rol:list') },
    permisos: { matriz: () => invoke('permiso:matriz') },
    preferencias: {
      get: (p: unknown) => invoke('preferencias:get', p),
      save: (p: unknown) => invoke('preferencias:save', p),
    },
    parametros: {
      get: (p: unknown) => invoke('parametros:get', p),
      set: (p: unknown) => invoke('parametros:set', p),
      listFlags: () => invoke('parametros:listFlags'),
    },
    geo: {
      provincias: () => invoke('geo:provincias'),
      localidades: (provinciaId: string, q = '') => invoke('geo:localidades', provinciaId, q),
    },
    cliente: {
      list: (p?: unknown) => invoke('cliente:list', p),
      get: (id: string) => invoke('cliente:get', id),
      upsert: (p: unknown) => invoke('cliente:upsert', p),
      desactivar: (p: unknown) => invoke('cliente:desactivar', p),
      reactivar: (p: unknown) => invoke('cliente:reactivar', p),
    },
    ctacte: {
      list: () => invoke('ctacte:list'),
      getByCliente: (id: string) => invoke('ctacte:getByCliente', id),
      setLimite: (p: unknown) => invoke('ctacte:setLimite', p),
      registrarSaldoInicial: (p: unknown) => invoke('ctacte:registrarSaldoInicial', p),
      registrarCobro: (p: unknown) => invoke('ctacte:registrarCobro', p),
    },
    caja: {
      getActiva: () => invoke('caja:getActiva'),
      abrir: (p: unknown) => invoke('caja:abrir', p),
      addMovimiento: (p: unknown) => invoke('caja:addMovimiento', p),
      calcularCierre: (p: unknown) => invoke('caja:calcularCierre', p),
      cerrar: (p: unknown) => invoke('caja:cerrar', p),
      listMovimientos: (p: unknown) => invoke('caja:listMovimientos', p),
    },
    backup: {
      ejecutar: (p: unknown) => invoke('backup:ejecutar', p),
      listar: (p: unknown) => invoke('backup:listar', p),
      eliminar: (p: unknown) => invoke('backup:eliminar', p),
      evaluarDepuracion: () => invoke('backup:evaluarDepuracion'),
      depurar: (p: unknown) => invoke('backup:depurar', p),
    },
    restore: {
      validar: (p: unknown) => invoke('restore:validar', p),
      ejecutar: (p: unknown) => invoke('restore:ejecutar', p),
    },
    dialog: {
      seleccionarCarpeta: (): Promise<string | null> => invoke('dialog:seleccionarCarpeta'),
      seleccionarArchivo: (): Promise<string | null> => invoke('dialog:seleccionarArchivo'),
      getDefaultBackupPath: (): Promise<string> => invoke('dialog:getDefaultBackupPath'),
    },
    exportar: { ejecutar: (req: ExportRequest): Promise<void> => invoke('exportar:ejecutar', req) },
  };
}
