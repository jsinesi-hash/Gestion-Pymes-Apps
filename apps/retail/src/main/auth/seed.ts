import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';
import { hashPassword } from './hash';

type Db = BetterSQLite3Database<typeof schema>;

export const PERMISOS = [
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
] as const;

export const OPERADOR_PERMISOS = new Set([
  'venta.crear', 'caja.operar', 'stock.entrada', 'stock.ajustar',
  'producto.crear', 'producto.editar', 'producto.consultar',
  'compra.recibir', 'ctacte.cobrar', 'export.basico',
  'remito.crear', 'remito.conformar', 'remito.anular',
  'transportista.gestionar',
  'presupuesto.crear', 'presupuesto.emitir', 'presupuesto.anular',
]);

type SyncMeta = { version: number; origin_id: string; sync_state: 'pending' | 'synced' | 'conflict'; updated_at: Date };

function upsertRolPermiso(
  db: Db,
  rolId: string,
  permisoId: string,
  sync: SyncMeta,
): void {
  const exists = db.select({ id: schema.rol_permiso.id }).from(schema.rol_permiso)
    .where(and(eq(schema.rol_permiso.rol_id, rolId), eq(schema.rol_permiso.permiso_id, permisoId)))
    .get();
  if (!exists) {
    db.insert(schema.rol_permiso).values({ id: randomUUID(), rol_id: rolId, permiso_id: permisoId, ...sync }).run();
  }
}

function upsertRolPermisos(
  db: Db,
  permisoIds: Record<string, string>,
  rolOperadorId: string | undefined,
  rolSupervisorId: string | undefined,
  sync: SyncMeta,
): void {
  for (const p of PERMISOS) {
    const permisoId = permisoIds[p.codigo];
    if (!permisoId) continue;
    if (OPERADOR_PERMISOS.has(p.codigo) && rolOperadorId) {
      upsertRolPermiso(db, rolOperadorId, permisoId, sync);
    }
    if (rolSupervisorId) {
      upsertRolPermiso(db, rolSupervisorId, permisoId, sync);
    }
  }
}

export function runSeed(db: Db): void {
  const now = new Date();
  const sync = { version: 1, origin_id: 'system', sync_state: 'synced' as const, updated_at: now };

  // Ensure roles exist; if not, create them
  let existingRoles = db.select({ id: schema.rol.id, nombre: schema.rol.nombre }).from(schema.rol).all();
  if (existingRoles.length === 0) {
    db.insert(schema.rol).values([
      { id: randomUUID(), nombre: 'OPERADOR',   es_sistema: true, activo: true, ...sync },
      { id: randomUUID(), nombre: 'SUPERVISOR', es_sistema: true, activo: true, ...sync },
    ]).run();
    existingRoles = db.select({ id: schema.rol.id, nombre: schema.rol.nombre }).from(schema.rol).all();
  }

  const rolIds: Record<string, string> = {};
  for (const r of existingRoles) rolIds[r.nombre] = r.id;

  // Upsert permissions (codigo is unique — skip on conflict)
  for (const p of PERMISOS) {
    db.insert(schema.permiso)
      .values({ id: randomUUID(), codigo: p.codigo, modulo: p.modulo, ...sync })
      .onConflictDoNothing()
      .run();
  }

  // Re-query to get IDs (including pre-existing ones)
  const permisoRows = db.select({ id: schema.permiso.id, codigo: schema.permiso.codigo }).from(schema.permiso).all();
  const permisoIds: Record<string, string> = {};
  for (const r of permisoRows) permisoIds[r.codigo] = r.id;

  upsertRolPermisos(db, permisoIds, rolIds['OPERADOR'], rolIds['SUPERVISOR'], sync);

  // Create default admin user only if no users exist
  const userCount = db.select({ id: schema.usuario.id }).from(schema.usuario).all().length;
  if (userCount === 0) {
    db.insert(schema.usuario).values({
      id: randomUUID(),
      nombre_usuario: 'admin',
      nombre_completo: 'Administrador',
      hash_password: hashPassword('admin1234'),
      rol_id: rolIds['SUPERVISOR'],
      activo: true,
      usuario_creacion_id: 'system',
      fecha_creacion: now,
      ...sync,
    }).run();
  }
}
