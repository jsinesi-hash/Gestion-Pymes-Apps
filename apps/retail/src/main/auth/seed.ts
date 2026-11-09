import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { runSeed as runSeedCore, type PermisoDef } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

export const PERMISOS: readonly PermisoDef[] = [
  { codigo: 'venta.crear',         modulo: 'ventas' },
  { codigo: 'venta.anular',        modulo: 'ventas' },
  { codigo: 'caja.operar',         modulo: 'caja' },
  { codigo: 'stock.entrada',       modulo: 'stock' },
  { codigo: 'stock.ajustar',       modulo: 'stock' },
  { codigo: 'producto.crear',      modulo: 'catalogo' },
  { codigo: 'producto.editar',     modulo: 'catalogo' },
  { codigo: 'producto.consultar',  modulo: 'catalogo' },
  { codigo: 'compra.recibir',      modulo: 'compras' },
  { codigo: 'ctacte.cobrar',       modulo: 'cuentas' },
  { codigo: 'proveedor.pagar',     modulo: 'compras' },
  { codigo: 'precio.override',     modulo: 'ventas' },
  { codigo: 'import.masiva',       modulo: 'admin' },
  { codigo: 'dashboard.ver',       modulo: 'reportes' },
  { codigo: 'usuario.administrar', modulo: 'admin' },
  { codigo: 'config.fiscal',       modulo: 'admin' },
  { codigo: 'export.basico',       modulo: 'export' },
  { codigo: 'export.supervisor',   modulo: 'export' },
  { codigo: 'proveedor.gestionar', modulo: 'compras' },
  { codigo: 'backup.crear',        modulo: 'admin' },
  { codigo: 'backup.restaurar',    modulo: 'admin' },
  // ADR-045: los tres se otorgan a ambos roles (decision de producto 2026-07-19).
  // Existen como permisos-dato para poder restringir la anulacion mas adelante sin refactor.
  { codigo: 'remito.crear',        modulo: 'remitos' },
  { codigo: 'remito.conformar',    modulo: 'remitos' },
  { codigo: 'remito.anular',       modulo: 'remitos' },
  // ADR-045 iter. 2: mismo criterio que remito.* — ambos roles (decision 2026-07-20).
  { codigo: 'transportista.gestionar', modulo: 'remitos' },
  // ADR-046: Presupuestos (cotizacion). Ambos roles: cotizar es operacion de mostrador.
  // Granular para poder restringir emision/anulacion mas adelante sin refactor. La
  // conversion a venta la gatea venta.crear (es una venta normal).
  { codigo: 'presupuesto.crear',   modulo: 'presupuestos' },
  { codigo: 'presupuesto.emitir',  modulo: 'presupuestos' },
  { codigo: 'presupuesto.anular',  modulo: 'presupuestos' },
  // ADR-049: aprobar/publicar/revertir lotes de precios. Solo Supervisor (no va a OPERADOR_PERMISOS).
  { codigo: 'precio.aprobar',      modulo: 'precios' },
  // ADR-146: permisos con significado propio (antes se usaban config.fiscal y usuario.administrar
  // como "es Supervisor"). precio.gestionar y catalogo.gestionar solo Supervisor; agenda.gestionar
  // a ambos roles (la Agenda no tenía permiso y el Operador ya la usaba).
  { codigo: 'precio.gestionar',    modulo: 'precios' },
  { codigo: 'catalogo.gestionar',  modulo: 'catalogo' },
  { codigo: 'agenda.gestionar',    modulo: 'agenda' },
  // Universales del núcleo (PERMISOS_CORE), listados acá para que esta tabla sea el catálogo completo.
  { codigo: 'cliente.baja',              modulo: 'cuentas' },
  { codigo: 'caja.autorizar_diferencia', modulo: 'caja' },
  { codigo: 'ctacte.autorizar_exceso',   modulo: 'cuentas' },
] as const;

export const OPERADOR_PERMISOS: Set<string> = new Set([
  'venta.crear', 'caja.operar', 'stock.entrada', 'stock.ajustar',
  'producto.crear', 'producto.editar', 'producto.consultar',
  'compra.recibir', 'ctacte.cobrar', 'export.basico',
  'remito.crear', 'remito.conformar', 'remito.anular',
  'transportista.gestionar',
  'presupuesto.crear', 'presupuesto.emitir', 'presupuesto.anular',
  'agenda.gestionar',
]);

export function runSeed(db: Db): void {
  runSeedCore(db, { permisos: PERMISOS, operador: [...OPERADOR_PERMISOS] });
}
