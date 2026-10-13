import { eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, arr, num, id as vId, pausarVentaEspera, listarVentasEspera, descartarVentaEspera } from '@core/main';
import type { LineaPayload } from './venta';

type Db = BetterSQLite3Database<typeof schema>;

function requireSession() {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export type PausarPayload = {
  caja_id: string;
  cliente_id: string;
  lineas: LineaPayload[];
  descuento_global: number;
  subtotal: number;
  importe_iva: number;
  total: number;
  ajuste_redondeo: number;
  alias?: string | undefined;
};

export type VentaEsperaItem = {
  id: string;
  alias: string | null;
  en_espera_desde: Date | null;
  turno_creacion_id: string | null;
  cliente_id: string;
  total: number;
  count_items: number;
  vencida: boolean;
};

export type VentaEsperaLinea = {
  producto_id: string;
  descripcion: string;
  cantidad: number;
  precio_lista_actual_centavos: number;
  precio_unitario_guardado: number;
  descuento_linea_pct: number;
  alicuota_iva: number;
  permite_fraccion: boolean;
  stock_fisico: number;
};

export type VentaEsperaRetomarResult = {
  venta_id: string;
  alias: string | null;
  cliente_id: string;
  descuento_global: number;
  lineas: VentaEsperaLinea[];
  avisos: {
    stock_caido: Array<{ producto_id: string; nombre: string; stock_disponible: number }>;
    precio_cambiado: Array<{ producto_id: string; nombre: string; precio_viejo: number; precio_nuevo: number }>;
  };
};

export function ventaEsperaPausarHandler(db: Db, rawPayload: unknown): { venta_id: string } {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  // ADR-082 (SEC-2): valida la forma del payload antes de la lógica de negocio.
  const p = (rawPayload ?? {}) as Record<string, unknown>;
  arr(p['lineas'], 'lineas', (l, i) => {
    const li = (l ?? {}) as Record<string, unknown>;
    return {
      producto_id: vId(li['producto_id'], `lineas.${i}.producto_id`),
      cantidad: num(li['cantidad'], `lineas.${i}.cantidad`, { min: 0 }),
    };
  });
  const payload = rawPayload as PausarPayload;

  return pausarVentaEspera(db, {
    caja_id: payload.caja_id,
    cliente_id: payload.cliente_id,
    subtotal: payload.subtotal,
    descuento_global: payload.descuento_global,
    importe_iva: payload.importe_iva,
    total: payload.total,
    ajuste_redondeo: payload.ajuste_redondeo,
    ...(payload.alias !== undefined && { alias: payload.alias }),
  }, {
    aplicarLineas: (tx, ctx) => {
      for (const linea of payload.lineas) {
        tx.insert(schema.venta_detalle).values({
          id: generateId(),
          venta_id: ctx.ventaId,
          producto_id: linea.producto_id,
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
          precio_unitario: linea.precio_unitario,
          descuento_linea: linea.descuento_linea,
          alicuota_iva: linea.alicuota_iva,
          subtotal: linea.subtotal,
          ...ctx.sync,
        }).run();
      }
    },
  });
}

export function ventaEsperaListarHandler(db: Db): VentaEsperaItem[] {
  return listarVentasEspera(db, (id) =>
    db.select({ id: schema.venta_detalle.id })
      .from(schema.venta_detalle)
      .where(eq(schema.venta_detalle.venta_id, id))
      .all().length);
}

export function ventaEsperaRetomarHandler(db: Db, rawPayload: unknown): VentaEsperaRetomarResult {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  const p = (rawPayload ?? {}) as Record<string, unknown>;
  vId(p['venta_id'], 'venta_id');
  const payload = rawPayload as { venta_id: string };

  const ventaRow = db.select().from(schema.venta)
    .where(eq(schema.venta.id, payload.venta_id))
    .get();
  if (!ventaRow) throw new Error('VENTA_ESPERA_NOT_FOUND');
  if (ventaRow.estado !== 'en_espera') throw new Error('VENTA_NO_EN_ESPERA');

  const detalles = db.select().from(schema.venta_detalle)
    .where(eq(schema.venta_detalle.venta_id, payload.venta_id))
    .all();

  const avisos: VentaEsperaRetomarResult['avisos'] = { stock_caido: [], precio_cambiado: [] };
  const lineas: VentaEsperaLinea[] = [];

  for (const det of detalles) {
    const prod = db.select().from(schema.producto)
      .where(eq(schema.producto.id, det.producto_id)).get()!;
    const ex = db.select().from(schema.existencias)
      .where(eq(schema.existencias.producto_id, det.producto_id)).get();

    const stockDisponible = ex?.stock_fisico ?? 0;
    if (stockDisponible < det.cantidad) {
      avisos.stock_caido.push({
        producto_id: det.producto_id,
        nombre: prod.nombre_corto,
        stock_disponible: stockDisponible,
      });
    }

    const precioActual = prod.precio_venta_lista;
    if (Math.abs(precioActual - det.precio_unitario) > 0.001) {
      avisos.precio_cambiado.push({
        producto_id: det.producto_id,
        nombre: prod.nombre_corto,
        precio_viejo: det.precio_unitario,
        precio_nuevo: precioActual,
      });
    }

    lineas.push({
      producto_id: det.producto_id,
      descripcion: det.descripcion,
      cantidad: det.cantidad,
      precio_lista_actual_centavos: Math.round(precioActual * 100),
      precio_unitario_guardado: det.precio_unitario,
      descuento_linea_pct: det.descuento_linea,
      alicuota_iva: det.alicuota_iva,
      permite_fraccion: prod.permite_fraccion ?? false,
      stock_fisico: stockDisponible,
    });
  }

  return {
    venta_id: payload.venta_id,
    alias: ventaRow.alias ?? null,
    cliente_id: ventaRow.cliente_id,
    descuento_global: ventaRow.descuento_global,
    lineas,
    avisos,
  };
}

export function ventaEsperaDescartarHandler(db: Db, rawPayload: unknown): { ok: boolean } {
  const session = requireSession();
  if (!session.permisos.has('venta.crear')) throw new Error('FORBIDDEN');

  const p = (rawPayload ?? {}) as Record<string, unknown>;
  vId(p['venta_id'], 'venta_id');
  const payload = rawPayload as { venta_id: string };

  return descartarVentaEspera(db, payload.venta_id);
}

export function registerVentaEsperaHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('venta.espera:pausar',    async (_e, p) => ventaEsperaPausarHandler(db, p));
  ipcMain.handle('venta.espera:listar',    async ()      => ventaEsperaListarHandler(db));
  ipcMain.handle('venta.espera:retomar',   async (_e, p) => ventaEsperaRetomarHandler(db, p));
  ipcMain.handle('venta.espera:descartar', async (_e, p) => ventaEsperaDescartarHandler(db, p));
}
