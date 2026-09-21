# ADR-038 — Dashboard Fase 2: Tabs Caja, Clientes y Proveedores

**Fecha:** 2026-07-14  
**Estado:** Aprobado — listo para implementación  
**Contexto:** Habilita los tres tabs que quedaron como placeholders en ADR-037 (Fase 1). Solo lectura; no toca POS, Caja, CCC ni OC.

---

## 1. Alcance

| Tab | Qué agrega |
|-----|-----------|
| Caja | Tendencia ingresos/egresos por turno (barras), breakdown medios de pago, KPI recargo tarjeta |
| Clientes | Ranking facturación del período, KPIs de deuda y actividad (snapshot hoy), clientes nuevos del período |
| Proveedores | Ranking de gasto por proveedor del período, KPIs de OCs pendientes y sugeridas sin resolver (snapshot hoy) |

**Fuera de alcance:** CCteProv (diferida ADR-019), aging real por factura, modificación de cualquier pantalla fuera de `/dashboard`.

---

## 2. Parámetros nuevos en `parametros_sistema`

Insertar en seed/migración existente (no requieren migración de schema — la tabla ya existe):

| clave | valor | tipo | descripción |
|-------|-------|------|-------------|
| `cc_dias_vencimiento` | `30` | `number` | Días desde `fecha_ultimo_movimiento` para considerar deuda de CCC como vencida |
| `cliente_dias_inactividad` | `60` | `number` | Días sin ventas confirmadas para clasificar cliente como inactivo |

**Gate cumplido:** confirmados por el usuario.

---

## 3. Arquitectura de handlers IPC

### Opción elegida: Opción A — tres archivos separados

Un archivo por tab. Cada archivo exporta sus types, handlers puros y `register*Handlers`.

```
src/main/ipc/
  dashboard-caja-rango.ts      ← nuevo
  dashboard-clientes.ts        ← nuevo
  dashboard-proveedores.ts     ← nuevo
```

Los handlers puros reciben `(db, params)` sin efectos laterales — igual que los handlers de `dashboard-rango.ts`.

### Canales IPC nuevos

Todos bajo permiso `dashboard.ver` (guard ya existente).

| Canal | Params | Handler |
|-------|--------|---------|
| `dashboard:caja-rango` | `{ desde, hasta }` | `dashboardCajaRangoHandler` |
| `dashboard:clientes-rango` | `{ desde, hasta }` | `dashboardClientesRangoHandler` |
| `dashboard:clientes-estado` | — | `dashboardClientesEstadoHandler` |
| `dashboard:proveedores-rango` | `{ desde, hasta }` | `dashboardProveedoresRangoHandler` |
| `dashboard:proveedores-estado` | — | `dashboardProveedoresEstadoHandler` |

### Preload

Se agregan 5 entradas bajo `window.ferreteria.dashboard` en `src/preload/index.ts`:

```typescript
cajaRango:           (p) => ipcRenderer.invoke('dashboard:caja-rango', p),
clientesRango:       (p) => ipcRenderer.invoke('dashboard:clientes-rango', p),
clientesEstado:      ()  => ipcRenderer.invoke('dashboard:clientes-estado'),
proveedoresRango:    (p) => ipcRenderer.invoke('dashboard:proveedores-rango', p),
proveedoresEstado:   ()  => ipcRenderer.invoke('dashboard:proveedores-estado'),
```

---

## 4. Types y queries por handler

### 4.1 `dashboard-caja-rango.ts`

```typescript
type CajaTurnoEntry = {
  caja_id: string;
  usuario_nombre: string;
  fecha_apertura: Date;
  ingresos: number;   // sum(movimiento_caja.monto) WHERE tipo='ingreso'
  egresos: number;    // sum(movimiento_caja.monto) WHERE tipo='egreso'
};

type CajaRangoMedioPago = {
  medio_pago: string;
  monto_total: number;    // sum(venta_pago.monto_centavos) / 100
  recargo_total: number;  // sum(venta_pago.recargo_centavos) / 100
};

type DashboardCajaRango = {
  turnos: CajaTurnoEntry[];
  por_medio_pago: CajaRangoMedioPago[];
  recargo_tarjeta_total: number;
};
```

**Queries:**
- **Turnos:** `caja JOIN usuario` donde `fecha_apertura BETWEEN desde AND hasta`, GROUP BY `caja_id`, sumar `movimiento_caja.monto` por tipo. Incluye cajas abiertas y cerradas.
- **Medios de pago:** `venta_pago JOIN venta` donde `venta.estado='confirmada'` y `venta.fecha BETWEEN desde AND hasta`, GROUP BY `medio_pago`.
- **Recargo tarjeta:** `sum(recargo_centavos)` del mismo join filtrado por `medio_pago='tarjeta'`.

### 4.2 `dashboard-clientes.ts`

```typescript
type ClienteRankingEntry = {
  cliente_id: string;
  razon_social: string;
  total_facturado: number;
  count_ventas: number;
};

type DashboardClientesRango = {
  ranking: ClienteRankingEntry[];  // top 10
  clientes_nuevos: number;
};

type DashboardClientesEstado = {
  deuda_total_centavos: number;
  deuda_vencida_centavos: number;
  clientes_inactivos: number;
};
```

**Queries:**
- **Ranking:** `venta JOIN cliente` donde `venta.estado='confirmada'` y `fecha BETWEEN desde AND hasta`, GROUP BY `cliente_id`, ORDER BY `sum(total)` DESC, LIMIT 10.
- **Clientes nuevos:** `count(*)` de `cliente` donde `fecha_creacion BETWEEN desde AND hasta` y `activo=true`.
- **Deuda total:** `sum(saldo_centavos)` de `cuenta_corriente_cliente` donde `activo=true` y `saldo_centavos > 0`.
- **Deuda vencida (Opción A):** `sum(saldo_centavos)` de `cuenta_corriente_cliente` donde `activo=true`, `saldo_centavos > 0` y `fecha_ultimo_movimiento < (now - cc_dias_vencimiento días)`.
- **Clientes inactivos:** `count` de clientes activos cuya última venta confirmada fue hace más de `cliente_dias_inactividad` días. Implementado como LEFT JOIN `venta` GROUP BY `cliente_id`, filtrando `max(fecha) < umbral OR max(fecha) IS NULL`.

### 4.3 `dashboard-proveedores.ts`

```typescript
type ProveedorRankingEntry = {
  proveedor_id: string;
  razon_social: string;
  gasto_centavos: number;  // sum(cantidad_recibida * costo_unitario_centavos)
};

type DashboardProveedoresRango = {
  ranking: ProveedorRankingEntry[];  // top 10
};

type DashboardProveedoresEstado = {
  ocs_pendientes: number;
  ocs_sugeridas_sin_resolver: number;
};
```

**Queries:**
- **Ranking gasto:** `item_oc JOIN orden_compra JOIN proveedor` donde `oc.estado IN ('recibida_parcial','recibida_total','cerrada')` y `oc.fecha BETWEEN desde AND hasta`, GROUP BY `proveedor_id`, `sum(item_oc.cantidad_recibida * item_oc.costo_unitario_centavos)`, ORDER BY gasto DESC, LIMIT 10.
- **OCs pendientes:** `count(*)` de `orden_compra` donde `estado IN ('emitida','recibida_parcial')`.
- **OCs sugeridas sin resolver:** `count(*)` de `orden_compra` donde `tipo='sugerida'` y `estado NOT IN ('recibida_total','cerrada','anulada')`.

---

## 5. Vistas React

### Archivos nuevos

```
src/renderer/views/dashboard/
  caja/CajaTabView.tsx
  clientes/ClientesTabView.tsx
  proveedores/ProveedoresTabView.tsx
```

### 5.1 `CajaTabView`

```
Props: { period: Period }
Carga: dashboardCajaRango({ desde, hasta }) — recarga con period
```

Layout vertical:
1. **KPIs (grid 3):** Ingresos totales | Egresos totales | Recargo tarjeta
2. **Gráfico de barras (Recharts `BarChart`):** una barra `Ingresos` + una barra `Egresos` por turno. Eje X = `fecha_apertura` formateada (`dd/MM`). Funciona con 1 turno (Hoy) o 90 turnos (Trimestre).
3. **Tabla medios de pago:** columnas `Medio | Monto | %` donde % = monto / total general.

### 5.2 `ClientesTabView`

```
Props: { period: Period }
Carga:
  dashboardClientesRango({ desde, hasta }) — recarga con period
  dashboardClientesEstado()               — carga una vez al montar
```

Layout vertical:
1. **KPIs de estado (grid 4):** Deuda total | Deuda vencida | Nuevos | Inactivos.  
   - "Deuda total", "Deuda vencida" e "Inactivos" muestran `"hoy"` en texto muted debajo del número.
   - "Nuevos" muestra el período activo (no lleva leyenda "hoy").
2. **Ranking clientes (período):** lista top-10 con `razon_social | $ total_facturado | N ventas`. Click en fila → `navigate('/clientes/:id')` con React Router `useNavigate`. La ruta existe: `/clientes/:id` → `ClienteDetalle`.

### 5.3 `ProveedoresTabView`

```
Props: { period: Period }
Carga:
  dashboardProveedoresRango({ desde, hasta }) — recarga con period
  dashboardProveedoresEstado()               — carga una vez al montar
```

Layout vertical:
1. **KPIs de estado (grid 2):** OCs pendientes | OCs sugeridas sin resolver.  
   Ambos con leyenda `"hoy"` en texto muted.
2. **Ranking proveedores (período):** lista top-10 con `razon_social | $ gasto` + barra proporcional al máximo.

### 5.4 `DashboardView.tsx` — cambios mínimos

```typescript
// Ampliar TabId
type TabId = 'resumen' | 'ventas' | 'productos' | 'caja' | 'clientes' | 'proveedores';

// Quitar disabled en TABS array para 'caja', 'clientes', 'proveedores'

// Agregar render de tabs nuevos
{activeTab === 'caja'        && <CajaTabView       period={period} />}
{activeTab === 'clientes'    && <ClientesTabView    period={period} />}
{activeTab === 'proveedores' && <ProveedoresTabView period={period} />}

// Extender condición de PeriodSelector
(activeTab === 'ventas' || activeTab === 'productos'
  || activeTab === 'caja' || activeTab === 'clientes' || activeTab === 'proveedores')
```

---

## 6. Tests

### Main process (node runner)

| Archivo | Cobertura |
|---------|-----------|
| `src/main/ipc/__tests__/dashboard-caja-rango.test.ts` | turnos con ingresos/egresos; medios de pago; recargo tarjeta; período sin datos retorna vacíos |
| `src/main/ipc/__tests__/dashboard-clientes.test.ts` | ranking top-10 excluye CF; clientes_nuevos filtra por período; deuda_total solo activos con saldo>0; deuda_vencida respeta umbral; clientes_inactivos |
| `src/main/ipc/__tests__/dashboard-proveedores.test.ts` | ranking gasto por OC recibida; ocs_pendientes cuenta estados correctos; ocs_sugeridas_sin_resolver |

### Renderer (jsdom)

| Archivo | Cobertura |
|---------|-----------|
| `src/renderer/views/dashboard/__tests__/CajaTabView.test.tsx` | render KPIs; render gráfico (mock Recharts); tabla medios de pago |
| `src/renderer/views/dashboard/__tests__/ClientesTabView.test.tsx` | KPIs estado con leyenda "hoy"; ranking con navegación; loading/error states |
| `src/renderer/views/dashboard/__tests__/ProveedoresTabView.test.tsx` | KPIs estado; ranking con barra |
| `src/renderer/views/dashboard/__tests__/DashboardTabs.test.tsx` (existente — extender) | 3 tabs nuevos habilitados (sin `disabled`); PeriodSelector visible en caja/clientes/proveedores |

---

## 7. Restricciones y gates

- **Sin dependencias nuevas:** Recharts ya está instalado desde Fase 1.
- **Sin migración de schema:** solo INSERTs en `parametros_sistema`.
- **Solo lectura en /dashboard:** ningún handler escribe ni modifica datos.
- **No tocar:** POS, CajaView, CuentaCorriente, OC — solo se leen sus tablas.
- **Navegación cliente:** usa `useNavigate` a ruta existente `/compras/clientes/:id`, no duplica UI.

---

## 8. Orden de implementación sugerido

1. Insertar parámetros en seed SQL
2. `dashboard-caja-rango.ts` + tests main
3. `dashboard-clientes.ts` + tests main
4. `dashboard-proveedores.ts` + tests main
5. Preload — 5 entradas nuevas
6. `CajaTabView.tsx` + tests renderer
7. `ClientesTabView.tsx` + tests renderer
8. `ProveedoresTabView.tsx` + tests renderer
9. `DashboardView.tsx` — habilitar tabs + extender PeriodSelector
10. Extender `DashboardTabs.test.tsx`
11. Ejecutar suite completa; actualizar Estado.md y ADR-Log
