// Mapa de nombres amigables de permisos (ADR-085). Única fuente de verdad de las
// etiquetas legibles para mostrar los códigos de `permiso.codigo` en UI. No es la
// fuente de verdad de qué permisos existen —eso es `PERMISOS` en
// `packages/client/src/main/auth/seed.ts`—; un test de cobertura en el cliente
// (`src/main/auth/__tests__/etiqueta-permiso.test.ts`) verifica que ambas listas
// coincidan exactamente.
export const ETIQUETA_PERMISO: Record<string, string> = {
  'venta.crear': 'Vender (POS)',
  'venta.anular': 'Anular ventas',
  'precio.override': 'Modificar precio en la venta',
  'caja.operar': 'Abrir/cerrar caja y movimientos',
  'stock.entrada': 'Registrar entradas de stock',
  'stock.ajustar': 'Ajustar stock (conteo/merma)',
  'producto.crear': 'Crear productos',
  'producto.editar': 'Editar productos',
  'producto.consultar': 'Consultar el catálogo',
  'compra.recibir': 'Recibir compras',
  'proveedor.pagar': 'Pagar a proveedores',
  'proveedor.gestionar': 'Gestionar proveedores y órdenes de compra',
  'ctacte.cobrar': 'Cobrar cuenta corriente',
  'precio.aprobar': 'Aprobar lotes de precios',
  'remito.crear': 'Emitir remitos',
  'remito.conformar': 'Conformar remitos',
  'remito.anular': 'Anular remitos',
  'transportista.gestionar': 'Gestionar transportistas',
  'presupuesto.crear': 'Crear presupuestos',
  'presupuesto.emitir': 'Emitir presupuestos',
  'presupuesto.anular': 'Anular presupuestos',
  'export.basico': 'Exportar datos (básico)',
  'export.supervisor': 'Exportar datos (completo)',
  'dashboard.ver': 'Ver dashboard y reportes',
  'import.masiva': 'Importación masiva',
  'usuario.administrar': 'Administrar usuarios',
  'config.fiscal': 'Configuración fiscal y parámetros',
  'backup.crear': 'Crear backups',
  'backup.restaurar': 'Restaurar backups',
};

/** Etiqueta legible de un código de permiso; si no está mapeado, cae al código tal cual. */
export function etiquetaPermiso(codigo: string): string {
  return Object.hasOwn(ETIQUETA_PERMISO, codigo) ? ETIQUETA_PERMISO[codigo] : codigo;
}
