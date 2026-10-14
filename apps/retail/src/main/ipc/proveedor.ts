import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, eq, isNull } from 'drizzle-orm';
import {
  proveedorListHandler as coreList, proveedorGetHandler as coreGet,
  proveedorUpsertHandler as coreUpsert, proveedorDeactivateHandler as coreDeactivate,
  proveedorQueryAll as coreQueryAll, type ProveedorHooks, type ProveedorUpsertPayload,
} from '@core/main';
import * as schema from '../db/schema';
import { crearBatchesPorEventoDeCosto } from '../precios/motor';

type Db = BetterSQLite3Database<typeof schema>;

export type { ProveedorUpsertPayload };

/**
 * ADR-049 §7/§1 — editar un default comercial del proveedor dispara un batch para todos los
 * productos donde es el preferido (solo listas en modo margen_costo). Desde ADR-106 el CRUD vive
 * en @core/main y este es el hook que Retail inyecta (`registerCoreHandlers({ proveedor })`).
 */
export const proveedorHooksRetail: ProveedorHooks = {
  onProveedorActualizado: (db, { id, userId, cambioDefaults }) => {
    if (!cambioDefaults) return;
    const d = db as unknown as Db;
    const productos = d.select({ producto_id: schema.producto_proveedor.producto_id })
      .from(schema.producto_proveedor)
      .where(and(
        eq(schema.producto_proveedor.proveedor_id, id),
        eq(schema.producto_proveedor.preferido, true),
        isNull(schema.producto_proveedor.deleted_at),
      ))
      .all();
    crearBatchesPorEventoDeCosto(d, {
      producto_ids: productos.map(prod => prod.producto_id),
      origen: 'PROVIDER_COST_UPDATE',
      proveedor_id: id,
      referencia_tipo: 'proveedor',
      referencia_id: id,
    }, userId);
  },
};

// Wrappers finos con el mismo contrato que tenían antes de ADR-106 (los tests de Retail son el oráculo).
export const proveedorListHandler = (db: Db) => coreList(db);
export const proveedorGetHandler = (db: Db, id: string) => coreGet(db, id);
export const proveedorUpsertHandler = (db: Db, payload: unknown) => coreUpsert(db, payload, proveedorHooksRetail);
export const proveedorDeactivateHandler = (db: Db, id: string) => coreDeactivate(db, id);
export const proveedorQueryAll = (db: Db) => coreQueryAll(db);
