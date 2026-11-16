// Mapa de nombres amigables de permisos (ADR-085). Única fuente de verdad de las
// etiquetas legibles para mostrar los códigos de `permiso.codigo` en UI, compartida por
// todas las apps. No es la fuente de verdad de qué permisos existen —eso es `PERMISOS_CORE`
// (`@core/main`) más la lista de cada app—; cada app tiene un test de cobertura
// (`src/main/auth/__tests__/etiqueta-permiso.test.ts`) que exige etiqueta para todos sus códigos.
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
  // Elaborados (ADR-093/103/104, etiquetas en ADR-145).
  'articulo.gestionar': 'Gestionar artículos e insumos',
  'produccion.registrar': 'Registrar producción',
  'receta.gestionar': 'Gestionar recetas',
  'producto_venta.gestionar': 'Gestionar la carta',
  'compra.registrar': 'Registrar compras de insumos',
  'lista_precio.gestionar': 'Gestionar listas de precio',
  // ADR-146: permisos con significado propio.
  'precio.gestionar': 'Gestionar precios (listas, reglas y lotes)',
  'catalogo.gestionar': 'Gestionar categorías, marcas, unidades y sinónimos',
  'agenda.gestionar': 'Gestionar rutinas de la agenda',
  'cliente.baja': 'Dar de baja clientes',
  'caja.autorizar_diferencia': 'Autorizar cierre de caja con diferencia',
  'ctacte.autorizar_exceso': 'Autorizar ventas sobre el límite de crédito',
  'compra.anular': 'Anular compras',
  'produccion.anular': 'Anular producciones',
};

/** Etiqueta legible de un código de permiso; si no está mapeado, cae al código tal cual. */
export function etiquetaPermiso(codigo: string): string {
  return Object.hasOwn(ETIQUETA_PERMISO, codigo) ? ETIQUETA_PERMISO[codigo] : codigo;
}
