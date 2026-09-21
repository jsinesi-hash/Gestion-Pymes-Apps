# Spec: Detalle de venta desde Caja Dashboard

**Fecha:** 2026-07-14  
**Estado:** Aprobado — listo para implementar

---

## Contexto

En `CajaDashboard`, la tabla "Ventas del turno" muestra `numero_interno`, hora, total y estado de cada venta. Actualmente el número de venta es texto plano y el único acceso a acciones es un botón de anulación directamente en la fila (solo para usuarios con `venta.anular`).

Se requiere que al hacer click sobre el número de venta se abra un modal grande con el detalle completo, y que todas las acciones sobre la venta (reimprimir, cancelar) queden dentro de ese modal.

---

## Decisiones de diseño

- **Presentación:** modal grande (overlay ~90% de pantalla), sin navegar a una ruta nueva. Se cierra con ✕ o llamando `onClose`.
- **Componente:** `VentaDetalleModal` nuevo en `src/renderer/views/caja/`. No se adapta `TicketModal` del POS para evitar acoplar contextos.
- **Botón anular en fila:** se elimina. La única vía para cancelar una venta es desde dentro del modal.
- **Reimprimir:** reutiliza la función `buildTicketHtml` (extraída a utilidad compartida o duplicada intencionalmente) + `ferreteria.catalogo.print.html`.

---

## Cambios por capa

### 1. IPC — `src/main/ipc/venta.ts`

Extender `ventaGetHandler` para incluir el nombre del cliente:

```typescript
const cliente = venta.cliente_id
  ? db.select({ razon_social: schema.cliente.razon_social })
      .from(schema.cliente)
      .where(eq(schema.cliente.id, venta.cliente_id)).get() ?? null
  : null;
return { venta, detalles, comprobante, cliente };
```

Retorno ampliado: `{ venta, detalles, comprobante, cliente: { razon_social: string } | null }`.

El preload ya expone `ferreteria.venta.get` — sin cambios allí.

### 2. Nuevo componente — `src/renderer/views/caja/VentaDetalleModal.tsx`

**Props:**
```typescript
type Props = {
  ventaId: string;
  onClose: () => void;
  onAnulada: () => void;
};
```

**Estados internos:** `data`, `loading`, `error`, `showAnulacion`, `anulada` (boolean local post-anulación), `printing`.

**Ciclo de vida:** al montar, llama `ferreteria.venta.get({ id: ventaId })`. Mientras resuelve muestra estado de carga. Si retorna `null` o lanza, muestra error con botón cerrar.

**Layout:**

```
┌─ modal-header ─────────────────────────────────────────────┐
│  Detalle de venta   [ANULADA badge si corresponde]   [✕]   │
│  V-C1-000003 · <fecha completa>                            │
└────────────────────────────────────────────────────────────┘
┌─ 3 info cards (grid 3 columnas) ───────────────────────────┐
│  COMPROBANTE        CLIENTE              FORMA DE PAGO      │
│  V-C1-000003        García, Roberto      💵 Efectivo        │
│  Ticket interno     Consumidor Final     Confirmada · 09:42 │
└────────────────────────────────────────────────────────────┘
┌─ tabla ítems ──────────────────────────────────────────────┐
│  DESCRIPCIÓN              CANT.    PRECIO U.    SUBTOTAL    │
│  Tornillo autoperf. 6x1"    50      $25,00      $1.250,00  │
│  Pintura látex blanca 4L     1   $3.600,00      $3.600,00  │
├────────────────────────────────────────────────────────────┤
│  Descuento global (solo si > 0)                  -5%       │
│  Ajuste redondeo (solo si ≠ 0)                  -$0,10     │
│  TOTAL                                        $4.850,00    │
└────────────────────────────────────────────────────────────┘
┌─ modal-footer ─────────────────────────────────────────────┐
│  [🖨 Reimprimir]                  [✕ Cancelar venta]       │
│  siempre visible           solo si confirmada + can anular │
└────────────────────────────────────────────────────────────┘
```

**Acción "Reimprimir":** genera HTML con `buildTicketHtml(venta, detalles)` — función definida localmente en `VentaDetalleModal.tsx`, con la misma lógica que la del `TicketModal` (no se extrae a shared para no tocar el POS). Llama `ferreteria.catalogo.print.html(html)`. Deshabilita el botón mientras imprime.

**Acción "Cancelar venta":** visible solo si `can('venta.anular')` y `venta.estado === 'confirmada'` y `!anulada`. Al clickear, renderiza `AnulacionModal` anidado. En `onSuccess`: setea `anulada = true` (aparece badge ANULADA), cierra el `AnulacionModal` interno, llama `onAnulada()` para que el dashboard refresque la lista.

**Reutilización:** `AnulacionModal` se importa desde `'../pos/AnulacionModal'` sin modificaciones.

### 3. Modificaciones — `src/renderer/views/caja/CajaDashboard.tsx`

**Estado agregado:**
```typescript
const [detalleVentaId, setDetalleVentaId] = useState<string | null>(null);
```

**Estado eliminado:** `anularVentaId` y su setter.

**Celda `numero_interno`** — de texto plano a botón-link:
```tsx
<td>
  <button className="link-btn num" onClick={() => setDetalleVentaId(v.id)}>
    {v.numero_interno}
  </button>
</td>
```

**Columna anular eliminada:**
- `{can('venta.anular') && <th />}` → eliminado
- El `<td>` con el botón `.ia.del` → eliminado
- El `colSpan` del "Sin resultados" se ajusta de 5 a 4

**Imports eliminados:** `AnulacionModal` (se elimina el import desde CajaDashboard).

**Modal montado al pie:**
```tsx
{detalleVentaId && (
  <VentaDetalleModal
    ventaId={detalleVentaId}
    onClose={() => setDetalleVentaId(null)}
    onAnulada={() => { setDetalleVentaId(null); cargarDatos(); }}
  />
)}
```

**El `AnulacionModal` que estaba al pie del dashboard** → eliminado.

---

## Tests

### `VentaDetalleModal.test.tsx` (renderer, jsdom)

Mock de `window.ferreteria.venta.get` y `window.ferreteria.catalogo.print.html`.

| # | Escenario | Assertion clave |
|---|-----------|----------------|
| 1 | Loading state | Muestra indicador de carga antes de resolver |
| 2 | Fetch falla / null | Muestra mensaje de error; botón cerrar llama `onClose` |
| 3 | Render completo datos | `numero_interno`, `razon_social`, `forma_pago`, descripciones de ítems, `precio_unitario`, `subtotal` por ítem y total visibles |
| 4 | Badge ANULADA | Aparece cuando `venta.estado === 'anulada'` |
| 5 | Descuento global oculto | No aparece fila cuando `descuento_global === 0` |
| 6 | Descuento global visible | Aparece fila cuando `descuento_global > 0` |
| 7 | Ajuste redondeo oculto | No aparece fila cuando `ajuste_redondeo === 0` |
| 8 | Reimprimir llama print | Click → `print.html` llamado con HTML que contiene `numero_interno` |
| 9 | Cancelar visible (supervisor) | Botón "Cancelar venta" presente si `confirmada` + `can('venta.anular')` |
| 10 | Cancelar oculto (operador) | Botón ausente si no tiene permiso `venta.anular` |
| 11 | Cancelar oculto (ya anulada) | Botón ausente si `venta.estado === 'anulada'` |
| 12 | Flujo anulación completo | Click "Cancelar" → AnulacionModal visible; success → badge ANULADA + `onAnulada()` llamado |
| 13 | Cerrar con ✕ | `onClose()` llamado |

### `CajaDashboard.test.tsx` (si existe — agregar casos)

- El número de venta es un botón clickeable
- Click en número → `VentaDetalleModal` montado con el `ventaId` correcto
- No existe botón de anulación en la fila para ningún rol

---

## Archivos afectados (resumen)

| Archivo | Acción |
|---------|--------|
| `src/main/ipc/venta.ts` | Modificar `ventaGetHandler` (+cliente join) |
| `src/renderer/views/caja/VentaDetalleModal.tsx` | **Crear** |
| `src/renderer/views/caja/VentaDetalleModal.test.tsx` | **Crear** |
| `src/renderer/views/caja/CajaDashboard.tsx` | Modificar (trigger, remover anular, montar modal) |

**Sin cambios:** preload, `AnulacionModal`, `TicketModal`, handlers IPC de caja.
