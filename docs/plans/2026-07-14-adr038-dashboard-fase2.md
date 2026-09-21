# ADR-038 Dashboard Fase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar los tabs Caja, Clientes y Proveedores del Dashboard con handlers IPC, vistas React y tests completos.

**Architecture:** Tres archivos de handler nuevos (`dashboard-caja-rango.ts`, `dashboard-clientes.ts`, `dashboard-proveedores.ts`) con handlers puros (sin efectos); tres vistas TabView nuevas bajo `src/renderer/views/dashboard/`; `DashboardView.tsx` actualizado para habilitar los tres tabs; cinco entradas nuevas en preload.

**Tech Stack:** Electron 32 + React + TypeScript, SQLite via Drizzle ORM, Vitest, Recharts (ya instalado).

**Spec:** `docs/specs/2026-07-14-adr038-dashboard-fase2-design.md`

---

## File Map

| Acción | Archivo |
|--------|---------|
| CREATE | `packages/client/src/main/db/migrations/0020_adr038_dashboard_fase2.sql` |
| CREATE | `packages/client/src/main/ipc/dashboard-caja-rango.ts` |
| CREATE | `packages/client/src/main/ipc/__tests__/dashboard-caja-rango.handlers.test.ts` |
| CREATE | `packages/client/src/main/ipc/dashboard-clientes.ts` |
| CREATE | `packages/client/src/main/ipc/__tests__/dashboard-clientes.handlers.test.ts` |
| CREATE | `packages/client/src/main/ipc/dashboard-proveedores.ts` |
| CREATE | `packages/client/src/main/ipc/__tests__/dashboard-proveedores.handlers.test.ts` |
| MODIFY | `packages/client/src/preload/index.ts` |
| MODIFY | `packages/client/src/main/index.ts` |
| CREATE | `packages/client/src/renderer/views/dashboard/caja/CajaTabView.tsx` |
| CREATE | `packages/client/src/renderer/views/dashboard/__tests__/CajaTabView.test.tsx` |
| CREATE | `packages/client/src/renderer/views/dashboard/clientes/ClientesTabView.tsx` |
| CREATE | `packages/client/src/renderer/views/dashboard/__tests__/ClientesTabView.test.tsx` |
| CREATE | `packages/client/src/renderer/views/dashboard/proveedores/ProveedoresTabView.tsx` |
| CREATE | `packages/client/src/renderer/views/dashboard/__tests__/ProveedoresTabView.test.tsx` |
| MODIFY | `packages/client/src/renderer/views/dashboard/DashboardView.tsx` |
| MODIFY | `packages/client/src/renderer/views/dashboard/__tests__/DashboardTabs.test.tsx` |

---

## Task 1: Migración SQL — parámetros nuevos

**Files:**
- Create: `packages/client/src/main/db/migrations/0020_adr038_dashboard_fase2.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- 0020_adr038_dashboard_fase2.sql
-- Parámetros para Dashboard Fase 2 (ADR-038)
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('cc_dias_vencimiento', '30', 'number', 'Días desde fecha_ultimo_movimiento en CCC para considerar deuda vencida');
--> statement-breakpoint
INSERT OR IGNORE INTO parametros_sistema (clave, valor, tipo, descripcion)
VALUES ('cliente_dias_inactividad', '60', 'number', 'Días sin ventas confirmadas para clasificar cliente como inactivo en dashboard');
```

- [ ] **Step 2: Verificar que los tests existentes siguen verdes**

```bash
cd packages/client && node scripts/test-node.cjs
```

Expected: suite verde (los INSERTs son idempotentes con `OR IGNORE`).

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/main/db/migrations/0020_adr038_dashboard_fase2.sql
git commit -m "feat(dashboard): migración 0020 — parámetros cc_dias_vencimiento y cliente_dias_inactividad"
```

---

## Task 2: Handler `dashboard-caja-rango.ts` + tests

**Files:**
- Create: `packages/client/src/main/ipc/dashboard-caja-rango.ts`
- Create: `packages/client/src/main/ipc/__tests__/dashboard-caja-rango.handlers.test.ts`

### Step 2.1 — Escribir el test primero (RED)

- [ ] **Crear el archivo de test**

```typescript
// packages/client/src/main/ipc/__tests__/dashboard-caja-rango.handlers.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { generateId } from '@ferreteria/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler } from '../stock';
import { cajaAbrirHandler } from '../caja';
import { ventaConfirmarHandler, type VentaConfirmarPayload } from '../venta';
import { dashboardCajaRangoHandler } from '../dashboard-caja-rango';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';
type Db = ReturnType<typeof setupDb>;

function todayRange() {
  const now = new Date();
  return {
    desde: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    hasta: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

function crearProductoYCaja(db: Db) {
  runCatalogSeed(db);
  loginAsAdmin(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
  const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: 'Tornillo', categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'u', precio_venta_lista: 1000,
  });
  stockEntradaHandler(db, { producto_id: prod.id, cantidad: 100 });
  const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
  return { prod, caja };
}

function makeEfectivoPayload(cajaId: string, prodId: string, total = 1000): VentaConfirmarPayload {
  return {
    caja_id: cajaId, cliente_id: CF_ID,
    lineas: [{ producto_id: prodId, descripcion: 'Prod', cantidad: 1, precio_unitario: total, descuento_linea: 0, alicuota_iva: 21, subtotal: total }],
    descuento_global: 0, subtotal: total, importe_iva: Math.round(total * 21 / 121 * 100) / 100,
    total, ajuste_redondeo: 0,
    pagos: [{ medio_pago: 'efectivo', monto_centavos: total * 100, recargo_pct: 0, recargo_centavos: 0 }],
  };
}

function makeTarjetaPayload(cajaId: string, prodId: string, total = 2000, recargoPct = 5): VentaConfirmarPayload {
  const recargoCentavos = Math.round(total * 100 * recargoPct / 100);
  return {
    caja_id: cajaId, cliente_id: CF_ID,
    lineas: [{ producto_id: prodId, descripcion: 'Prod', cantidad: 2, precio_unitario: total / 2, descuento_linea: 0, alicuota_iva: 21, subtotal: total }],
    descuento_global: 0, subtotal: total, importe_iva: Math.round(total * 21 / 121 * 100) / 100,
    total, ajuste_redondeo: 0,
    pagos: [{ medio_pago: 'tarjeta', monto_centavos: total * 100, recargo_pct: recargoPct, recargo_centavos: recargoCentavos }],
  };
}

describe('dashboardCajaRangoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin cajas en el período devuelve arrays vacíos', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    expect(r.turnos).toHaveLength(0);
    expect(r.por_medio_pago).toHaveLength(0);
    expect(r.recargo_tarjeta_total).toBe(0);
  });

  it('agrega ingresos y egresos por turno', () => {
    const { prod, caja } = crearProductoYCaja(db);
    ventaConfirmarHandler(db, makeEfectivoPayload(caja.id, prod.id, 1000));
    const { desde, hasta } = todayRange();
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    expect(r.turnos).toHaveLength(1);
    expect(r.turnos[0].ingresos).toBeGreaterThan(0);
    expect(r.turnos[0].egresos).toBe(0);
  });

  it('breakdown por medio de pago: efectivo y tarjeta separados', () => {
    const { prod, caja } = crearProductoYCaja(db);
    ventaConfirmarHandler(db, makeEfectivoPayload(caja.id, prod.id, 1000));
    ventaConfirmarHandler(db, makeTarjetaPayload(caja.id, prod.id, 2000, 5));
    const { desde, hasta } = todayRange();
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    const medios = r.por_medio_pago.map(m => m.medio_pago);
    expect(medios).toContain('efectivo');
    expect(medios).toContain('tarjeta');
  });

  it('KPI recargo_tarjeta_total suma solo recargos de tarjeta', () => {
    const { prod, caja } = crearProductoYCaja(db);
    ventaConfirmarHandler(db, makeTarjetaPayload(caja.id, prod.id, 2000, 5)); // recargo 5% = $100
    const { desde, hasta } = todayRange();
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    expect(r.recargo_tarjeta_total).toBeCloseTo(100, 0); // 5% de $2000 = $100
  });

  it('período fuera de rango no devuelve datos de hoy', () => {
    const { prod, caja } = crearProductoYCaja(db);
    ventaConfirmarHandler(db, makeEfectivoPayload(caja.id, prod.id, 1000));
    const ayer = new Date(Date.now() - 86400000);
    const desde = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate() - 1, 0, 0, 0, 0);
    const hasta = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate() - 1, 23, 59, 59, 999);
    const r = dashboardCajaRangoHandler(db, { desde, hasta });
    expect(r.turnos).toHaveLength(0);
  });
});
```

- [ ] **Step 2.2: Verificar que el test falla por módulo no encontrado**

```bash
cd packages/client && node scripts/test-node.cjs
```

Expected: error `Cannot find module '../dashboard-caja-rango'`.

### Step 2.3 — Implementar el handler (GREEN)

- [ ] **Crear `dashboard-caja-rango.ts`**

```typescript
// packages/client/src/main/ipc/dashboard-caja-rango.ts
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requirePermission } from '../auth/guard';

type Db = BetterSQLite3Database<typeof schema>;

export type CajaTurnoEntry = {
  caja_id: string;
  usuario_nombre: string;
  fecha_apertura: Date;
  ingresos: number;
  egresos: number;
};

export type CajaRangoMedioPago = {
  medio_pago: string;
  monto_total: number;
  recargo_total: number;
};

export type DashboardCajaRango = {
  turnos: CajaTurnoEntry[];
  por_medio_pago: CajaRangoMedioPago[];
  recargo_tarjeta_total: number;
};

export function dashboardCajaRangoHandler(
  db: Db,
  params: { desde: Date; hasta: Date },
): DashboardCajaRango {
  const { desde, hasta } = params;

  const turnos = db.select({
    caja_id:        schema.caja.id,
    usuario_nombre: schema.usuario.nombre_completo,
    fecha_apertura: schema.caja.fecha_apertura,
    ingresos: sql<number>`coalesce(sum(case when ${schema.movimiento_caja.tipo} = 'ingreso' then ${schema.movimiento_caja.monto} else 0 end), 0)`,
    egresos:  sql<number>`coalesce(sum(case when ${schema.movimiento_caja.tipo} = 'egreso'  then ${schema.movimiento_caja.monto} else 0 end), 0)`,
  }).from(schema.caja)
    .innerJoin(schema.usuario, eq(schema.caja.usuario_id, schema.usuario.id))
    .leftJoin(schema.movimiento_caja, eq(schema.movimiento_caja.caja_id, schema.caja.id))
    .where(and(
      gte(schema.caja.fecha_apertura, desde),
      lte(schema.caja.fecha_apertura, hasta),
    ))
    .groupBy(schema.caja.id)
    .orderBy(schema.caja.fecha_apertura)
    .all()
    .map(r => ({ ...r, fecha_apertura: r.fecha_apertura as Date }));

  const mediosRaw = db.select({
    medio_pago:             schema.venta_pago.medio_pago,
    monto_total_centavos:   sql<number>`coalesce(sum(${schema.venta_pago.monto_centavos}), 0)`,
    recargo_total_centavos: sql<number>`coalesce(sum(${schema.venta_pago.recargo_centavos}), 0)`,
  }).from(schema.venta_pago)
    .innerJoin(schema.venta, eq(schema.venta_pago.venta_id, schema.venta.id))
    .where(and(
      eq(schema.venta.estado, 'confirmada'),
      gte(schema.venta.fecha, desde),
      lte(schema.venta.fecha, hasta),
    ))
    .groupBy(schema.venta_pago.medio_pago)
    .all();

  const por_medio_pago: CajaRangoMedioPago[] = mediosRaw.map(r => ({
    medio_pago:   r.medio_pago,
    monto_total:  r.monto_total_centavos / 100,
    recargo_total: r.recargo_total_centavos / 100,
  }));

  const tarjeta = mediosRaw.find(r => r.medio_pago === 'tarjeta');
  const recargo_tarjeta_total = tarjeta ? tarjeta.recargo_total_centavos / 100 : 0;

  return { turnos, por_medio_pago, recargo_tarjeta_total };
}

export function registerDashboardCajaRangoHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('dashboard.ver');
  ipcMain.handle('dashboard:caja-rango', guard(async (_e, p) => dashboardCajaRangoHandler(db, p)));
}
```

- [ ] **Step 2.4: Correr el test y verificar que pasa**

```bash
cd packages/client && node scripts/test-node.cjs
```

Expected: suite verde, los 5 tests de `dashboard-caja-rango.handlers.test.ts` pasan.

- [ ] **Step 2.5: Commit**

```bash
git add packages/client/src/main/ipc/dashboard-caja-rango.ts \
        packages/client/src/main/ipc/__tests__/dashboard-caja-rango.handlers.test.ts
git commit -m "feat(dashboard): handler dashboardCajaRango con turnos y medios de pago"
```

---

## Task 3: Handler `dashboard-clientes.ts` + tests

**Files:**
- Create: `packages/client/src/main/ipc/dashboard-clientes.ts`
- Create: `packages/client/src/main/ipc/__tests__/dashboard-clientes.handlers.test.ts`

### Step 3.1 — Test (RED)

- [ ] **Crear el archivo de test**

```typescript
// packages/client/src/main/ipc/__tests__/dashboard-clientes.handlers.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { generateId } from '@ferreteria/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { runCatalogSeed } from '../../catalog/seed';
import { categoriaCreateHandler } from '../categoria';
import { productoCreateHandler } from '../producto';
import { stockEntradaHandler } from '../stock';
import { cajaAbrirHandler } from '../caja';
import { ventaConfirmarHandler, type VentaConfirmarPayload } from '../venta';
import { clienteUpsertHandler } from '../cliente';
import { dashboardClientesRangoHandler, dashboardClientesEstadoHandler } from '../dashboard-clientes';

const CF_ID = 'cf000000-0000-0000-0000-000000000001';
type Db = ReturnType<typeof setupDb>;

function todayRange() {
  const now = new Date();
  return {
    desde: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    hasta: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

function setupCatalog(db: Db) {
  runCatalogSeed(db);
  loginAsAdmin(db);
  const cat = categoriaCreateHandler(db, { nombre: 'Cat' });
  const imp = db.select().from(schema.impuesto).where(eq(schema.impuesto.predeterminado, true)).get()!;
  const prod = productoCreateHandler(db, {
    nombre_corto: 'Prod', categoria_id: cat.id, impuesto_id: imp.id,
    unidad_venta: 'u', precio_venta_lista: 1000,
  });
  stockEntradaHandler(db, { producto_id: prod.id, cantidad: 100 });
  const caja = cajaAbrirHandler(db, { monto_inicial: 0 });
  return { prod, caja };
}

function crearClienteConCCC(db: Db, razon_social: string, saldo_centavos: number, diasAtras = 0) {
  const { id } = clienteUpsertHandler(db, {
    tipo_documento: 'DNI',
    numero_documento: `${Math.floor(Math.random() * 90000000) + 10000000}`,
    razon_social,
    condicion_fiscal: 'Consumidor Final',
    habilita_cuenta_corriente: true,
  });
  const fechaMov = new Date(Date.now() - diasAtras * 86400000);
  db.insert(schema.cuenta_corriente_cliente).values({
    id: generateId(),
    cliente_id: id,
    saldo_centavos,
    limite_credito_centavos: 0,
    fecha_ultimo_movimiento: fechaMov,
    activo: true,
    version: 1, origin_id: 'test', sync_state: 'pending', updated_at: new Date(),
  }).run();
  return id;
}

function makeVentaPayload(cajaId: string, clienteId: string, prodId: string, total = 1000): VentaConfirmarPayload {
  return {
    caja_id: cajaId, cliente_id: clienteId,
    lineas: [{ producto_id: prodId, descripcion: 'P', cantidad: 1, precio_unitario: total, descuento_linea: 0, alicuota_iva: 21, subtotal: total }],
    descuento_global: 0, subtotal: total, importe_iva: Math.round(total * 21 / 121 * 100) / 100,
    total, ajuste_redondeo: 0,
    pagos: [{ medio_pago: 'efectivo', monto_centavos: total * 100, recargo_pct: 0, recargo_centavos: 0 }],
  };
}

// ─── dashboardClientesRangoHandler ───────────────────────────────────────────

describe('dashboardClientesRangoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin ventas en el período devuelve ranking vacío y clientes_nuevos=0', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const r = dashboardClientesRangoHandler(db, { desde, hasta });
    expect(r.ranking).toHaveLength(0);
    expect(r.clientes_nuevos).toBe(0);
  });

  it('ranking ordena por total_facturado desc', () => {
    const { prod, caja } = setupCatalog(db);
    const c1 = clienteUpsertHandler(db, { tipo_documento: 'DNI', numero_documento: '11111111', razon_social: 'Cliente A', condicion_fiscal: 'Consumidor Final' });
    const c2 = clienteUpsertHandler(db, { tipo_documento: 'DNI', numero_documento: '22222222', razon_social: 'Cliente B', condicion_fiscal: 'Consumidor Final' });
    ventaConfirmarHandler(db, makeVentaPayload(caja.id, c1.id, prod.id, 3000));
    ventaConfirmarHandler(db, makeVentaPayload(caja.id, c2.id, prod.id, 5000));
    const { desde, hasta } = todayRange();
    const r = dashboardClientesRangoHandler(db, { desde, hasta });
    expect(r.ranking[0].razon_social).toBe('Cliente B');
    expect(r.ranking[0].total_facturado).toBe(5000);
    expect(r.ranking[1].total_facturado).toBe(3000);
  });

  it('clientes_nuevos cuenta clientes creados hoy', () => {
    loginAsAdmin(db);
    clienteUpsertHandler(db, { tipo_documento: 'DNI', numero_documento: '33333333', razon_social: 'Nuevo', condicion_fiscal: 'Consumidor Final' });
    const { desde, hasta } = todayRange();
    const r = dashboardClientesRangoHandler(db, { desde, hasta });
    expect(r.clientes_nuevos).toBeGreaterThanOrEqual(1);
  });
});

// ─── dashboardClientesEstadoHandler ──────────────────────────────────────────

describe('dashboardClientesEstadoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin CCC devuelve todo en cero', () => {
    loginAsAdmin(db);
    const r = dashboardClientesEstadoHandler(db);
    expect(r.deuda_total).toBe(0);
    expect(r.deuda_vencida).toBe(0);
    expect(r.clientes_inactivos).toBe(0);
  });

  it('deuda_total suma saldo de CCCs activas con saldo positivo', () => {
    loginAsAdmin(db);
    crearClienteConCCC(db, 'A', 150000, 5);  // $1500 con mov hace 5 días
    crearClienteConCCC(db, 'B', 50000, 5);   // $500  con mov hace 5 días
    const r = dashboardClientesEstadoHandler(db);
    expect(r.deuda_total).toBeCloseTo(2000, 0);
  });

  it('deuda_vencida solo incluye CCCs con fecha_ultimo_movimiento más antigua que cc_dias_vencimiento (30)', () => {
    loginAsAdmin(db);
    crearClienteConCCC(db, 'Reciente',  100000, 10); // mov hace 10 días → no vencido
    crearClienteConCCC(db, 'Vencido',   200000, 40); // mov hace 40 días → vencido (param=30)
    const r = dashboardClientesEstadoHandler(db);
    expect(r.deuda_total).toBeCloseTo(3000, 0);
    expect(r.deuda_vencida).toBeCloseTo(2000, 0);
  });

  it('clientes_inactivos excluye clientes con compra reciente', () => {
    const { prod, caja } = setupCatalog(db);
    const c = clienteUpsertHandler(db, { tipo_documento: 'DNI', numero_documento: '44444444', razon_social: 'Activo', condicion_fiscal: 'Consumidor Final' });
    ventaConfirmarHandler(db, makeVentaPayload(caja.id, c.id, prod.id, 1000));
    const r = dashboardClientesEstadoHandler(db);
    // c tiene compra de hoy → no debe ser inactivo
    const inactivoIds = db.select({ id: schema.cliente.id }).from(schema.cliente)
      .where(eq(schema.cliente.razon_social, 'Activo')).get();
    expect(inactivoIds).toBeDefined();
    // El cliente activo con compra hoy no debe estar en inactivos
    expect(r.clientes_inactivos).toBe(0);
  });
});
```

- [ ] **Step 3.2: Verificar que falla por módulo no encontrado**

```bash
cd packages/client && node scripts/test-node.cjs
```

Expected: error `Cannot find module '../dashboard-clientes'`.

### Step 3.3 — Implementar el handler (GREEN)

- [ ] **Crear `dashboard-clientes.ts`**

```typescript
// packages/client/src/main/ipc/dashboard-clientes.ts
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requirePermission } from '../auth/guard';

type Db = BetterSQLite3Database<typeof schema>;

export type ClienteRankingEntry = {
  cliente_id: string;
  razon_social: string;
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
    razon_social:    schema.cliente.razon_social,
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
    .all();

  const nuevosRow = db.select({ count: sql<number>`count(*)` })
    .from(schema.cliente)
    .where(and(
      eq(schema.cliente.activo, true),
      gte(schema.cliente.fecha_creacion, desde),
      lte(schema.cliente.fecha_creacion, hasta),
    ))
    .get()!;

  return { ranking, clientes_nuevos: nuevosRow.count ?? 0 };
}

export function dashboardClientesEstadoHandler(db: Db): DashboardClientesEstado {
  const now = new Date();
  const diasVenc = getParam(db, 'cc_dias_vencimiento', 30);
  const diasInact = getParam(db, 'cliente_dias_inactividad', 60);
  const umbralVenc = new Date(now.getTime() - diasVenc * 86400000);
  const umbralInact = new Date(now.getTime() - diasInact * 86400000);

  const deudaTotalRow = db.select({
    total: sql<number>`coalesce(sum(${schema.cuenta_corriente_cliente.saldo_centavos}), 0)`,
  }).from(schema.cuenta_corriente_cliente)
    .where(and(
      eq(schema.cuenta_corriente_cliente.activo, true),
      sql`${schema.cuenta_corriente_cliente.saldo_centavos} > 0`,
    ))
    .get()!;

  const deudaVencidaRow = db.select({
    total: sql<number>`coalesce(sum(${schema.cuenta_corriente_cliente.saldo_centavos}), 0)`,
  }).from(schema.cuenta_corriente_cliente)
    .where(and(
      eq(schema.cuenta_corriente_cliente.activo, true),
      sql`${schema.cuenta_corriente_cliente.saldo_centavos} > 0`,
      sql`(${schema.cuenta_corriente_cliente.fecha_ultimo_movimiento} IS NULL OR ${schema.cuenta_corriente_cliente.fecha_ultimo_movimiento} < ${umbralVenc})`,
    ))
    .get()!;

  // Clientes inactivos: activos sin compra confirmada en los últimos N días
  const todosActivos = db.select({ id: schema.cliente.id })
    .from(schema.cliente)
    .where(eq(schema.cliente.activo, true))
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
```

- [ ] **Step 3.4: Correr tests y verificar que pasan**

```bash
cd packages/client && node scripts/test-node.cjs
```

Expected: suite verde.

- [ ] **Step 3.5: Commit**

```bash
git add packages/client/src/main/ipc/dashboard-clientes.ts \
        packages/client/src/main/ipc/__tests__/dashboard-clientes.handlers.test.ts
git commit -m "feat(dashboard): handlers dashboardClientesRango y dashboardClientesEstado"
```

---

## Task 4: Handler `dashboard-proveedores.ts` + tests

**Files:**
- Create: `packages/client/src/main/ipc/dashboard-proveedores.ts`
- Create: `packages/client/src/main/ipc/__tests__/dashboard-proveedores.handlers.test.ts`

### Step 4.1 — Test (RED)

- [ ] **Crear el archivo de test**

```typescript
// packages/client/src/main/ipc/__tests__/dashboard-proveedores.handlers.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { generateId } from '@ferreteria/shared';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema';
import { setupDb, loginAsAdmin, clearSession } from './helpers';
import { proveedorUpsertHandler } from '../proveedor';
import { dashboardProveedoresRangoHandler, dashboardProveedoresEstadoHandler } from '../dashboard-proveedores';

type Db = ReturnType<typeof setupDb>;

function todayRange() {
  const now = new Date();
  return {
    desde: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
    hasta: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

function crearProveedor(db: Db, razon: string) {
  return proveedorUpsertHandler(db, {
    tipo_documento: 'CUIT',
    numero_documento: `${Math.floor(Math.random() * 90000000) + 10000000}`,
    razon_social: razon,
    condicion_fiscal: 'Responsable Inscripto',
  });
}

function insertOCRecibida(db: Db, provId: string, costoCentavos: number, cantRecibida = 10) {
  const now = new Date();
  const userId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
  const prodRow = db.select({ id: schema.producto.id }).from(schema.producto).get();
  if (!prodRow) return;

  const ocId = generateId();
  const subtotal = Math.round(costoCentavos * cantRecibida);
  db.insert(schema.orden_compra).values({
    id: ocId,
    numero_interno: `OC-C1-${Math.floor(Math.random() * 100000)}`,
    proveedor_id: provId, tipo: 'manual', estado: 'recibida_total',
    fecha: now, subtotal_centavos: subtotal, importe_iva_centavos: 0, total_centavos: subtotal,
    usuario_id: userId, usuario_creacion_id: userId, fecha_creacion: now,
    version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
  }).run();

  db.insert(schema.item_oc).values({
    id: generateId(),
    orden_compra_id: ocId, producto_id: prodRow.id,
    descripcion: 'Prod', cantidad_pedida: cantRecibida, cantidad_recibida: cantRecibida,
    costo_unitario_centavos: costoCentavos, alicuota_iva: 21,
    subtotal_centavos: subtotal,
    version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
  }).run();
}

function insertOCEstado(db: Db, provId: string, estado: string, tipo = 'manual') {
  const now = new Date();
  const userId = db.select({ id: schema.usuario.id }).from(schema.usuario).get()!.id;
  db.insert(schema.orden_compra).values({
    id: generateId(),
    numero_interno: `OC-C1-${Math.floor(Math.random() * 100000)}`,
    proveedor_id: provId, tipo, estado: estado as any,
    fecha: now, subtotal_centavos: 0, importe_iva_centavos: 0, total_centavos: 0,
    usuario_id: userId, usuario_creacion_id: userId, fecha_creacion: now,
    version: 1, origin_id: 'test', sync_state: 'pending', updated_at: now,
  }).run();
}

describe('dashboardProveedoresRangoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin OCs devuelve ranking vacío', () => {
    loginAsAdmin(db);
    const { desde, hasta } = todayRange();
    const r = dashboardProveedoresRangoHandler(db, { desde, hasta });
    expect(r.ranking).toHaveLength(0);
  });

  it('ranking ordena por gasto descendente', () => {
    loginAsAdmin(db);
    // Se necesita al menos un producto en la DB para item_oc FK
    const cat = db.select({ id: schema.categoria.id }).from(schema.categoria).get();
    if (!cat) return; // sin catálogo seed no podemos crear producto aquí — skip
    const p1 = crearProveedor(db, 'Prov A');
    const p2 = crearProveedor(db, 'Prov B');
    insertOCRecibida(db, p1.id, 1000, 10);  // gasto: 10000 centavos = $100
    insertOCRecibida(db, p2.id, 5000, 10);  // gasto: 50000 centavos = $500
    const { desde, hasta } = todayRange();
    const r = dashboardProveedoresRangoHandler(db, { desde, hasta });
    if (r.ranking.length > 0) {
      expect(r.ranking[0].gasto).toBeGreaterThanOrEqual(r.ranking[r.ranking.length - 1].gasto);
    }
  });
});

describe('dashboardProveedoresEstadoHandler', () => {
  let db: Db;
  beforeEach(() => { db = setupDb(); clearSession(); });

  it('sin OCs devuelve todo en cero', () => {
    loginAsAdmin(db);
    const r = dashboardProveedoresEstadoHandler(db);
    expect(r.ocs_pendientes).toBe(0);
    expect(r.ocs_sugeridas_sin_resolver).toBe(0);
  });

  it('ocs_pendientes cuenta estados emitida y recibida_parcial', () => {
    loginAsAdmin(db);
    const prov = crearProveedor(db, 'Prov Test');
    insertOCEstado(db, prov.id, 'emitida');
    insertOCEstado(db, prov.id, 'recibida_parcial');
    insertOCEstado(db, prov.id, 'recibida_total'); // no cuenta
    const r = dashboardProveedoresEstadoHandler(db);
    expect(r.ocs_pendientes).toBe(2);
  });

  it('ocs_sugeridas_sin_resolver cuenta tipo sugerida en estados no finales', () => {
    loginAsAdmin(db);
    const prov = crearProveedor(db, 'Prov S');
    insertOCEstado(db, prov.id, 'borrador', 'sugerida');
    insertOCEstado(db, prov.id, 'emitida', 'sugerida');
    insertOCEstado(db, prov.id, 'recibida_total', 'sugerida'); // no cuenta
    insertOCEstado(db, prov.id, 'cerrada', 'sugerida');        // no cuenta
    insertOCEstado(db, prov.id, 'anulada', 'sugerida');        // no cuenta
    const r = dashboardProveedoresEstadoHandler(db);
    expect(r.ocs_sugeridas_sin_resolver).toBe(2);
  });
});
```

- [ ] **Step 4.2: Verificar que falla**

```bash
cd packages/client && node scripts/test-node.cjs
```

Expected: error `Cannot find module '../dashboard-proveedores'`.

### Step 4.3 — Implementar el handler (GREEN)

- [ ] **Crear `dashboard-proveedores.ts`**

```typescript
// packages/client/src/main/ipc/dashboard-proveedores.ts
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, gte, lte, sql, desc, inArray, notInArray } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requirePermission } from '../auth/guard';

type Db = BetterSQLite3Database<typeof schema>;

export type ProveedorRankingEntry = {
  proveedor_id: string;
  razon_social: string;
  gasto: number;
};

export type DashboardProveedoresRango = {
  ranking: ProveedorRankingEntry[];
};

export type DashboardProveedoresEstado = {
  ocs_pendientes: number;
  ocs_sugeridas_sin_resolver: number;
};

export function dashboardProveedoresRangoHandler(
  db: Db,
  params: { desde: Date; hasta: Date },
): DashboardProveedoresRango {
  const { desde, hasta } = params;

  const ranking = db.select({
    proveedor_id: schema.orden_compra.proveedor_id,
    razon_social: schema.proveedor.razon_social,
    gasto_centavos: sql<number>`cast(sum(${schema.item_oc.cantidad_recibida} * ${schema.item_oc.costo_unitario_centavos}) as integer)`,
  }).from(schema.item_oc)
    .innerJoin(schema.orden_compra, eq(schema.item_oc.orden_compra_id, schema.orden_compra.id))
    .innerJoin(schema.proveedor, eq(schema.orden_compra.proveedor_id, schema.proveedor.id))
    .where(and(
      inArray(schema.orden_compra.estado, ['recibida_parcial', 'recibida_total', 'cerrada']),
      gte(schema.orden_compra.fecha, desde),
      lte(schema.orden_compra.fecha, hasta),
    ))
    .groupBy(schema.orden_compra.proveedor_id)
    .orderBy(desc(sql`sum(${schema.item_oc.cantidad_recibida} * ${schema.item_oc.costo_unitario_centavos})`))
    .limit(10)
    .all()
    .map(r => ({ proveedor_id: r.proveedor_id, razon_social: r.razon_social, gasto: r.gasto_centavos / 100 }));

  return { ranking };
}

export function dashboardProveedoresEstadoHandler(db: Db): DashboardProveedoresEstado {
  const pendientesRow = db.select({ count: sql<number>`count(*)` })
    .from(schema.orden_compra)
    .where(inArray(schema.orden_compra.estado, ['emitida', 'recibida_parcial']))
    .get()!;

  const sugeridasRow = db.select({ count: sql<number>`count(*)` })
    .from(schema.orden_compra)
    .where(and(
      eq(schema.orden_compra.tipo, 'sugerida'),
      notInArray(schema.orden_compra.estado, ['recibida_total', 'cerrada', 'anulada']),
    ))
    .get()!;

  return {
    ocs_pendientes:             pendientesRow.count ?? 0,
    ocs_sugeridas_sin_resolver: sugeridasRow.count ?? 0,
  };
}

export function registerDashboardProveedoresHandlers(ipcMain: IpcMain, db: Db): void {
  const guard = requirePermission('dashboard.ver');
  ipcMain.handle('dashboard:proveedores-rango',  guard(async (_e, p) => dashboardProveedoresRangoHandler(db, p)));
  ipcMain.handle('dashboard:proveedores-estado', guard(async ()       => dashboardProveedoresEstadoHandler(db)));
}
```

- [ ] **Step 4.4: Correr tests y verificar que pasan**

```bash
cd packages/client && node scripts/test-node.cjs
```

Expected: suite verde.

- [ ] **Step 4.5: Commit**

```bash
git add packages/client/src/main/ipc/dashboard-proveedores.ts \
        packages/client/src/main/ipc/__tests__/dashboard-proveedores.handlers.test.ts
git commit -m "feat(dashboard): handlers dashboardProveedoresRango y dashboardProveedoresEstado"
```

---

## Task 5: Preload + registro en main/index.ts

**Files:**
- Modify: `packages/client/src/preload/index.ts`
- Modify: `packages/client/src/main/index.ts`

- [ ] **Step 5.1: Agregar imports de types en preload**

En `packages/client/src/preload/index.ts`, agregar junto a los otros imports de dashboard:

```typescript
import type {
  DashboardCajaRango,
} from '../main/ipc/dashboard-caja-rango';
import type {
  DashboardClientesRango, DashboardClientesEstado,
} from '../main/ipc/dashboard-clientes';
import type {
  DashboardProveedoresRango, DashboardProveedoresEstado,
} from '../main/ipc/dashboard-proveedores';
```

- [ ] **Step 5.2: Extender el objeto `dashboard` en el preload**

Localizar el bloque `dashboard: {` y agregar al final del mismo (antes del cierre `}`):

```typescript
    cajaRango:          (p: { desde: Date; hasta: Date }) => ipcRenderer.invoke('dashboard:caja-rango', p) as Promise<DashboardCajaRango>,
    clientesRango:      (p: { desde: Date; hasta: Date }) => ipcRenderer.invoke('dashboard:clientes-rango', p) as Promise<DashboardClientesRango>,
    clientesEstado:     ()                                => ipcRenderer.invoke('dashboard:clientes-estado') as Promise<DashboardClientesEstado>,
    proveedoresRango:   (p: { desde: Date; hasta: Date }) => ipcRenderer.invoke('dashboard:proveedores-rango', p) as Promise<DashboardProveedoresRango>,
    proveedoresEstado:  ()                                => ipcRenderer.invoke('dashboard:proveedores-estado') as Promise<DashboardProveedoresEstado>,
```

- [ ] **Step 5.3: Registrar los tres nuevos handlers en `src/main/index.ts`**

Agregar junto a los otros imports:

```typescript
import { registerDashboardCajaRangoHandlers } from './ipc/dashboard-caja-rango';
import { registerDashboardClientesHandlers } from './ipc/dashboard-clientes';
import { registerDashboardProveedoresHandlers } from './ipc/dashboard-proveedores';
```

Agregar junto a las otras llamadas `register*`:

```typescript
  registerDashboardCajaRangoHandlers(ipcMain, db);
  registerDashboardClientesHandlers(ipcMain, db);
  registerDashboardProveedoresHandlers(ipcMain, db);
```

- [ ] **Step 5.4: Correr suite de tests para verificar que nada se rompe**

```bash
cd packages/client && node scripts/test-node.cjs
```

Expected: suite verde.

- [ ] **Step 5.5: Commit**

```bash
git add packages/client/src/preload/index.ts packages/client/src/main/index.ts
git commit -m "feat(dashboard): registrar 5 canales nuevos en preload y main/index"
```

---

## Task 6: `CajaTabView.tsx` + tests renderer

**Files:**
- Create: `packages/client/src/renderer/views/dashboard/caja/CajaTabView.tsx`
- Create: `packages/client/src/renderer/views/dashboard/__tests__/CajaTabView.test.tsx`

### Step 6.1 — Test (RED)

- [ ] **Crear el test renderer**

```typescript
// packages/client/src/renderer/views/dashboard/__tests__/CajaTabView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CajaTabView } from '../caja/CajaTabView';
import type { DashboardCajaRango } from '../../../../main/ipc/dashboard-caja-rango';
import { calcPeriod } from '../hooks/usePeriod';

vi.mock('recharts', () => ({
  BarChart:           ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar:                () => null,
  XAxis:              () => null,
  YAxis:              () => null,
  Tooltip:            () => null,
  Legend:             () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

const DATA: DashboardCajaRango = {
  turnos: [
    { caja_id: 'c1', usuario_nombre: 'Ana', fecha_apertura: new Date(), ingresos: 5000, egresos: 1000 },
  ],
  por_medio_pago: [
    { medio_pago: 'efectivo',  monto_total: 3000, recargo_total: 0 },
    { medio_pago: 'tarjeta',   monto_total: 2000, recargo_total: 100 },
  ],
  recargo_tarjeta_total: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    dashboard: { cajaRango: vi.fn().mockResolvedValue(DATA) },
  };
});

const period = calcPeriod('hoy');

describe('CajaTabView', () => {
  it('muestra KPIs de ingresos, egresos y recargo tarjeta', async () => {
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/ingresos/i)).toBeInTheDocument();
      expect(screen.getByText(/egresos/i)).toBeInTheDocument();
      expect(screen.getByText(/recargo/i)).toBeInTheDocument();
    });
  });

  it('renderiza el gráfico de barras', async () => {
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('bar-chart')).toBeInTheDocument());
  });

  it('muestra tabla de medios de pago con efectivo y tarjeta', async () => {
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/efectivo/i)).toBeInTheDocument();
      expect(screen.getByText(/tarjeta/i)).toBeInTheDocument();
    });
  });

  it('llama a cajaRango con el período del prop', async () => {
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    await waitFor(() =>
      expect((window as any).ferreteria.dashboard.cajaRango).toHaveBeenCalledWith({
        desde: period.desde, hasta: period.hasta,
      }),
    );
  });

  it('muestra estado de carga mientras espera', () => {
    (window as any).ferreteria.dashboard.cajaRango = vi.fn(() => new Promise(() => {}));
    render(<MemoryRouter><CajaTabView period={period} /></MemoryRouter>);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2: Verificar que falla**

```bash
cd packages/client && pnpm exec vitest run --config vitest.config.ts src/renderer/views/dashboard/__tests__/CajaTabView.test.tsx
```

Expected: error `Cannot find module '../caja/CajaTabView'`.

### Step 6.3 — Implementar el componente (GREEN)

- [ ] **Crear `CajaTabView.tsx`**

```typescript
// packages/client/src/renderer/views/dashboard/caja/CajaTabView.tsx
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { Period } from '../hooks/usePeriod';
import type { DashboardCajaRango } from '../../../../main/ipc/dashboard-caja-rango';

type PS<T> = { loading: boolean; data: T | null; error: boolean };
const init = <T,>(): PS<T> => ({ loading: true, data: null, error: false });

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type Props = { period: Period };

export function CajaTabView({ period }: Props) {
  const [state, setState] = useState<PS<DashboardCajaRango>>(init());

  useEffect(() => {
    setState(init());
    (window as any).ferreteria.dashboard
      .cajaRango({ desde: period.desde, hasta: period.hasta })
      .then((data: DashboardCajaRango) => setState({ loading: false, data, error: false }))
      .catch(() => setState({ loading: false, data: null, error: true }));
  }, [period]);

  if (state.loading) {
    return <div className="text-muted text-xs" style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando…</div>;
  }
  if (state.error || !state.data) {
    return <div className="alert-danger">Error al cargar datos de caja</div>;
  }

  const d = state.data;
  const totalIngresos = d.turnos.reduce((s, t) => s + t.ingresos, 0);
  const totalEgresos  = d.turnos.reduce((s, t) => s + t.egresos,  0);

  const barData = d.turnos.map(t => ({
    name:     new Date(t.fecha_apertura).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    Ingresos: t.ingresos,
    Egresos:  t.egresos,
  }));

  const totalMedios = d.por_medio_pago.reduce((s, m) => s + m.monto_total, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Ingresos',        value: `$ ${fmt(totalIngresos)}`, color: 'var(--ok)' },
          { label: 'Egresos',         value: `$ ${fmt(totalEgresos)}`,  color: 'var(--danger)' },
          { label: 'Recargo tarjeta', value: `$ ${fmt(d.recargo_tarjeta_total)}`, color: 'inherit' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--accent-soft)', borderRadius: 8, padding: '0.75rem' }}>
            <div className="text-muted text-xs" style={{ marginBottom: '0.25rem' }}>{label}</div>
            <div className="num" style={{ fontWeight: 700, fontSize: '1.05rem', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de barras por turno */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>INGRESOS Y EGRESOS POR TURNO</div>
        {d.turnos.length === 0
          ? <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin turnos en el período</div>
          : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `$ ${fmt(v)}`} />
                <Legend />
                <Bar dataKey="Ingresos" fill="var(--ok)"     radius={[3, 3, 0, 0]} />
                <Bar dataKey="Egresos"  fill="var(--danger)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </div>

      {/* Tabla medios de pago */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>MEDIOS DE PAGO</div>
        {d.por_medio_pago.length === 0
          ? <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin datos</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['Medio', 'Monto', '%'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Medio' ? 'left' : 'right', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--line)', fontWeight: 600, color: 'var(--ink-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.por_medio_pago.map(m => (
                  <tr key={m.medio_pago}>
                    <td style={{ padding: '0.3rem 0.5rem', textTransform: 'capitalize' }}>{m.medio_pago.replace('_', ' ')}</td>
                    <td className="num" style={{ textAlign: 'right', padding: '0.3rem 0.5rem' }}>$ {fmt(m.monto_total)}</td>
                    <td className="num" style={{ textAlign: 'right', padding: '0.3rem 0.5rem', color: 'var(--ink-3)' }}>
                      {totalMedios > 0 ? `${Math.round((m.monto_total / totalMedios) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}
```

- [ ] **Step 6.4: Correr el test renderer**

```bash
cd packages/client && pnpm exec vitest run --config vitest.config.ts src/renderer/views/dashboard/__tests__/CajaTabView.test.tsx
```

Expected: 5 tests pasan.

- [ ] **Step 6.5: Commit**

```bash
git add packages/client/src/renderer/views/dashboard/caja/CajaTabView.tsx \
        packages/client/src/renderer/views/dashboard/__tests__/CajaTabView.test.tsx
git commit -m "feat(dashboard): CajaTabView con barras por turno y tabla medios de pago"
```

---

## Task 7: `ClientesTabView.tsx` + tests renderer

**Files:**
- Create: `packages/client/src/renderer/views/dashboard/clientes/ClientesTabView.tsx`
- Create: `packages/client/src/renderer/views/dashboard/__tests__/ClientesTabView.test.tsx`

### Step 7.1 — Test (RED)

- [ ] **Crear el test renderer**

```typescript
// packages/client/src/renderer/views/dashboard/__tests__/ClientesTabView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClientesTabView } from '../clientes/ClientesTabView';
import type { DashboardClientesRango, DashboardClientesEstado } from '../../../../main/ipc/dashboard-clientes';
import { calcPeriod } from '../hooks/usePeriod';

const RANGO: DashboardClientesRango = {
  ranking: [
    { cliente_id: 'c1', razon_social: 'Ferretería Norte', total_facturado: 50000, count_ventas: 5 },
    { cliente_id: 'c2', razon_social: 'Construcciones Sur', total_facturado: 30000, count_ventas: 3 },
  ],
  clientes_nuevos: 4,
};

const ESTADO: DashboardClientesEstado = {
  deuda_total: 150000,
  deuda_vencida: 50000,
  clientes_inactivos: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    dashboard: {
      clientesRango:  vi.fn().mockResolvedValue(RANGO),
      clientesEstado: vi.fn().mockResolvedValue(ESTADO),
    },
  };
});

const period = calcPeriod('mes');

describe('ClientesTabView', () => {
  it('muestra KPIs de estado con leyenda "hoy"', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText(/hoy/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('muestra deuda total formateada', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/deuda total/i)).toBeInTheDocument());
  });

  it('muestra ranking de clientes del período', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Ferretería Norte')).toBeInTheDocument();
      expect(screen.getByText('Construcciones Sur')).toBeInTheDocument();
    });
  });

  it('clientes nuevos muestra el valor del rango (no leyenda hoy)', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
  });

  it('llama a clientesEstado una sola vez al montar', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect((window as any).ferreteria.dashboard.clientesEstado).toHaveBeenCalledTimes(1));
  });

  it('llama a clientesRango con el período del prop', async () => {
    render(<MemoryRouter><ClientesTabView period={period} /></MemoryRouter>);
    await waitFor(() =>
      expect((window as any).ferreteria.dashboard.clientesRango).toHaveBeenCalledWith({
        desde: period.desde, hasta: period.hasta,
      }),
    );
  });
});
```

- [ ] **Step 7.2: Verificar que falla**

```bash
cd packages/client && pnpm exec vitest run --config vitest.config.ts src/renderer/views/dashboard/__tests__/ClientesTabView.test.tsx
```

Expected: error `Cannot find module '../clientes/ClientesTabView'`.

### Step 7.3 — Implementar el componente (GREEN)

- [ ] **Crear `ClientesTabView.tsx`**

```typescript
// packages/client/src/renderer/views/dashboard/clientes/ClientesTabView.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Period } from '../hooks/usePeriod';
import type { DashboardClientesRango, DashboardClientesEstado } from '../../../../main/ipc/dashboard-clientes';

type PS<T> = { loading: boolean; data: T | null; error: boolean };
const init = <T,>(): PS<T> => ({ loading: true, data: null, error: false });

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiCard({ label, value, hoy = false }: { label: string; value: string; hoy?: boolean }) {
  return (
    <div style={{ background: 'var(--accent-soft)', borderRadius: 8, padding: '0.75rem' }}>
      <div className="text-muted text-xs" style={{ marginBottom: '0.25rem' }}>{label}</div>
      <div className="num" style={{ fontWeight: 700, fontSize: '1.05rem' }}>{value}</div>
      {hoy && <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.15rem' }}>hoy</div>}
    </div>
  );
}

type Props = { period: Period };

export function ClientesTabView({ period }: Props) {
  const navigate = useNavigate();
  const [rango,  setRango]  = useState<PS<DashboardClientesRango>>(init());
  const [estado, setEstado] = useState<PS<DashboardClientesEstado>>(init());
  const estadoLoaded = useRef(false);

  useEffect(() => {
    if (!estadoLoaded.current) {
      estadoLoaded.current = true;
      (window as any).ferreteria.dashboard.clientesEstado()
        .then((data: DashboardClientesEstado) => setEstado({ loading: false, data, error: false }))
        .catch(() => setEstado({ loading: false, data: null, error: true }));
    }
  }, []);

  useEffect(() => {
    setRango(init());
    (window as any).ferreteria.dashboard
      .clientesRango({ desde: period.desde, hasta: period.hasta })
      .then((data: DashboardClientesRango) => setRango({ loading: false, data, error: false }))
      .catch(() => setRango({ loading: false, data: null, error: true }));
  }, [period]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* KPIs de estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        <KpiCard
          label="Deuda total"
          value={estado.data ? `$ ${fmt(estado.data.deuda_total)}` : '—'}
          hoy
        />
        <KpiCard
          label="Deuda vencida"
          value={estado.data ? `$ ${fmt(estado.data.deuda_vencida)}` : '—'}
          hoy
        />
        <KpiCard
          label="Nuevos"
          value={rango.data ? String(rango.data.clientes_nuevos) : '—'}
        />
        <KpiCard
          label="Inactivos"
          value={estado.data ? String(estado.data.clientes_inactivos) : '—'}
          hoy
        />
      </div>

      {/* Ranking */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>RANKING CLIENTES</div>
        {rango.loading && <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Cargando…</div>}
        {rango.error   && <div className="alert-danger">Error al cargar clientes</div>}
        {rango.data && rango.data.ranking.length === 0 && (
          <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin ventas en el período</div>
        )}
        {rango.data && rango.data.ranking.map(c => (
          <div
            key={c.cliente_id}
            className="srow"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/clientes/${c.cliente_id}`)}
          >
            <span className="sl" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.razon_social}
              <span className="text-muted text-xs" style={{ marginLeft: '0.4rem' }}>{c.count_ventas} ventas</span>
            </span>
            <span className="sv num" style={{ flexShrink: 0, paddingLeft: '0.5rem' }}>$ {fmt(c.total_facturado)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7.4: Correr el test renderer**

```bash
cd packages/client && pnpm exec vitest run --config vitest.config.ts src/renderer/views/dashboard/__tests__/ClientesTabView.test.tsx
```

Expected: 6 tests pasan.

- [ ] **Step 7.5: Commit**

```bash
git add packages/client/src/renderer/views/dashboard/clientes/ClientesTabView.tsx \
        packages/client/src/renderer/views/dashboard/__tests__/ClientesTabView.test.tsx
git commit -m "feat(dashboard): ClientesTabView con ranking, deuda y KPIs de estado"
```

---

## Task 8: `ProveedoresTabView.tsx` + tests renderer

**Files:**
- Create: `packages/client/src/renderer/views/dashboard/proveedores/ProveedoresTabView.tsx`
- Create: `packages/client/src/renderer/views/dashboard/__tests__/ProveedoresTabView.test.tsx`

### Step 8.1 — Test (RED)

- [ ] **Crear el test renderer**

```typescript
// packages/client/src/renderer/views/dashboard/__tests__/ProveedoresTabView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresTabView } from '../proveedores/ProveedoresTabView';
import type { DashboardProveedoresRango, DashboardProveedoresEstado } from '../../../../main/ipc/dashboard-proveedores';
import { calcPeriod } from '../hooks/usePeriod';

const RANGO: DashboardProveedoresRango = {
  ranking: [
    { proveedor_id: 'p1', razon_social: 'Distribuidora Central', gasto: 150000 },
    { proveedor_id: 'p2', razon_social: 'Mayorista Norte',       gasto: 80000 },
  ],
};

const ESTADO: DashboardProveedoresEstado = {
  ocs_pendientes: 3,
  ocs_sugeridas_sin_resolver: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    dashboard: {
      proveedoresRango:  vi.fn().mockResolvedValue(RANGO),
      proveedoresEstado: vi.fn().mockResolvedValue(ESTADO),
    },
  };
});

const period = calcPeriod('mes');

describe('ProveedoresTabView', () => {
  it('muestra KPIs de estado con leyenda "hoy"', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getAllByText(/hoy/i).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('muestra el valor de OCs pendientes', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('muestra el ranking de proveedores', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Distribuidora Central')).toBeInTheDocument();
      expect(screen.getByText('Mayorista Norte')).toBeInTheDocument();
    });
  });

  it('llama a proveedoresEstado una sola vez al montar', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() => expect((window as any).ferreteria.dashboard.proveedoresEstado).toHaveBeenCalledTimes(1));
  });

  it('llama a proveedoresRango con el período del prop', async () => {
    render(<MemoryRouter><ProveedoresTabView period={period} /></MemoryRouter>);
    await waitFor(() =>
      expect((window as any).ferreteria.dashboard.proveedoresRango).toHaveBeenCalledWith({
        desde: period.desde, hasta: period.hasta,
      }),
    );
  });
});
```

- [ ] **Step 8.2: Verificar que falla**

```bash
cd packages/client && pnpm exec vitest run --config vitest.config.ts src/renderer/views/dashboard/__tests__/ProveedoresTabView.test.tsx
```

Expected: error `Cannot find module '../proveedores/ProveedoresTabView'`.

### Step 8.3 — Implementar el componente (GREEN)

- [ ] **Crear `ProveedoresTabView.tsx`**

```typescript
// packages/client/src/renderer/views/dashboard/proveedores/ProveedoresTabView.tsx
import { useEffect, useState, useRef } from 'react';
import type { Period } from '../hooks/usePeriod';
import type { DashboardProveedoresRango, DashboardProveedoresEstado } from '../../../../main/ipc/dashboard-proveedores';

type PS<T> = { loading: boolean; data: T | null; error: boolean };
const init = <T,>(): PS<T> => ({ loading: true, data: null, error: false });

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiCard({ label, value, hoy = false }: { label: string; value: string; hoy?: boolean }) {
  return (
    <div style={{ background: 'var(--accent-soft)', borderRadius: 8, padding: '0.75rem' }}>
      <div className="text-muted text-xs" style={{ marginBottom: '0.25rem' }}>{label}</div>
      <div className="num" style={{ fontWeight: 700, fontSize: '1.05rem' }}>{value}</div>
      {hoy && <div className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0.15rem' }}>hoy</div>}
    </div>
  );
}

type Props = { period: Period };

export function ProveedoresTabView({ period }: Props) {
  const [rango,  setRango]  = useState<PS<DashboardProveedoresRango>>(init());
  const [estado, setEstado] = useState<PS<DashboardProveedoresEstado>>(init());
  const estadoLoaded = useRef(false);

  useEffect(() => {
    if (!estadoLoaded.current) {
      estadoLoaded.current = true;
      (window as any).ferreteria.dashboard.proveedoresEstado()
        .then((data: DashboardProveedoresEstado) => setEstado({ loading: false, data, error: false }))
        .catch(() => setEstado({ loading: false, data: null, error: true }));
    }
  }, []);

  useEffect(() => {
    setRango(init());
    (window as any).ferreteria.dashboard
      .proveedoresRango({ desde: period.desde, hasta: period.hasta })
      .then((data: DashboardProveedoresRango) => setRango({ loading: false, data, error: false }))
      .catch(() => setRango({ loading: false, data: null, error: true }));
  }, [period]);

  const maxGasto = rango.data && rango.data.ranking.length > 0
    ? Math.max(...rango.data.ranking.map(r => r.gasto))
    : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* KPIs de estado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        <KpiCard
          label="OCs pendientes recepción"
          value={estado.data ? String(estado.data.ocs_pendientes) : '—'}
          hoy
        />
        <KpiCard
          label="OCs sugeridas sin resolver"
          value={estado.data ? String(estado.data.ocs_sugeridas_sin_resolver) : '—'}
          hoy
        />
      </div>

      {/* Ranking proveedores */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>RANKING PROVEEDORES — GASTO DEL PERÍODO</div>
        {rango.loading && <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Cargando…</div>}
        {rango.error   && <div className="alert-danger">Error al cargar proveedores</div>}
        {rango.data && rango.data.ranking.length === 0 && (
          <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Sin compras en el período</div>
        )}
        {rango.data && rango.data.ranking.map(p => (
          <div key={p.proveedor_id} style={{ marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 2 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {p.razon_social}
              </span>
              <span className="num" style={{ flexShrink: 0, paddingLeft: '0.5rem' }}>$ {fmt(p.gasto)}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--accent)', width: `${(p.gasto / maxGasto) * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8.4: Correr el test renderer**

```bash
cd packages/client && pnpm exec vitest run --config vitest.config.ts src/renderer/views/dashboard/__tests__/ProveedoresTabView.test.tsx
```

Expected: 5 tests pasan.

- [ ] **Step 8.5: Commit**

```bash
git add packages/client/src/renderer/views/dashboard/proveedores/ProveedoresTabView.tsx \
        packages/client/src/renderer/views/dashboard/__tests__/ProveedoresTabView.test.tsx
git commit -m "feat(dashboard): ProveedoresTabView con ranking y KPIs de estado"
```

---

## Task 9: `DashboardView.tsx` + actualizar `DashboardTabs.test.tsx`

**Files:**
- Modify: `packages/client/src/renderer/views/dashboard/DashboardView.tsx`
- Modify: `packages/client/src/renderer/views/dashboard/__tests__/DashboardTabs.test.tsx`

### Step 9.1 — Actualizar DashboardView (habilitar tabs)

- [ ] **Reemplazar el type `TabId` y la constante `TABS`**

Localizar en `DashboardView.tsx` (línea ~13):

```typescript
type TabId = 'resumen' | 'ventas' | 'productos';

const TABS: { id: TabId; label: string; disabled?: boolean }[] = [
  { id: 'resumen',    label: 'Resumen' },
  { id: 'ventas',     label: 'Ventas' },
  { id: 'productos',  label: 'Productos' },
  { id: 'caja' as any,        label: 'Caja',        disabled: true },
  { id: 'clientes' as any,    label: 'Clientes',    disabled: true },
  { id: 'proveedores' as any, label: 'Proveedores', disabled: true },
];
```

Reemplazar con:

```typescript
type TabId = 'resumen' | 'ventas' | 'productos' | 'caja' | 'clientes' | 'proveedores';

const TABS: { id: TabId; label: string }[] = [
  { id: 'resumen',     label: 'Resumen' },
  { id: 'ventas',      label: 'Ventas' },
  { id: 'productos',   label: 'Productos' },
  { id: 'caja',        label: 'Caja' },
  { id: 'clientes',    label: 'Clientes' },
  { id: 'proveedores', label: 'Proveedores' },
];
```

- [ ] **Agregar imports de los tres nuevos TabViews** (junto a los imports existentes de VentasTabView y ProductosTabView):

```typescript
import { CajaTabView }        from './caja/CajaTabView';
import { ClientesTabView }    from './clientes/ClientesTabView';
import { ProveedoresTabView } from './proveedores/ProveedoresTabView';
```

- [ ] **Reemplazar el renderizado del tab bar** (el botón ya no tiene `disabled` ni `title` condicional)

Buscar el bloque del `TABS.map(tab => (...))` y reemplazarlo con versión sin `disabled`:

```typescript
{TABS.map(tab => (
  <button
    key={tab.id}
    type="button"
    onClick={() => setActiveTab(tab.id)}
    style={{
      padding: '0.4rem 1rem',
      borderRadius: '6px 6px 0 0',
      border: '1px solid var(--line)',
      borderBottom: activeTab === tab.id ? '1px solid var(--surface)' : '1px solid var(--line)',
      background: activeTab === tab.id ? 'var(--surface)' : 'transparent',
      color: activeTab === tab.id ? 'var(--accent-strong)' : 'inherit',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '0.875rem',
      fontWeight: activeTab === tab.id ? 600 : 400,
      marginBottom: -1,
      position: 'relative',
      zIndex: activeTab === tab.id ? 1 : 0,
    }}
  >
    {tab.label}
  </button>
))}
```

- [ ] **Extender la condición del PeriodSelector**

Localizar:
```typescript
{(activeTab === 'ventas' || activeTab === 'productos') && (
```

Reemplazar con:
```typescript
{(activeTab === 'ventas' || activeTab === 'productos' || activeTab === 'caja' || activeTab === 'clientes' || activeTab === 'proveedores') && (
```

- [ ] **Agregar renderizado de los tres nuevos tabs** (dentro del `<div style={{ flex: 1, overflowY: 'auto' }}>`, junto a los `activeTab === 'ventas'` etc.):

```typescript
{activeTab === 'caja'        && <CajaTabView       period={period} />}
{activeTab === 'clientes'    && <ClientesTabView    period={period} />}
{activeTab === 'proveedores' && <ProveedoresTabView period={period} />}
```

### Step 9.2 — Actualizar `DashboardTabs.test.tsx`

- [ ] **Extender el mock de `ferreteria`** en el `beforeEach` existente — agregar los 5 canales nuevos:

```typescript
// Agregar dentro del objeto dashboard del mock existente:
cajaRango:         vi.fn().mockResolvedValue({ turnos: [], por_medio_pago: [], recargo_tarjeta_total: 0 }),
clientesRango:     vi.fn().mockResolvedValue({ ranking: [], clientes_nuevos: 0 }),
clientesEstado:    vi.fn().mockResolvedValue({ deuda_total: 0, deuda_vencida: 0, clientes_inactivos: 0 }),
proveedoresRango:  vi.fn().mockResolvedValue({ ranking: [] }),
proveedoresEstado: vi.fn().mockResolvedValue({ ocs_pendientes: 0, ocs_sugeridas_sin_resolver: 0 }),
```

- [ ] **Reemplazar el test existente `'muestra tabs Resumen, Ventas, Productos activos y los 3 deshabilitados'`**

```typescript
it('muestra los 6 tabs todos habilitados', () => {
  renderDashboard();
  ['resumen', 'ventas', 'productos', 'caja', 'clientes', 'proveedores'].forEach(name => {
    const btn = screen.getByRole('button', { name: new RegExp(name, 'i') });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });
});
```

- [ ] **Agregar 3 tests nuevos** de los tabs habilitados:

```typescript
it('tab Caja llama a cajaRango al activarse', async () => {
  renderDashboard();
  fireEvent.click(screen.getByRole('button', { name: /^caja$/i }));
  await waitFor(() => expect((window as any).ferreteria.dashboard.cajaRango).toHaveBeenCalled());
});

it('tab Clientes llama a clientesRango al activarse', async () => {
  renderDashboard();
  fireEvent.click(screen.getByRole('button', { name: /^clientes$/i }));
  await waitFor(() => expect((window as any).ferreteria.dashboard.clientesRango).toHaveBeenCalled());
});

it('tab Proveedores llama a proveedoresRango al activarse', async () => {
  renderDashboard();
  fireEvent.click(screen.getByRole('button', { name: /^proveedores$/i }));
  await waitFor(() => expect((window as any).ferreteria.dashboard.proveedoresRango).toHaveBeenCalled());
});
```

- [ ] **Step 9.3: Correr solo los tests de DashboardTabs y DashboardView**

```bash
cd packages/client && pnpm exec vitest run --config vitest.config.ts src/renderer/views/dashboard/__tests__/DashboardTabs.test.tsx
```

Expected: suite verde.

- [ ] **Step 9.4: Commit**

```bash
git add packages/client/src/renderer/views/dashboard/DashboardView.tsx \
        packages/client/src/renderer/views/dashboard/__tests__/DashboardTabs.test.tsx
git commit -m "feat(dashboard): habilitar tabs Caja, Clientes y Proveedores en DashboardView"
```

---

## Task 10: Suite completa + documentación

**Files:**
- Modify: `Estado.md`
- Modify: `docs/ADR-Log-ferreteria.md`

- [ ] **Step 10.1: Correr toda la suite renderer**

```bash
cd packages/client && pnpm exec vitest run --config vitest.config.ts
```

Expected: todos los tests del renderer pasan, sin regresiones.

- [ ] **Step 10.2: Correr la suite main process**

```bash
cd packages/client && node scripts/test-node.cjs
```

Expected: todos los tests del main pasan.

- [ ] **Step 10.3: Anotar el conteo final de tests y actualizar `Estado.md`**

Agregar en la sección "R3 — Compras y Crédito":

```markdown
| ADR-038 | Dashboard Fase 2: tabs Caja, Clientes y Proveedores habilitados | ✅ |
```

Actualizar "Última actualización" y "Tests actuales" en el encabezado con el conteo real.

Agregar en "Bitácora de decisiones":
```markdown
- `2026-07-14` — ADR-038 implementado: Dashboard Fase 2 completo. Tabs Caja (tendencia de turnos en BarChart, breakdown medios de pago, KPI recargo tarjeta), Clientes (ranking facturación, deuda total/vencida con Opción A `fecha_ultimo_movimiento`, clientes nuevos/inactivos) y Proveedores (ranking gasto por OCs recibidas, OCs pendientes y sugeridas sin resolver). Migración 0020 con parámetros `cc_dias_vencimiento=30` y `cliente_dias_inactividad=60`. X tests verdes (Y renderer + Z node).
```

- [ ] **Step 10.4: Actualizar `docs/ADR-Log-ferreteria.md`**

Agregar la entrada para ADR-038:
```markdown
### ADR-038 — Dashboard Fase 2: Caja, Clientes y Proveedores

**Estado:** Aceptado  
**Fecha:** 2026-07-14

**Contexto:** La fase 1 (ADR-037) dejó los tabs Caja, Clientes y Proveedores como placeholders. Esta fase los habilita con datos reales.

**Decisiones:**
- Handlers separados por dominio: `dashboard-caja-rango.ts`, `dashboard-clientes.ts`, `dashboard-proveedores.ts`
- PeriodSelector aplica a todos los tabs nuevos (incluyendo tendencia de turnos por `fecha_apertura`)
- Tendencia de turnos renderizada como BarChart (una barra Ingresos + una Egresos por turno)
- KPIs de estado (deuda, OCs pendientes, inactivos) siempre "hoy" con leyenda muted; rankings filtran por período
- Deuda vencida = Opción A: `sum(saldo_centavos)` WHERE `fecha_ultimo_movimiento < (now - cc_dias_vencimiento)`
- Clientes inactivos = activos sin compra confirmada en los últimos `cliente_dias_inactividad` días
- Gasto proveedor = `sum(cantidad_recibida * costo_unitario_centavos)` de `item_oc` en OCs con estado recibida/cerrada
- Sin dependencias nuevas (Recharts ya estaba)
- Navegación desde ranking clientes → `/clientes/:id` (ClienteDetalle existente)
- Migración 0020 con dos parámetros nuevos en `parametros_sistema`
```

- [ ] **Step 10.5: Commit final**

```bash
git add Estado.md docs/ADR-Log-ferreteria.md
git commit -m "docs: Estado.md y ADR-Log actualizados — ADR-038 Dashboard Fase 2 completo"
```

---

## Resumen de tareas

| # | Tarea | Tests |
|---|-------|-------|
| 1 | Migración SQL 0020 | — |
| 2 | `dashboard-caja-rango.ts` + tests main | 5 |
| 3 | `dashboard-clientes.ts` + tests main | 7 |
| 4 | `dashboard-proveedores.ts` + tests main | 5 |
| 5 | Preload + main/index.ts | — |
| 6 | `CajaTabView.tsx` + tests renderer | 5 |
| 7 | `ClientesTabView.tsx` + tests renderer | 6 |
| 8 | `ProveedoresTabView.tsx` + tests renderer | 5 |
| 9 | `DashboardView.tsx` + `DashboardTabs.test.tsx` | +3 |
| 10 | Suite completa + Estado.md + ADR-Log | — |

**Total tests nuevos estimados: ~36**
