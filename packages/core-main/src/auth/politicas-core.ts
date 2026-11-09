import type { PoliticasCanales } from './politicas-canales';

/**
 * Política de cada canal universal que registra `registerCoreHandlers` (ADR-145). Cada app la
 * combina con la suya y la aplica con `ipcConPoliticas`. Los handlers conservan sus chequeos
 * internos (p. ej. `usuario:update` deja editar al propio usuario o a quien administra usuarios).
 */
export const POLITICAS_CANALES_CORE: PoliticasCanales = {
  // Antes de abrir sesión: login, contraseña vencida, mail obligatorio y recuperación.
  'auth:login': 'publico',
  'auth:cambiarPasswordVencida': 'publico',
  'auth:completarEmail': 'publico',
  'auth:recuperacionDisponible': 'publico',
  'auth:recuperarSolicitar': 'publico',
  'auth:recuperarConfirmar': 'publico',
  'auth:logout': 'publico',
  'auth:whoami': 'publico',
  // Pantalla de bloqueo por inactividad: verifica la clave del usuario de la sesión.
  'auth:verifyPassword': 'publico',
  // El renderer lo llama también al cerrar sesión (menú sin permisos).
  'menu:rebuild': 'publico',

  // Datos del propio usuario y lecturas de uso general. `usuario:update`/`changePassword` dejan
  // pasar al propio usuario o a quien tiene usuario.administrar (lo decide el handler).
  'usuario:update': 'sesion',
  'usuario:changePassword': 'sesion',
  'preferencias:get': 'sesion',
  'preferencias:save': 'sesion',
  'rol:list': 'sesion',
  'parametros:get': 'sesion',
  'geo:provincias': 'sesion',
  'geo:localidades': 'sesion',
  'impuesto:list': 'sesion',
  'caja:getActiva': 'sesion',
  'caja:listMovimientos': 'sesion',
  'venta:listByCaja': 'sesion',
  'print:html': 'sesion',
  'dialog:seleccionarCarpeta': 'sesion',
  'dialog:seleccionarArchivo': 'sesion',
  'dialog:getDefaultBackupPath': 'sesion',

  'usuario:list': 'permiso:usuario.administrar',
  'usuario:create': 'permiso:usuario.administrar',
  'usuario:desactivar': 'permiso:usuario.administrar',
  'usuario:reactivar': 'permiso:usuario.administrar',
  'permiso:matriz': 'permiso:usuario.administrar',

  'parametros:set': 'permiso:config.fiscal',
  'parametros:listFlags': 'permiso:config.fiscal',
  'smtp:getConfig': 'permiso:config.fiscal',
  'smtp:setConfig': 'permiso:config.fiscal',
  'smtp:setPassword': 'permiso:config.fiscal',
  'smtp:probar': 'permiso:config.fiscal',

  'caja:abrir': 'permiso:caja.operar',
  'caja:addMovimiento': 'permiso:caja.operar',
  'caja:calcularCierre': 'permiso:caja.operar',
  'caja:cerrar': 'permiso:caja.operar',

  // Clientes: el POS los busca y los da de alta (mismo permiso que ya exigía el handler).
  'cliente:list': 'permiso:ctacte.cobrar',
  'cliente:get': 'permiso:ctacte.cobrar',
  'cliente:upsert': 'permiso:ctacte.cobrar',
  // Baja y reactivación de clientes: permiso propio (ADR-146).
  'cliente:desactivar': 'permiso:cliente.baja',
  'cliente:reactivar': 'permiso:cliente.baja',
  'ctacte:list': 'permiso:ctacte.cobrar',
  'ctacte:getByCliente': 'permiso:ctacte.cobrar',
  'ctacte:setLimite': 'permiso:ctacte.cobrar',
  'ctacte:registrarSaldoInicial': 'permiso:ctacte.cobrar',
  'ctacte:registrarCobro': 'permiso:ctacte.cobrar',

  'proveedor:list': 'permiso:proveedor.gestionar',
  'proveedor:get': 'permiso:proveedor.gestionar',
  'proveedor:upsert': 'permiso:proveedor.gestionar',
  'proveedor:deactivate': 'permiso:proveedor.gestionar',

  'backup:ejecutar': 'permiso:backup.crear',
  'backup:listar': 'permiso:backup.crear',
  'backup:eliminar': 'permiso:backup.crear',
  'backup:evaluarDepuracion': 'permiso:backup.crear',
  'backup:depurar': 'permiso:backup.crear',
  'sistema:erroresListar': 'permiso:backup.crear',
  'sistema:erroresLimpiar': 'permiso:backup.crear',
  'restore:validar': 'permiso:backup.restaurar',
  'restore:ejecutar': 'permiso:backup.restaurar',

  // El permiso fino (básico o supervisor) lo decide el handler según la entidad y el perfil.
  'exportar:ejecutar': 'permiso:export.basico',
};
