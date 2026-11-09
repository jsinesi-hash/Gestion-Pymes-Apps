import { POLITICAS_CANALES_CORE, type PoliticasCanales } from '@core/main';

// ADR-145 — Qué exige cada canal IPC de Retail. `registrarHandlersRetail` registra todo a través
// de `ipcConPoliticas`: un canal que no figure acá no arranca. Criterio de la Fase 0: las
// lecturas que usa el mostrador piden sesión; cada escritura, el permiso que ya exigía la UI.
// Varios códigos se usan como "es Supervisor" (`usuario.administrar`, `config.fiscal`); separarlos
// en permisos propios es la Fase 1.
const S = 'sesion' as const;
const P = <C extends string>(codigo: C) => `permiso:${codigo}` as const;

export const POLITICAS_CANALES_RETAIL: PoliticasCanales = {
  ...POLITICAS_CANALES_CORE,

  // Novedades y actualización de la app: cualquier usuario las ve.
  'actualizacion:estado': S,
  'actualizacion:instalarYReiniciar': S,
  'actualizacion:notasPostUpdate': S,
  'actualizacion:marcarVersionVista': S,

  // Agenda (ADR-047): todavía sin permisos propios (decisión abierta, Fase 1).
  'rutina:list': S, 'rutina:crear': S, 'rutina:editar': S, 'rutina:pausar': S,
  'rutina:reanudar': S, 'rutina:eliminar': S,
  'agenda:crearEvento': S, 'agenda:listar': S, 'agenda:completar': S,
  'agenda:posponer': S, 'agenda:descartar': S,
  'aviso:listar': S, 'aviso:reintentar': S, 'aviso:descartar': S, 'aviso:badge': S,

  // Catálogo: las pantallas de Categorías, Marcas y Unidades están detrás de usuario.administrar.
  'categoria:list': S, 'categoria:list-all': S,
  'categoria:create': P('usuario.administrar'), 'categoria:update': P('usuario.administrar'),
  'categoria:desactivar': P('usuario.administrar'), 'categoria:reactivar': P('usuario.administrar'),
  'marca:list': S, 'marca:list-all': S,
  // El alta de producto crea marcas al vuelo (ProductoForm).
  'marca:create': P('producto.crear'),
  'marca:update': P('usuario.administrar'), 'marca:desactivar': P('usuario.administrar'),
  'marca:reactivar': P('usuario.administrar'),
  'unidad:list': S, 'unidad:list-all': S,
  'unidad:create': P('usuario.administrar'), 'unidad:update': P('usuario.administrar'),
  'unidad:desactivar': P('usuario.administrar'), 'unidad:reactivar': P('usuario.administrar'),
  'sinonimo:list': P('usuario.administrar'), 'sinonimo:get': P('usuario.administrar'),
  'sinonimo:create': P('usuario.administrar'), 'sinonimo:update': P('usuario.administrar'),
  'sinonimo:delete': P('usuario.administrar'), 'sinonimo:importarValidar': P('usuario.administrar'),
  'sinonimo:importar': P('usuario.administrar'),
  'ubicacion:list': S, 'ubicacion:list-all': S, 'ubicacion:get': S,
  'ubicacion:create': P('producto.editar'), 'ubicacion:update': P('producto.editar'),
  'ubicacion:delete': P('producto.editar'),
  'ubicacion:dedup:preview': P('usuario.administrar'), 'ubicacion:dedup:aplicar': P('usuario.administrar'),
  'demoCatalog:estado': P('usuario.administrar'), 'demoCatalog:cargar': P('usuario.administrar'),
  'demoCatalog:vaciar': P('usuario.administrar'),

  // Productos y presentaciones.
  'producto:list': S, 'producto:buscarSimilares': S, 'producto:stockCounts': S, 'producto:get': S,
  'producto:create': P('producto.crear'), 'producto:quickCreate': P('producto.crear'),
  'producto:update': P('producto.editar'), 'producto:deactivate': P('producto.editar'),
  'producto:setDiscontinuado': P('producto.editar'),
  'presentacion:listByProducto': S, 'presentacion:buscarPorGtin': S,
  'presentacion:create': P('producto.editar'), 'presentacion:update': P('producto.editar'),
  'presentacion:setDefault': P('producto.editar'), 'presentacion:desactivar': P('producto.editar'),
  'presentacion:eliminar': P('producto.editar'), 'presentacion:reactivar': P('producto.editar'),
  'equivalencia:list': S,
  'equivalencia:add': P('producto.editar'), 'equivalencia:remove': P('producto.editar'),
  'etiquetas:listar-productos': P('producto.consultar'), 'etiquetas:listar-perfiles': P('producto.consultar'),
  'etiquetas:guardar-perfil': P('producto.consultar'), 'etiquetas:generar-pdf': P('producto.consultar'),
  'etiquetas:vista-previa': P('producto.consultar'), 'etiquetas:imprimir': P('producto.consultar'),
  'etiquetas:exportar-pdf': P('producto.consultar'),
  'print:product-label': P('producto.consultar'), 'print:location-label': P('producto.consultar'),

  // Stock.
  'existencias:get': S, 'movimiento-stock:list': S,
  'existencias:set-minimos': P('stock.ajustar'),
  'stock:entrada': P('stock.entrada'),
  'stock:ajuste': P('stock.ajustar'), 'stock:merma': P('stock.ajustar'),

  // Precios: el POS lee precios; escribir es config.fiscal y publicar lotes, precio.aprobar.
  'listaPrecio:list': S, 'listaPrecio:get': S,
  'listaPrecio:create': P('config.fiscal'), 'listaPrecio:update': P('config.fiscal'),
  'listaPrecio:deactivate': P('config.fiscal'),
  'listaPrecioValor:getPrecioEnLista': S, 'listaPrecioValor:listarVigentesParaProducto': S,
  'listaPrecioValor:listarVigentesPorLista': S,
  'listaPrecioValor:contarAfectados': P('config.fiscal'),
  'listaPrecioValor:setManual': P('config.fiscal'), 'listaPrecioValor:recalcularMasivo': P('config.fiscal'),
  'reglaPrecio:listByLista': S,
  'reglaPrecio:upsert': P('config.fiscal'), 'reglaPrecio:remove': P('config.fiscal'),
  'cambioProgramado:listar': S,
  'cambioProgramado:crear': P('config.fiscal'), 'cambioProgramado:cancelar': P('config.fiscal'),
  'priceBatch:crear': P('config.fiscal'), 'priceBatch:obtener': P('config.fiscal'),
  'priceBatch:listar': P('config.fiscal'), 'priceBatch:excluirFila': P('config.fiscal'),
  'priceBatch:excluirErrores': P('config.fiscal'), 'priceBatch:revalidar': P('config.fiscal'),
  'priceBatch:aprobar': P('precio.aprobar'), 'priceBatch:publicar': P('precio.aprobar'),
  'priceBatch:revertir': P('precio.aprobar'),

  // Importaciones.
  'dialog:seleccionarArchivoImportCosto': P('import.masiva'),
  'importar:validarFila': P('import.masiva'), 'importar:plantilla': P('import.masiva'),
  'importar:productos:validar': P('import.masiva'), 'importar:productos:confirmar': P('import.masiva'),
  'importar:clientes:validar': P('import.masiva'), 'importar:clientes:confirmar': P('import.masiva'),
  'importar:proveedores:validar': P('import.masiva'), 'importar:proveedores:confirmar': P('import.masiva'),
  'importar:ubicaciones:validar': P('import.masiva'), 'importar:ubicaciones:confirmar': P('import.masiva'),
  'importar:stock-inicial:validar': P('import.masiva'), 'importar:stock-inicial:confirmar': P('import.masiva'),
  'importacionCatalogo:parseArchivo': P('import.masiva'), 'importacionCatalogo:revalidarFila': P('import.masiva'),
  'importacionCatalogo:confirmar': P('import.masiva'), 'importacionCatalogo:getHistorial': P('import.masiva'),
  'importacionCatalogo:getHistorialDetalle': P('import.masiva'),
  'importacionCatalogo:buscarProductos': P('import.masiva'),
  'importacionCosto:parseArchivo': P('import.masiva'), 'importacionCosto:revalidarFila': P('import.masiva'),
  'importacionCosto:buscarProductos': P('import.masiva'), 'importacionCosto:confirmar': P('import.masiva'),
  'importacionCosto:getColaRevision': P('import.masiva'), 'importacionCosto:resolverFila': P('import.masiva'),
  'importacionCosto:descartarFila': P('import.masiva'), 'importacionCosto:actualizarFila': P('import.masiva'),
  'importacionCosto:cancelar': P('import.masiva'), 'importacionCosto:eliminar': P('import.masiva'),
  'importacionCosto:getHistorial': P('import.masiva'),
  'importacionCosto:getHistorialDetalle': P('import.masiva'),

  // Compras.
  'compras.oc:list': P('proveedor.gestionar'), 'compras.oc:get': P('proveedor.gestionar'),
  'compras.oc:crear': P('proveedor.gestionar'), 'compras.oc:agregarItem': P('proveedor.gestionar'),
  'compras.oc:actualizarItem': P('proveedor.gestionar'), 'compras.oc:eliminarItem': P('proveedor.gestionar'),
  'compras.oc:emitir': P('proveedor.gestionar'), 'compras.oc:anular': P('proveedor.gestionar'),
  'compras.oc:sugerir': P('compra.recibir'),
  'compras.recepcion:listByOC': P('compra.recibir'), 'compras.recepcion:get': P('compra.recibir'),
  'compras.recepcion:crear': P('compra.recibir'),
  'compras.pp:listByProducto': P('proveedor.gestionar'), 'compras.pp:upsert': P('proveedor.gestionar'),
  'compras.pp:setPreferido': P('proveedor.gestionar'), 'compras.pp:remove': P('proveedor.gestionar'),
  'compras.pp:setOverrides': P('proveedor.gestionar'), 'compras.pp:listByProveedor': P('proveedor.gestionar'),
  'compras.pp:asociar': P('proveedor.gestionar'), 'compras.pp:asociarLote': P('proveedor.gestionar'),
  'compras.pp:desasociar': P('proveedor.gestionar'), 'compras.pp:actualizar': P('proveedor.gestionar'),

  // Ventas.
  'venta:get': S, 'venta.espera:listar': S,
  'venta:confirmar': P('venta.crear'), 'venta:anular': P('venta.anular'),
  'venta.espera:pausar': P('venta.crear'), 'venta.espera:retomar': P('venta.crear'),
  'venta.espera:descartar': P('venta.crear'),

  // Remitos y transportistas (ADR-045).
  'remito:listar': S, 'remito:obtener': S, 'remito:pendiente': S, 'remito:imprimir': S,
  'remito:crear': P('remito.crear'), 'remito:editar': P('remito.crear'),
  'remito:conformar': P('remito.conformar'), 'remito:anular': P('remito.anular'),
  'transportista:list': S, 'transportista:get': S,
  'transportista:upsert': P('transportista.gestionar'), 'transportista:deactivate': P('transportista.gestionar'),

  // Presupuestos (ADR-046). Convertir es vender.
  'presupuesto:listar': S, 'presupuesto:obtener': S, 'presupuesto:config': S, 'presupuesto:imprimir': S,
  'presupuesto:crear': P('presupuesto.crear'), 'presupuesto:editar': P('presupuesto.crear'),
  'presupuesto:vencerLote': P('presupuesto.crear'),
  'presupuesto:emitir': P('presupuesto.emitir'), 'presupuesto:anular': P('presupuesto.anular'),
  'presupuesto:prepararConversion': P('venta.crear'),

  // Dashboard y reportes.
  'dashboard:ventas': P('dashboard.ver'), 'dashboard:stock': P('dashboard.ver'), 'dashboard:caja': P('dashboard.ver'),
  'dashboard:caja-rango': P('dashboard.ver'),
  'dashboard:clientes-rango': P('dashboard.ver'), 'dashboard:clientes-estado': P('dashboard.ver'),
  'dashboard:proveedores-rango': P('dashboard.ver'), 'dashboard:proveedores-estado': P('dashboard.ver'),
  'dashboard:ventas-kpis-rango': P('dashboard.ver'), 'dashboard:ventas-evolucion': P('dashboard.ver'),
  'dashboard:ventas-heatmap': P('dashboard.ver'), 'dashboard:ventas-dia-mes': P('dashboard.ver'),
  'dashboard:ventas-vendedor': P('dashboard.ver'), 'dashboard:productos-abc': P('dashboard.ver'),
  'dashboard:productos-margen-categoria': P('dashboard.ver'),
  'reportes:detalleVentas': P('dashboard.ver'),
};
