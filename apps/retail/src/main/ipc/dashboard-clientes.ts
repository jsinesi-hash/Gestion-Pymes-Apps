// packages/client/src/main/ipc/dashboard-clientes.ts
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, gte, lte, sql, desc, ne } from 'drizzle-orm';
import { nombreCompletoCliente } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { requirePermission } from '../auth/guard';

type Db = BetterSQLite3Database<typeof schema>;

// ID del cliente sistema "Consumidor Final" (inserido en migración 0003)
const CF_ID = 'cf000000-0000-0000-0000-000000000001';

export type ClienteRankingEntry = {
  cliente_id: string;
  nombre_completo: string;
  total_facturado: number;
  count_ventas: number;
};

export type DashboardClientesRango = {
  ranking: ClienteRankingEntry[];
  clientes_nuevos: number;
};

export type DashboardClientesEstado = {
  deuda_total: number;
  deuda_vencida: number;
  clientes_inactivos: number;
};

function getParam(db: Db, clave: string, defaultVal: number): number {
  const row = db.select({ valor: schema.parametros_sistema.valor })
    .from(schema.parametros_sistema)
    .where(eq(schema.parametros_sistema.clave, clave))
    .get();
  return row ? Number.parseInt(row.valor, 10) : defaultVal;
}

export function dashboardClientesRangoHandler(
  db: Db,
  params: { desde: Date; hasta: Date },
): DashboardClientesRango {
  const { desde, hasta } = params;

  const ranking = db.select({
    cliente_id:      schema.venta.cliente_id,
    nombre:          schema.cliente.nombre,
    apellido:        schema.cliente.apellido,
    total_facturado: sql<number>`sum(${schema.venta.total})`,
    count_ventas:    sql<number>`count(*)`,
  }).from(schema.venta)
    .innerJoin(schema.cliente, eq(schema.venta.cliente_id, schema.cliente.id))
    .where(and(
      eq(schema.venta.estado, 'confirmada'),
      gte(schema.venta.fecha, desde),
      lte(schema.venta.fecha, hasta),
    ))
    .groupBy(schema.venta.cliente_id)
    .orderBy(desc(sql`sum(${schema.venta.total})`))
    .limit(10)
    .all()
    .map(({ nombre, apellido, ...r }) => ({ ...r, nombre_completo: nombreCompletoCliente({ nombre, apellido }) }));

  const nuevosRow = db.select({ count: sql<number>`count(*)` })
    .from(schema.cliente)
    .where(and(
      eq(schema.cliente.activo, true),
      ne(schema.cliente.id, CF_ID),
      gte(schema.cliente.fecha_creacion, desde),
      lte(schema.cliente.fecha_creacion, hasta),
    ))
    .get()!;

  return { ranking, clientes_nuevos: nuevosRow.count ?? 0 };
}

export function dashboardClientesEstadoHandler(db: Db): DashboardClientesEstado {
  const now = new Date();
  const diasVenc  = getParam(db, 'cc_dias_vencimiento', 30);
  const diasInact = getParam(db, 'cliente_dias_inactividad', 60);
  const umbralVenc  = new Date(now.getTime() - diasVenc  * 86400000);
  const umbralInact = new Date(now.getTime() - diasInact * 86400000);

  const deudaTotalRow = db.select({
    total: sql<number>`coalesce(sum(${schema.cuenta_corriente_cliente.saldo_centavos}), 0)`,
  }).from(schema.cuenta_corriente_cliente)
    .where(and(
      eq(schema.cuenta_corriente_cliente.activo, true),
      sql`${schema.cuenta_corriente_cliente.saldo_centavos} > 0`,
    ))
    .get()!;

  // fecha_ultimo_movimiento se almacena como integer en SEGUNDOS desde epoch (mode:'timestamp')
  // Drizzle's mapToDriverValue hace Math.floor(ms / 1000) → guardar en segundos
  // Para comparar en raw SQL, hay que pasar el umbral también en segundos
  const umbralVencSec = Math.floor(umbralVenc.getTime() / 1000);
  const deudaVencidaRow = db.select({
    total: sql<number>`coalesce(sum(${schema.cuenta_corriente_cliente.saldo_centavos}), 0)`,
  }).from(schema.cuenta_corriente_cliente)
    .where(and(
      eq(schema.cuenta_corriente_cliente.activo, true),
      sql`${schema.cuenta_corriente_cliente.saldo_centavos} > 0`,
      sql`(${schema.cuenta_corriente_cliente.fecha_ultimo_movimiento} IS NULL OR ${schema.cuenta_corriente_cliente.fecha_ultimo_movimiento} < ${umbralVencSec})`,
    ))
    .get()!;

  // Clientes activos reales (excluye el "Consumidor Final" del sistema)
  const todosActivos = db.select({ id: schema.cliente.id })
    .from(schema.cliente)
    .where(and(
      eq(schema.cliente.activo, true),
      ne(schema.cliente.id, CF_ID),
    ))
    .all();

  const conCompraReciente = new Set(
    db.select({ cliente_id: schema.venta.cliente_id })
      .from(schema.venta)
      .where(and(
        eq(schema.venta.estado, 'confirmada'),
        gte(schema.venta.fecha, umbralInact),
      ))
      .all()
      .map(r => r.cliente_id),
  );

  const clientes_inactivos = todosActivos.filter(c => !conCompraReciente.has(c.id)).length;

  return {
    deuda_total:   (deudaTotalRow.total ?? 0) / 100,
    deuda_vencida: (deudaVencidaRow.total ?? 0) / 100,
    clientes_inactivos,
  };
}

export function registerDashboardClientesHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('dashboard.ver');
  ipcMain.handle('dashboard:clientes-rango',  guard(async (_e, p) => dashboardClientesRangoHandler(db, p)));
  ipcMain.handle('dashboard:clientes-estado', guard(async ()       => dashboardClientesEstadoHandler(db)));
}
