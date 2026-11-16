// apps/elaborados/src/main/auth/seed.ts — E1: solo permisos del core. E2+ agrega los propios.
import type { PermisoDef } from '@core/main';

export const PERMISOS_ELABORADOS: readonly PermisoDef[] = [
  { codigo: 'articulo.gestionar',      modulo: 'stock' },
  { codigo: 'stock.ajustar',           modulo: 'stock' },
  { codigo: 'produccion.registrar',    modulo: 'produccion' },
  { codigo: 'receta.gestionar',        modulo: 'produccion' },
  { codigo: 'producto_venta.gestionar', modulo: 'carta' },
  { codigo: 'compra.registrar',       modulo: 'compras' },
  { codigo: 'lista_precio.gestionar',  modulo: 'carta' },
  // ADR-146: autorizar anulaciones (antes exigía el rol SUPERVISOR). Solo Supervisor.
  { codigo: 'compra.anular',           modulo: 'compras' },
  { codigo: 'produccion.anular',       modulo: 'produccion' },
];

export const OPERADOR_PERMISOS_ELABORADOS: readonly string[] = [
  'articulo.gestionar', 'stock.ajustar', 'produccion.registrar', 'compra.registrar',
];
