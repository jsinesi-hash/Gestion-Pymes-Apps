import { eq, inArray } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { nombreCompletoCliente } from '@ferreteria/shared';
import {
  getSession, pausarVentaEspera, listarVentasEspera, descartarVentaEspera,
  id as vId, optId, optStr,
} from '@core/main';
import * as schema from '../db/schema';
import { valorizarCarrito } from '../domain/venta';
import { parseCarrito, cargarCatalogo, guardarLineasElaborados, lineasConModificadores } from './venta';

type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

function requireVentaCrear() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');
  return session;
}

export function ventaEsperaPausarHandler(db: Db, rawPayload: unknown): { venta_id: string } {
  requireVentaCrear();
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  const carrito = parseCarrito(p);
  const caja_id = vId(p['caja_id'], 'caja_id');
  const cliente_id = vId(p['cliente_id'], 'cliente_id');
  const venta_id = optId(p['venta_id'], 'venta_id');
  const alias = optStr(p['alias'], 'alias', 60);
  const observaciones = optStr(p['observaciones'], 'observaciones', 500);

  const { productos, opciones } = cargarCatalogo(db, carrito.lineas.map((l) => l.producto_venta_id), cliente_id);
  const v = valorizarCarrito(productos, opciones, carrito);

  return pausarVentaEspera(db, {
    caja_id, cliente_id,
    subtotal: v.subtotal_centavos / 100,
    descuento_global: carrito.descuento_global_pct, // PORCENTAJE (convención de la columna)
    importe_iva: v.importe_iva_centavos / 100,
    total: v.total_centavos / 100,
    ajuste_redondeo: v.ajuste_redondeo_centavos / 100,
    ...(venta_id !== undefined && { venta_id }),
    ...(alias !== undefined && { alias }),
    ...(observaciones !== undefined && { observaciones }),
  }, { aplicarLineas: (tx, ctx) => guardarLineasElaborados(tx as unknown as Tx, v, ctx) });
}

export function ventaEsperaListarHandler(db: Db) {
  requireVentaCrear();
  return listarVentasEspera(db, (ventaId) =>
    db.select({ id: schema.venta_linea.id }).from(schema.venta_linea)
      .where(eq(schema.venta_linea.venta_id, ventaId)).all().length);
}

export function ventaEsperaRetomarHandler(db: Db, rawPayload: unknown) {
  requireVentaCrear();
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  const ventaId = vId(p['venta_id'], 'venta_id');
  const venta = db.select().from(schema.venta).where(eq(schema.venta.id, ventaId)).get();
  if (!venta) throw new Error('VENTA_ESPERA_NOT_FOUND');
  if (venta.estado !== 'en_espera') throw new Error('VENTA_NO_EN_ESPERA');

  const lineas = lineasConModificadores(db, venta.id);
  const opcionIds = [...new Set(lineas.flatMap((l) => l.modificadores.map((m) => m.grupo_modificador_opcion_id)))];
  const grupoPorOpcion = new Map<string, string>(
    opcionIds.length === 0 ? [] : db.select({ id: schema.grupo_modificador_opcion.id, g: schema.grupo_modificador_opcion.grupo_modificador_id })
      .from(schema.grupo_modificador_opcion).where(inArray(schema.grupo_modificador_opcion.id, opcionIds)).all()
      .map((o) => [o.id, o.g] as const));
  const c = db.select().from(schema.cliente).where(eq(schema.cliente.id, venta.cliente_id)).get();

  return {
    venta_id: venta.id,
    alias: venta.alias ?? null,
    observaciones: venta.observaciones ?? null,
    descuento_global_pct: venta.descuento_global,
    cliente: c
      ? { id: c.id, nombre_completo: nombreCompletoCliente(c), habilita_cuenta_corriente: c.habilita_cuenta_corriente }
      : null,
    lineas: lineas.map((l) => {
      const porGrupo = new Map<string, string[]>();
      for (const m of l.modificadores) {
        const g = grupoPorOpcion.get(m.grupo_modificador_opcion_id);
        if (g) porGrupo.set(g, [...(porGrupo.get(g) ?? []), m.grupo_modificador_opcion_id]);
      }
      return {
        producto_venta_id: l.producto_venta_id, nombre: l.descripcion, cantidad: l.cantidad,
        descuento_linea_pct: l.descuento_linea_pct,
        modificadores: [...porGrupo].map(([grupo_modificador_id, opcion_ids]) => ({ grupo_modificador_id, opcion_ids })),
      };
    }),
  };
}

export function ventaEsperaDescartarHandler(db: Db, rawPayload: unknown): { ok: boolean } {
  requireVentaCrear();
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  return descartarVentaEspera(db, vId(p['venta_id'], 'venta_id'));
}

export function registerVentaEsperaHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('venta.espera:pausar',    async (_e, p) => ventaEsperaPausarHandler(db, p));
  ipcMain.handle('venta.espera:listar',    async ()      => ventaEsperaListarHandler(db));
  ipcMain.handle('venta.espera:retomar',   async (_e, p) => ventaEsperaRetomarHandler(db, p));
  ipcMain.handle('venta.espera:descartar', async (_e, p) => ventaEsperaDescartarHandler(db, p));
}
