import type { ExportRequest } from '@ferreteria/shared';
export type Invoke = (canal: string, ...args: unknown[]) => Promise<any>;

/**
 * Tipo del catálogo universal que expone `createBridge` (lo que ve el renderer en `bridge()`).
 * Se DERIVA de `coreCanales`: no hay una segunda definición que mantener. Revisión 2026-10-20 (P1).
 */
export type CoreBridgeApi = ReturnType<typeof coreCanales>;

export function coreCanales(invoke: Invoke) {
  return {
    getVersion: () => invoke('app:version'),
    // Revisión 2026-10-20 (P2): el catálogo de impuestos es universal (tabla en @core/db).
    impuesto: {
      list: () => invoke('impuesto:list'),
    },
    auth: {
      login:  (creds: unknown) => invoke('auth:login', creds),
      // ADR-136: pasos previos a la sesión (clave vencida / falta el mail); devuelven la sesión.
      cambiarPasswordVencida: (p: { nombreUsuario: string; passwordActual: string; passwordNueva: string }) =>
        invoke('auth:cambiarPasswordVencida', p),
      completarEmail: (p: { nombreUsuario: string; password: string; email: string }) =>
        invoke('auth:completarEmail', p),
      // ADR-137: recuperación de contraseña por mail (pre-sesión).
      recuperacionDisponible: (): Promise<boolean> => invoke('auth:recuperacionDisponible'),
      recuperarSolicitar: (p: { identificador: string }): Promise<{ ok: true }> => invoke('auth:recuperarSolicitar', p),
      recuperarConfirmar: (p: { identificador: string; codigo: string; passwordNueva: string }): Promise<void> =>
        invoke('auth:recuperarConfirmar', p),
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
    permisos: {
      matriz: () => invoke('permiso:matriz'),
      // ADR-147: guarda el conjunto completo de permisos de un rol.
      actualizarRol: (p: { rolId: string; permisos: string[] }) => invoke('permiso:actualizarRol', p),
    },
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
    proveedor: {
      list: () => invoke('proveedor:list'),
      get: (id: string) => invoke('proveedor:get', id),
      upsert: (p: unknown) => invoke('proveedor:upsert', p),
      deactivate: (id: string) => invoke('proveedor:deactivate', id),
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
    // Revisión 2026-10-20 (P2): `venta.listByCaja` lo usa la vista de caja del core; el resto de
    // `venta` lo aporta cada app (se fusiona por método en createBridge).
    venta: {
      listByCaja: (p: { caja_id: string }): Promise<any[]> => invoke('venta:listByCaja', p),
    },
    menu: { rebuild: (): Promise<void> => invoke('menu:rebuild') },
    // ADR-140: registro de errores del sistema (jobs y errores no capturados), solo Supervisor.
    sistema: {
      erroresListar: (): Promise<Array<{ id: string; fecha: number; origen: string; mensaje: string; detalle: string | null }>> =>
        invoke('sistema:erroresListar'),
      erroresLimpiar: (): Promise<{ ok: true }> => invoke('sistema:erroresLimpiar'),
    },
    // ADR-142: configuración del correo saliente (SMTP), solo Supervisor. La clave nunca vuelve al renderer.
    smtp: {
      getConfig: (): Promise<{ host: string; port: number; secure: boolean; from: string; user: string; tiene_password: boolean }> =>
        invoke('smtp:getConfig'),
      setConfig: (p: { host: string; port: number; secure: boolean; from: string; user: string }): Promise<void> =>
        invoke('smtp:setConfig', p),
      setPassword: (p: { password: string }): Promise<void> => invoke('smtp:setPassword', p),
      probar: (): Promise<{ ok: boolean; error?: string }> => invoke('smtp:probar'),
    },
    print: { html: (h: string) => invoke('print:html', h) },
    exportar: { ejecutar: (req: ExportRequest): Promise<void> => invoke('exportar:ejecutar', req) },
  };
}
