import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq, and, ne, desc } from 'drizzle-orm';
import { app, dialog, BrowserWindow, type IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId, nombreCompletoCliente } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession } from '../auth/session';
import { getOriginId } from '../context';
import { renderRemitoHtml } from '../print/remito-template';
import { id, optId, str, optStr, num, arr } from '../validation/core';

type Db = BetterSQLite3Database<typeof schema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Proyeccion RE- + 7 digitos cero-padded. Sin digito verificador (ADR-045 §3). */
export function formatNumeroRemito(secuencial: number): string {
  return `RE-${String(secuencial).padStart(7, '0')}`;
}

/**
 * Lee e incrementa remito_proximo_secuencial dentro de la transaccion de emision.
 * Single-node; multinodo diferido a R4 (ADR-045 §3). Mismo patron que nextSkuAtomico.
 */
export function nextNumeroRemitoAtomico(tx: Tx): { numero: string; secuencial: number } {
  const row = tx.select().from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, 'remito_proximo_secuencial')).get();
  if (!row) throw new Error('remito_proximo_secuencial no encontrado en parametros_sistema');
  const secuencial = Number.parseInt(row.valor, 10);
  tx.update(schema.parametros_sistema)
    .set({ valor: String(secuencial + 1), actualizado_en: new Date() })
    .where(eq(schema.parametros_sistema.clave, 'remito_proximo_secuencial')).run();
  return { numero: formatNumeroRemito(secuencial), secuencial };
}

export type LineaPendiente = {
  venta_detalle_id: string;
  producto_id: string;
  descripcion: string;
  unidad: string | null;
  cantidad_vendida: number;
  cantidad_entregada: number;
  cantidad_pendiente: number;
};

export type PendienteVentaResult = {
  lineas: LineaPendiente[];
  domicilio_cliente: string | null;
};

/**
 * Entregado-vs-pendiente por linea de venta (ADR-045 §7).
 * Suma cantidad_entregada de remitos NO anulados: un remito anulado libera sus
 * cantidades, que vuelven a estar pendientes.
 * `excluir_remito_id` excluye las lineas de ese remito del calculo de "entregado" —
 * lo usa remitoEditarHandler para no contarse a si mismo (ADR-045 iter. 2 §5).
 * Acepta Db o Tx para poder recalcular dentro de la transaccion de emision/edicion.
 */
export function remitoPendientePorVentaHandler(
  db: Db | Tx,
  payload: { venta_id: string; excluir_remito_id?: string },
): PendienteVentaResult {
  const detalles = db.select({
    id: schema.venta_detalle.id,
    producto_id: schema.venta_detalle.producto_id,
    descripcion: schema.venta_detalle.descripcion,
    cantidad: schema.venta_detalle.cantidad,
    unidad: schema.producto.unidad_venta,
  })
    .from(schema.venta_detalle)
    .leftJoin(schema.producto, eq(schema.producto.id, schema.venta_detalle.producto_id))
    .where(eq(schema.venta_detalle.venta_id, payload.venta_id))
    .all();

  const ventaRow = db.select({ cliente_id: schema.venta.cliente_id }).from(schema.venta)
    .where(eq(schema.venta.id, payload.venta_id)).get();
  const clienteRow = ventaRow?.cliente_id
    ? db.select({
        domicilio: schema.cliente.domicilio,
        calle: schema.cliente.calle,
        numero: schema.cliente.numero,
        aclaracion: schema.cliente.aclaracion,
      }).from(schema.cliente)
        .where(eq(schema.cliente.id, ventaRow.cliente_id)).get()
    : null;
  // El form de clientes guarda calle/numero/aclaracion; `domicilio` quedo como campo
  // legacy que ya no completa nadie. Misma composicion que usa ClienteDetalle, si no
  // la precarga sale siempre vacia para cualquier cliente cargado por la UI actual.
  const calleLinea = [clienteRow?.calle, clienteRow?.numero, clienteRow?.aclaracion]
    .filter(Boolean).join(' ');
  const domicilio_cliente = calleLinea || clienteRow?.domicilio || null;

  if (detalles.length === 0) return { lineas: [], domicilio_cliente };

  const filtrosEntregadas = [
    eq(schema.remito.venta_id, payload.venta_id),
    ne(schema.remito.estado, 'anulado'),
    eq(schema.remito.activo, true),
  ];
  if (payload.excluir_remito_id) {
    filtrosEntregadas.push(ne(schema.remito.id, payload.excluir_remito_id));
  }

  const entregadas = db.select({
    venta_detalle_id: schema.remito_linea.venta_detalle_id,
    cantidad_entregada: schema.remito_linea.cantidad_entregada,
  })
    .from(schema.remito_linea)
    .innerJoin(schema.remito, eq(schema.remito.id, schema.remito_linea.remito_id))
    .where(and(...filtrosEntregadas))
    .all();

  const porDetalle = new Map<string, number>();
  for (const e of entregadas) {
    porDetalle.set(
      e.venta_detalle_id,
      (porDetalle.get(e.venta_detalle_id) ?? 0) + e.cantidad_entregada,
    );
  }

  const lineas = detalles.map((d) => {
    const entregada = porDetalle.get(d.id) ?? 0;
    return {
      venta_detalle_id: d.id,
      producto_id: d.producto_id,
      descripcion: d.descripcion,
      unidad: d.unidad ?? null,
      cantidad_vendida: d.cantidad,
      cantidad_entregada: entregada,
      cantidad_pendiente: d.cantidad - entregada,
    };
  });

  return { lineas, domicilio_cliente };
}

// Tolerancia para comparar cantidades en punto flotante (cantidad es REAL).
const EPSILON = 1e-9;

/**
 * Emision atomica: cabecera + N lineas + incremento del contador en UNA transaccion.
 * NO toca stock ni caja (ADR-045 §2 y §10) — solo documenta lo ya descontado por la venta.
 */
export function remitoCrearHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_venta_id = id(p['venta_id'], 'venta_id');
  const v_comprobante_id = optId(p['comprobante_id'], 'comprobante_id');
  const v_domicilio_entrega = str(p['domicilio_entrega'], 'domicilio_entrega', { max: 300 });
  const v_transportista_id = id(p['transportista_id'], 'transportista_id');
  const v_observaciones = optStr(p['observaciones'], 'observaciones', 1000);
  const v_lineas = arr(p['lineas'], 'lineas', (x, i) => {
    const l = (x ?? {}) as Record<string, unknown>;
    return {
      venta_detalle_id: id(l['venta_detalle_id'], `lineas.${i}.venta_detalle_id`),
      cantidad_entregada: num(l['cantidad_entregada'], `lineas.${i}.cantidad_entregada`, { min: 0 }),
    };
  });

  if (v_lineas.length === 0) throw new Error('SIN_LINEAS');

  const ventaRow = db.select().from(schema.venta)
    .where(eq(schema.venta.id, v_venta_id)).get();
  if (!ventaRow) throw new Error('VENTA_NOT_FOUND');
  if (ventaRow.estado !== 'confirmada') throw new Error(`VENTA_NO_CONFIRMADA:${ventaRow.estado}`);

  const transportistaRow = db.select().from(schema.transportista)
    .where(eq(schema.transportista.id, v_transportista_id)).get();
  if (!transportistaRow) throw new Error('TRANSPORTISTA_INVALIDO');

  const now = new Date();
  const sync = {
    version: 1 as const,
    origin_id: getOriginId(),
    sync_state: 'pending' as const,
    updated_at: now,
  };

  return db.transaction((tx) => {
    // Se recalcula el pendiente DENTRO de la transaccion para que la validacion vea
    // el estado real y no una lectura previa que pudo quedar obsoleta.
    const { lineas: pendientes } = remitoPendientePorVentaHandler(tx, { venta_id: v_venta_id });
    const porId = new Map(pendientes.map((pend) => [pend.venta_detalle_id, pend]));

    // Consolida lineas repetidas del mismo venta_detalle antes de validar, para que
    // dos entradas parciales no burlen el tope de pendiente por separado.
    const consolidadas = new Map<string, number>();
    for (const l of v_lineas) {
      consolidadas.set(
        l.venta_detalle_id,
        (consolidadas.get(l.venta_detalle_id) ?? 0) + l.cantidad_entregada,
      );
    }

    for (const [detalleId, cantidad] of consolidadas) {
      const pend = porId.get(detalleId);
      if (!pend) throw new Error(`LINEA_NO_PERTENECE_A_VENTA:${detalleId}`);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new Error(`CANTIDAD_INVALIDA:${detalleId}`);
      }

      const prod = tx.select().from(schema.producto)
        .where(eq(schema.producto.id, pend.producto_id)).get();
      if (prod && !prod.permite_fraccion && !Number.isInteger(cantidad)) {
        throw new Error(`FRACCION_NO_PERMITIDA:${detalleId}`);
      }
      if (cantidad > pend.cantidad_pendiente + EPSILON) {
        throw new Error(`EXCEDE_PENDIENTE:${detalleId}:${pend.cantidad_pendiente}`);
      }
    }

    // El contador se consume recien despues de validar todo: un remito rechazado
    // no debe dejar huecos en la numeracion.
    const { numero, secuencial } = nextNumeroRemitoAtomico(tx);
    const remitoId = generateId();

    tx.insert(schema.remito).values({
      id: remitoId,
      numero_secuencial: secuencial,
      numero,
      venta_id: v_venta_id,
      comprobante_id: v_comprobante_id ?? ventaRow.comprobante_id ?? null,
      estado: 'emitido',
      fecha_emision: now,
      domicilio_entrega: v_domicilio_entrega,
      transportista_id: transportistaRow.id,
      transportista: transportistaRow.razon_social,
      observaciones: v_observaciones ?? null,
      activo: true,
      creado_por_usuario_id: session.userId,
      creado_en: now,
      ...sync,
    }).run();

    for (const [detalleId, cantidad] of consolidadas) {
      const pend = porId.get(detalleId)!;
      tx.insert(schema.remito_linea).values({
        id: generateId(),
        remito_id: remitoId,
        venta_detalle_id: detalleId,
        cantidad_entregada: cantidad,
        producto_id: pend.producto_id,
        descripcion: pend.descripcion,
        unidad: pend.unidad,
        ...sync,
      }).run();
    }

    return tx.select().from(schema.remito).where(eq(schema.remito.id, remitoId)).get()!;
  });
}

/**
 * Edicion de un remito ya emitido (ADR-045 iter. 2 §5). Solo mientras estado='emitido'.
 * No agrega ni quita productos: solo ajusta cantidades de lineas YA incluidas, mas
 * domicilio/transportista. Si una cantidad editada queda en 0, esa linea se elimina
 * (no se guarda en 0 — no representa ninguna entrega real). Si tras aplicar los
 * cambios el remito quedaria sin lineas, se rechaza toda la edicion.
 */
export function remitoEditarHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const v_domicilio_entrega = str(p['domicilio_entrega'], 'domicilio_entrega', { max: 300 });
  const v_transportista_id = id(p['transportista_id'], 'transportista_id');
  const v_lineas = arr(p['lineas'], 'lineas', (x, i) => {
    const l = (x ?? {}) as Record<string, unknown>;
    return {
      remito_linea_id: id(l['remito_linea_id'], `lineas.${i}.remito_linea_id`),
      cantidad_entregada: num(l['cantidad_entregada'], `lineas.${i}.cantidad_entregada`, { min: 0 }),
    };
  });

  const existing = db.select().from(schema.remito).where(eq(schema.remito.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.estado !== 'emitido') throw new Error(`ESTADO_INVALIDO:${existing.estado}`);

  const transportistaRow = db.select().from(schema.transportista)
    .where(eq(schema.transportista.id, v_transportista_id)).get();
  if (!transportistaRow) throw new Error('TRANSPORTISTA_INVALIDO');

  const lineasActuales = db.select().from(schema.remito_linea)
    .where(eq(schema.remito_linea.remito_id, v_id)).all();
  const lineasActualesPorId = new Map(lineasActuales.map((l) => [l.id, l]));

  for (const l of v_lineas) {
    if (!lineasActualesPorId.has(l.remito_linea_id)) {
      throw new Error('LINEA_NO_PERTENECE_AL_REMITO');
    }
  }

  const seQuedarianTodasEnCero = v_lineas.every((l) => l.cantidad_entregada <= 0)
    && v_lineas.length === lineasActuales.length;
  if (seQuedarianTodasEnCero) throw new Error('REMITO_QUEDARIA_SIN_LINEAS');

  const now = new Date();

  return db.transaction((tx) => {
    const { lineas: pendientes } = remitoPendientePorVentaHandler(tx, {
      venta_id: existing.venta_id,
      excluir_remito_id: existing.id,
    });
    const pendientePorDetalle = new Map(pendientes.map((pend) => [pend.venta_detalle_id, pend]));

    for (const l of v_lineas) {
      const actual = lineasActualesPorId.get(l.remito_linea_id)!;
      if (l.cantidad_entregada <= 0) {
        tx.delete(schema.remito_linea).where(eq(schema.remito_linea.id, l.remito_linea_id)).run();
        continue;
      }
      const pend = pendientePorDetalle.get(actual.venta_detalle_id);
      const maximo = (pend?.cantidad_pendiente ?? 0);
      if (l.cantidad_entregada > maximo + EPSILON) {
        throw new Error(`EXCEDE_PENDIENTE:${actual.venta_detalle_id}:${maximo}`);
      }
      tx.update(schema.remito_linea).set({
        cantidad_entregada: l.cantidad_entregada,
        updated_at: now,
      }).where(eq(schema.remito_linea.id, l.remito_linea_id)).run();
    }

    const lineasRestantes = tx.select().from(schema.remito_linea)
      .where(eq(schema.remito_linea.remito_id, v_id)).all();
    if (lineasRestantes.length === 0) throw new Error('REMITO_QUEDARIA_SIN_LINEAS');

    tx.update(schema.remito).set({
      domicilio_entrega: v_domicilio_entrega,
      transportista_id: transportistaRow.id,
      transportista: transportistaRow.razon_social,
      version: existing.version + 1,
      sync_state: 'pending',
      updated_at: now,
    }).where(eq(schema.remito.id, v_id)).run();

    return tx.select().from(schema.remito).where(eq(schema.remito.id, v_id)).get()!;
  });
}

export type ListarRemitosPayload = {
  estado?: 'emitido' | 'conformado' | 'anulado';
  venta_id?: string;
};

export function remitoListarHandler(db: Db, payload: ListarRemitosPayload = {}) {
  const filtros = [eq(schema.remito.activo, true)];
  if (payload.estado) filtros.push(eq(schema.remito.estado, payload.estado));
  if (payload.venta_id) filtros.push(eq(schema.remito.venta_id, payload.venta_id));

  return db.select({
    id: schema.remito.id,
    numero: schema.remito.numero,
    numero_secuencial: schema.remito.numero_secuencial,
    estado: schema.remito.estado,
    fecha_emision: schema.remito.fecha_emision,
    fecha_entrega: schema.remito.fecha_entrega,
    recibido_por: schema.remito.recibido_por,
    transportista: schema.remito.transportista,
    venta_id: schema.remito.venta_id,
    venta_numero_interno: schema.venta.numero_interno,
    cliente_nombre: schema.cliente.nombre,
    cliente_apellido: schema.cliente.apellido,
  })
    .from(schema.remito)
    .leftJoin(schema.venta, eq(schema.venta.id, schema.remito.venta_id))
    .leftJoin(schema.cliente, eq(schema.cliente.id, schema.venta.cliente_id))
    .where(and(...filtros))
    .orderBy(desc(schema.remito.numero_secuencial))
    .all()
    .map(({ cliente_nombre, cliente_apellido, ...r }) => ({
      ...r,
      cliente_nombre_completo: cliente_nombre != null
        ? nombreCompletoCliente({ nombre: cliente_nombre, apellido: cliente_apellido })
        : null,
    }));
}

export function remitoObtenerHandler(db: Db, payload: { id: string }) {
  const cab = db.select({
    remito: schema.remito,
    venta_numero_interno: schema.venta.numero_interno,
    venta_fecha: schema.venta.fecha,
    cliente_nombre: schema.cliente.nombre,
    cliente_apellido: schema.cliente.apellido,
    cliente_documento: schema.cliente.numero_documento,
    cliente_condicion_fiscal: schema.cliente.condicion_fiscal,
    cliente_domicilio: schema.cliente.domicilio,
  })
    .from(schema.remito)
    .leftJoin(schema.venta, eq(schema.venta.id, schema.remito.venta_id))
    .leftJoin(schema.cliente, eq(schema.cliente.id, schema.venta.cliente_id))
    .where(eq(schema.remito.id, payload.id))
    .get();
  if (!cab) throw new Error('NOT_FOUND');

  const lineas = db.select().from(schema.remito_linea)
    .where(eq(schema.remito_linea.remito_id, payload.id)).all();

  return {
    ...cab.remito,
    venta_numero_interno: cab.venta_numero_interno,
    venta_fecha: cab.venta_fecha,
    cliente_nombre_completo: cab.cliente_nombre != null
      ? nombreCompletoCliente({ nombre: cab.cliente_nombre, apellido: cab.cliente_apellido })
      : null,
    cliente_documento: cab.cliente_documento,
    cliente_condicion_fiscal: cab.cliente_condicion_fiscal,
    cliente_domicilio: cab.cliente_domicilio,
    lineas,
  };
}

/** emitido -> conformado. Registra fecha_entrega + recibido_por (ADR-045 §8). */
export function remitoConformarHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD. recibido_por es
  // requerido por regla de negocio (no por forma): optStr sólo valida tipo/longitud,
  // el trim-a-vacio sigue lanzando el codigo de dominio RECIBIDO_POR_REQUERIDO.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const v_recibido_por = optStr(p['recibido_por'], 'recibido_por', 200);
  // fecha_entrega no es un string: no hay primitiva de fecha en validation/core,
  // se preserva el manejo original (Date | number | null | undefined).
  const fechaEntrega = p['fecha_entrega'] as Date | number | null | undefined;

  const recibidoPor = v_recibido_por ?? '';
  if (recibidoPor === '') throw new Error('RECIBIDO_POR_REQUERIDO');

  const existing = db.select().from(schema.remito)
    .where(eq(schema.remito.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.estado !== 'emitido') throw new Error(`ESTADO_INVALIDO:${existing.estado}`);

  const now = new Date();
  db.update(schema.remito).set({
    estado: 'conformado',
    fecha_entrega: fechaEntrega ? new Date(fechaEntrega) : now,
    recibido_por: recibidoPor,
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
  }).where(eq(schema.remito.id, v_id)).run();

  return db.select().from(schema.remito).where(eq(schema.remito.id, v_id)).get()!;
}

/**
 * Anulacion = cambio de estado + auditoria. NO genera movimientos inversos
 * (ADR-045 §8): el remito nunca toco saldos. Libera las cantidades entregadas,
 * que vuelven a contar como pendientes via remitoPendientePorVentaHandler.
 * Se permite anular tanto un remito emitido como uno ya conformado.
 */
export function remitoAnularHandler(db: Db, payload: unknown) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  // ADR-085 (SEC-2): validar en el borde, antes de tocar la BD. motivo es requerido
  // por regla de negocio (no por forma): ver comentario analogo en remitoConformarHandler.
  const p = (payload ?? {}) as Record<string, unknown>;
  const v_id = id(p['id'], 'id');
  const v_motivo = optStr(p['motivo'], 'motivo', 500);
  const motivo = v_motivo ?? '';
  if (motivo === '') throw new Error('MOTIVO_REQUERIDO');

  const existing = db.select().from(schema.remito)
    .where(eq(schema.remito.id, v_id)).get();
  if (!existing) throw new Error('NOT_FOUND');
  if (existing.estado === 'anulado') throw new Error(`ESTADO_INVALIDO:${existing.estado}`);

  const now = new Date();
  db.update(schema.remito).set({
    estado: 'anulado',
    anulado_en: now,
    anulado_por_usuario_id: session.userId,
    motivo_anulacion: motivo,
    version: existing.version + 1,
    sync_state: 'pending',
    updated_at: now,
  }).where(eq(schema.remito.id, v_id)).run();

  return db.select().from(schema.remito).where(eq(schema.remito.id, v_id)).get()!;
}

/** Mismo patron que generarPdfConWindow en etiquetas.ts (ADR-015/026). */
async function generarPdfConWindow(html: string): Promise<{ buffer: Buffer; win: BrowserWindow }> {
  const tmpPath = path.join(os.tmpdir(), `remito-${Date.now()}.html`);
  fs.writeFileSync(tmpPath, html, 'utf-8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await win.loadFile(tmpPath);
    // Margenes por defecto: el remito es un documento A4, no una etiqueta posicionada.
    const buffer = await win.webContents.printToPDF({ printBackground: true });
    fs.unlinkSync(tmpPath);
    return { buffer, win };
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    win.destroy();
    throw e;
  }
}

/** Convierte la fila de remitoObtenerHandler al shape que espera el template. */
export function toRemitoImprimible(remito: ReturnType<typeof remitoObtenerHandler>) {
  return {
    numero: remito.numero,
    fecha_emision: remito.fecha_emision,
    estado: remito.estado,
    domicilio_entrega: remito.domicilio_entrega,
    transportista: remito.transportista,
    observaciones: remito.observaciones,
    venta_numero_interno: remito.venta_numero_interno,
    cliente_nombre_completo: remito.cliente_nombre_completo,
    cliente_documento: remito.cliente_documento,
    lineas: remito.lineas.map((l) => ({
      cantidad_entregada: l.cantidad_entregada,
      descripcion: l.descripcion,
      unidad: l.unidad,
    })),
  };
}

export async function remitoImprimirHandler(
  db: Db,
  payload: { id: string },
): Promise<{ guardado: boolean; ruta?: string }> {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const remito = remitoObtenerHandler(db, payload);

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Guardar remito',
    defaultPath: path.join(app.getPath('documents'), `${remito.numero}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { guardado: false };

  const { buffer, win } = await generarPdfConWindow(renderRemitoHtml(toRemitoImprimible(remito)));
  win.close();

  fs.writeFileSync(filePath, buffer);
  return { guardado: true, ruta: filePath };
}

export function registerRemitoHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('remito:crear',     async (_e, p) => remitoCrearHandler(db, p));
  ipcMain.handle('remito:editar',    async (_e, p) => remitoEditarHandler(db, p));
  ipcMain.handle('remito:listar',    async (_e, p) => remitoListarHandler(db, p ?? {}));
  ipcMain.handle('remito:obtener',   async (_e, p) => remitoObtenerHandler(db, p));
  ipcMain.handle('remito:pendiente', async (_e, p) => remitoPendientePorVentaHandler(db, p));
  ipcMain.handle('remito:conformar', async (_e, p) => remitoConformarHandler(db, p));
  ipcMain.handle('remito:anular',    async (_e, p) => remitoAnularHandler(db, p));
  ipcMain.handle('remito:imprimir',  async (_e, p) => remitoImprimirHandler(db, p));
}
