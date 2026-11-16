import { POLITICAS_CANALES_CORE, type PoliticasCanales } from '@core/main';

// ADR-145 — Qué exige cada canal IPC de Elaborados (ver el mismo archivo en Retail). Un canal que
// no figure acá no arranca. Las lecturas que usa el POS piden sesión; cada escritura, su permiso.
const S = 'sesion' as const;
const P = <C extends string>(codigo: C) => `permiso:${codigo}` as const;

export const POLITICAS_CANALES_ELABORADOS: PoliticasCanales = {
  ...POLITICAS_CANALES_CORE,

  // Inventario elaborado (ADR-093).
  'articulo:list': S, 'articulo:get': S,
  'articulo:create': P('articulo.gestionar'), 'articulo:update': P('articulo.gestionar'),
  'movimiento-articulo:list': S,
  'movimiento-articulo:create': P('stock.ajustar'),
  'receta-produccion:get': S,
  'receta-produccion:set': P('receta.gestionar'),
  'produccion:list': S,
  'produccion:crear': P('produccion.registrar'), 'produccion:anular': P('produccion.registrar'),

  // Carta (catálogo de venta).
  'categoria-venta:list': S,
  'categoria-venta:create': P('producto_venta.gestionar'),
  'grupo-modificador:list': S, 'grupo-modificador:get': S,
  'grupo-modificador:create': P('producto_venta.gestionar'),
  'grupo-modificador:opcion-set': P('producto_venta.gestionar'),
  'producto-venta:list': S, 'producto-venta:get': S,
  'producto-venta:create': P('producto_venta.gestionar'),
  'lista-precio:list': S, 'lista-precio:precios': S,
  'lista-precio:create': P('lista_precio.gestionar'), 'lista-precio:update': P('lista_precio.gestionar'),
  'lista-precio:precio-set': P('lista_precio.gestionar'),
  'demo-catalog:estado': P('usuario.administrar'), 'demo-catalog:seed-heladeria': P('usuario.administrar'),
  'demo-catalog:vaciar': P('usuario.administrar'),

  // Compras de insumos (ADR-103).
  'compra:list': S, 'compra:get': S,
  'compra:crear': P('compra.registrar'), 'compra:anular': P('compra.registrar'),
  'compra:proveedor-list': S,
  'compra:proveedor-crear-rapido': P('compra.registrar'),

  // Reportes.
  'reporte:ventas-periodo': P('dashboard.ver'), 'reporte:ventas-producto': P('dashboard.ver'),
  'reporte:stock-alertas': P('dashboard.ver'),

  // Ventas.
  'venta:catalogo': S, 'venta:get': S,
  'venta.espera:listar': P('venta.crear'),
  'venta:cotizar': P('venta.crear'), 'venta:confirmar': P('venta.crear'),
  'venta:anular': P('venta.anular'),
  'venta.espera:pausar': P('venta.crear'), 'venta.espera:retomar': P('venta.crear'),
  'venta.espera:descartar': P('venta.crear'),
};
