import type { ExportRequest } from '@ferreteria/shared';
export type Invoke = (canal: string, ...args: unknown[]) => Promise<any>;

/**
 * Tipo del catálogo universal que expone `createBridge` (lo que ve el renderer en `bridge()`).
 * Se DERIVA de `coreCanales`: no hay una segunda definición que mantener. Revisión 2026-10-20 (P1).
 */
export type CoreBridgeApi = ReturnType<typeof coreCanales>;

/** Estado de Configuración → Sincronización (F2 PR4). */
export interface EstadoSyncTerminal {
  modo: 'standalone' | 'distribuido';
  origin_id: string;
  hub: { url: string; huella: string; nombre: string; emparejado_en: number } | null;
  sync: {
    enLinea: boolean | null; ultimoError: string | null; ultimoPushMs: number | null; ultimoPullMs: number | null;
    pendientes: number; cursor: number; desfasajeMs: number | null; relojDesfasado: boolean;
    versionesHub: { protocolo: number; esquema: number } | null;
    /** F3 PR1: cambios bajados del hub que esperan (chocan con una fila local o les falta una referencia). */
    recibidosEnEspera: number;
  } | null;
  /** F2 PR5 (ADR-152 §2): ¿corre las tareas coordinadas? */
  coordinadora: boolean;
  /** F2 PR5 (ADR-154 §2): números disponibles por serie (null = sin tope, standalone). */
  series: { serie: string; disponibles: number | null }[];
}

/** F3 PR1 (ADR-159): un conflicto del hub, con las dos versiones de la fila. */
export interface ConflictoSync {
  id: number;
  tipo: 'lww' | 'unicidad' | 'integridad';
  tabla: string;
  fila_id: string;
  /** Caja del cambio que entró. */
  origin_id: string;
  fila_entrante: Record<string, unknown>;
  fila_actual: Record<string, unknown> | null;
  detalle: string | null;
  fecha: number;
  resuelto: number;
  resolucion: 'revisado' | 'recuperado' | 'corregido' | null;
  resuelto_por: string | null;
  resuelto_en: number | null;
  perdida: 'entrante' | 'actual' | null;
  recuperable: boolean;
  /** Columnas del índice único con el que chocó una alta repetida (vacío si no se pudieron leer). */
  columnasUnicas: string[];
}

/** F3 PR1: una caja emparejada con el hub. */
export interface CajaDelHub {
  origin_id: string;
  nombre: string;
  emparejada_en: number;
  revocada_en: number | null;
  ultimo_contacto: number | null;
  version_protocolo: number | null;
  version_esquema: number | null;
}

/** «Usar esta PC como servidor» (F2 PR6): el hub de la app instalado como servicio en esta PC. */
export interface EstadoHubLocal {
  plataforma: 'win32' | 'linux' | 'darwin';
  carpeta: string;
  puerto: number;
  instalado: boolean;
  enMarcha: boolean;
  huella: string | null;
  direcciones: string[];
}

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
    // F2 PR4: modo distribuido (Configuración → Sincronización). El estado lo ve cualquier sesión; el
    // resto pide administración de usuarios. La credencial y el certificado nunca vuelven al renderer.
    sync: {
      estado: (): Promise<EstadoSyncTerminal> => invoke('sync:estado'),
      sondear: (p: { url: string }): Promise<{ url: string; huella: string }> => invoke('sync:sondear', p),
      emparejar: (p: { url: string; codigo: string; huella: string; nombre?: string }): Promise<{ origin_id: string; arranque: 'semilla' | 'snapshot'; filas: number }> =>
        invoke('sync:emparejar', p),
      sincronizar: (): Promise<EstadoSyncTerminal> => invoke('sync:sincronizar'),
      desemparejar: (p?: { forzar?: boolean }): Promise<void> => invoke('sync:desemparejar', p),
      rebajarSnapshot: (p?: { forzar?: boolean }): Promise<{ filas: number }> => invoke('sync:rebajarSnapshot', p),
      // F3 PR1 (ADR-159): conflictos (permiso `sync.conflictos`) y cajas emparejadas.
      conflictos: (p?: { pendientes?: boolean; tipo?: ConflictoSync['tipo']; antesDeId?: number; limite?: number }):
        Promise<{ conflictos: ConflictoSync[]; hayMas: boolean; enEspera: number }> => invoke('sync:conflictos', p),
      resolverConflicto: (p: { id: number; resolucion: 'revisado' | 'recuperado' }): Promise<ConflictoSync> =>
        invoke('sync:resolverConflicto', p),
      // F3 PR2: descartar en esta caja una alta repetida (baja lógica y libera su valor único).
      descartarAlta: (p: { id: number }): Promise<void> => invoke('sync:descartarAlta', p),
      terminales: (): Promise<CajaDelHub[]> => invoke('sync:terminales'),
      // F3 PR4 (ADR-155 §1): modo de caja del negocio (`disponible` = la caja está emparejada).
      cajaModo: (): Promise<{ modo: 'por_terminal' | 'compartida'; disponible: boolean }> => invoke('sync:cajaModo'),
      setCajaModo: (p: { modo: 'por_terminal' | 'compartida' }): Promise<{ modo: 'por_terminal' | 'compartida'; disponible: boolean }> =>
        invoke('sync:setCajaModo', p),
    },
    // «Usar esta PC como servidor» (F2 PR6).
    hubLocal: {
      estado: (): Promise<EstadoHubLocal> => invoke('hubLocal:estado'),
      instalar: (): Promise<EstadoHubLocal> => invoke('hubLocal:instalar'),
      desinstalar: (): Promise<EstadoHubLocal> => invoke('hubLocal:desinstalar'),
      codigo: (): Promise<{ codigo: string; vence_en: number }> => invoke('hubLocal:codigo'),
    },
    print: { html: (h: string) => invoke('print:html', h) },
    exportar: { ejecutar: (req: ExportRequest): Promise<void> => invoke('exportar:ejecutar', req) },
  };
}
