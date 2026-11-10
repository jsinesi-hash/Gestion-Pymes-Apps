import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@core/db';
import { hashPassword } from './hash';
import { PERMISOS_CORE, OPERADOR_PERMISOS_CORE, type PermisoDef } from './permisos-core';

type Db = BetterSQLite3Database<typeof schema>;

export type SeedAuthOpts = { permisos: readonly PermisoDef[]; operador: readonly string[] };

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
  permisos: readonly PermisoDef[],
  operador: Set<string>,
  permisoIds: Record<string, string>,
  rolOperadorId: string | undefined,
  rolSupervisorId: string | undefined,
  sync: SyncMeta,
): void {
  // ADR-147: lo que un administrador cambió desde «Roles y permisos» manda sobre la fábrica.
  const overrides = db.select({
    rol_id: schema.rol_permiso_override.rol_id,
    permiso_id: schema.rol_permiso_override.permiso_id,
    otorgado: schema.rol_permiso_override.otorgado,
  }).from(schema.rol_permiso_override).all();
  const revocados = new Set(overrides.filter(o => !o.otorgado).map(o => `${o.rol_id}|${o.permiso_id}`));
  const otorgar = (rolId: string, permisoId: string) => {
    if (!revocados.has(`${rolId}|${permisoId}`)) upsertRolPermiso(db, rolId, permisoId, sync);
  };

  for (const p of permisos) {
    const permisoId = permisoIds[p.codigo];
    if (!permisoId) continue;
    if (operador.has(p.codigo) && rolOperadorId) otorgar(rolOperadorId, permisoId);
    if (rolSupervisorId) otorgar(rolSupervisorId, permisoId);
  }
  // Los agregados a mano se reponen si faltan (p. ej. tras restaurar un backup parcial).
  for (const o of overrides) {
    if (o.otorgado) upsertRolPermiso(db, o.rol_id, o.permiso_id, sync);
  }
}

export function runSeed(db: Db, opts: SeedAuthOpts): void {
  const vistos = new Set<string>();
  const permisos = [...PERMISOS_CORE, ...opts.permisos].filter(p => !vistos.has(p.codigo) && vistos.add(p.codigo));
  const operador = new Set([...OPERADOR_PERMISOS_CORE, ...opts.operador]);

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
  for (const p of permisos) {
    db.insert(schema.permiso)
      .values({ id: randomUUID(), codigo: p.codigo, modulo: p.modulo, ...sync })
      .onConflictDoNothing()
      .run();
  }

  // Re-query to get IDs (including pre-existing ones)
  const permisoRows = db.select({ id: schema.permiso.id, codigo: schema.permiso.codigo }).from(schema.permiso).all();
  const permisoIds: Record<string, string> = {};
  for (const r of permisoRows) permisoIds[r.codigo] = r.id;

  upsertRolPermisos(db, permisos, operador, permisoIds, rolIds['OPERADOR'], rolIds['SUPERVISOR'], sync);

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
