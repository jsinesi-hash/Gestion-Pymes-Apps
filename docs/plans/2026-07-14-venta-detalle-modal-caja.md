# VentaDetalleModal en Caja — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al hacer click en el número de venta en CajaDashboard, abrir un modal grande con el detalle completo (ítems, cliente, forma de pago, totales) y acciones de reimprimir y cancelar.

**Architecture:** Nuevo componente `VentaDetalleModal` en `src/renderer/views/caja/` que carga datos vía `ferreteria.venta.get`. El handler IPC se extiende para incluir `cliente.razon_social`. El botón de anulación se elimina de las filas de la tabla y queda solo dentro del modal.

**Tech Stack:** React + TypeScript, Vitest + Testing Library (renderer), better-sqlite3 + Drizzle (main process tests).

**Spec:** `docs/specs/2026-07-14-venta-detalle-modal-caja-design.md`

---

## Archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `packages/client/src/main/ipc/venta.ts` |
| Modificar (añadir tests) | `packages/client/src/main/ipc/__tests__/venta.handlers.test.ts` |
| **Crear** | `packages/client/src/renderer/views/caja/__tests__/VentaDetalleModal.test.tsx` |
| **Crear** | `packages/client/src/renderer/views/caja/VentaDetalleModal.tsx` |
| **Crear** | `packages/client/src/renderer/views/caja/__tests__/CajaDashboard.test.tsx` |
| Modificar | `packages/client/src/renderer/views/caja/CajaDashboard.tsx` |

---

## Task 1: Extender `ventaGetHandler` para incluir el cliente

**Files:**
- Modify: `packages/client/src/main/ipc/venta.ts` — función `ventaGetHandler`
- Modify: `packages/client/src/main/ipc/__tests__/venta.handlers.test.ts` — agregar `describe('ventaGetHandler', ...)`

- [ ] **Step 1: Escribir el test que falla**

Al final de `packages/client/src/main/ipc/__tests__/venta.handlers.test.ts`, después de todos los `describe` existentes y dentro del `describe('venta handlers', ...)` principal, agregar:

```typescript
  // ── ventaGetHandler ──────────────────────────────────────────────────────

  describe('ventaGetHandler', () => {
    it('retorna venta con detalles, comprobante y cliente', () => {
      const { prod } = crearProductoConStock();
      const caja = abrirCaja();
      const confirmada = ventaConfirmarHandler(db, makePayload(caja.id, prod.id));

      const result = ventaGetHandler(db, { id: confirmada.venta.id });

      expect(result).not.toBeNull();
      expect(result!.venta.id).toBe(confirmada.venta.id);
      expect(result!.detalles).toHaveLength(1);
      expect(result!.comprobante?.tipo).toBe('ticket_interno');
      expect(result!.cliente).not.toBeNull();
      expect(result!.cliente!.razon_social).toBe('Consumidor Final');
    });

    it('retorna null para id inexistente', () => {
      loginAsAdmin(db);
      expect(ventaGetHandler(db, { id: 'no-existe' })).toBeNull();
    });
  });
```

- [ ] **Step 2: Correr el test — verificar que falla**

```
cd packages/client && ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron node_modules/vitest/vitest.mjs run --config vitest.node.config.ts src/main/ipc/__tests__/venta.handlers.test.ts
```

Esperado: FAIL — `result!.cliente` es `undefined` (campo no existe aún).

- [ ] **Step 3: Implementar el cambio en `ventaGetHandler`**

En `packages/client/src/main/ipc/venta.ts`, reemplazar la función `ventaGetHandler` completa:

```typescript
export function ventaGetHandler(db: Db, payload: { id: string }) {
  const venta = db.select().from(schema.venta)
    .where(eq(schema.venta.id, payload.id)).get();
  if (!venta) return null;
  const detalles = db.select().from(schema.venta_detalle)
    .where(eq(schema.venta_detalle.venta_id, payload.id)).all();
  const comprobante = venta.comprobante_id
    ? db.select().from(schema.comprobante)
        .where(eq(schema.comprobante.id, venta.comprobante_id)).get() ?? null
    : null;
  const cliente = venta.cliente_id
    ? db.select({ razon_social: schema.cliente.razon_social })
        .from(schema.cliente)
        .where(eq(schema.cliente.id, venta.cliente_id)).get() ?? null
    : null;
  return { venta, detalles, comprobante, cliente };
}
```

- [ ] **Step 4: Correr los tests — verificar que pasan**

```
cd packages/client && ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron node_modules/vitest/vitest.mjs run --config vitest.node.config.ts src/main/ipc/__tests__/venta.handlers.test.ts
```

Esperado: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/main/ipc/venta.ts packages/client/src/main/ipc/__tests__/venta.handlers.test.ts
git commit -m "feat(caja): ventaGetHandler incluye cliente.razon_social"
```

---

## Task 2: Crear `VentaDetalleModal` (TDD)

**Files:**
- Create: `packages/client/src/renderer/views/caja/__tests__/VentaDetalleModal.test.tsx`
- Create: `packages/client/src/renderer/views/caja/VentaDetalleModal.tsx`

### Subtask 2a: Tests (crear archivo, verificar que fallan)

- [ ] **Step 1: Crear el archivo de tests**

Crear `packages/client/src/renderer/views/caja/__tests__/VentaDetalleModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VentaDetalleModal } from '../VentaDetalleModal';

const mockCan = vi.fn().mockReturnValue(false);
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ can: mockCan }),
}));

vi.mock('../../pos/AnulacionModal', () => ({
  AnulacionModal: ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => (
    <div data-testid="anulacion-modal">
      <button onClick={onSuccess}>confirmar-anulacion</button>
      <button onClick={onCancel}>cancelar-anulacion</button>
    </div>
  ),
}));

const ventaConfirmada = {
  id: 'v-1',
  numero_interno: 'V-C1-000001',
  fecha: new Date('2026-07-14T09:42:00'),
  total: 4850,
  forma_pago: 'efectivo',
  estado: 'confirmada',
  descuento_global: 0,
  ajuste_redondeo: 0,
};

const detallesMock = [
  { id: 'd-1', descripcion: 'Tornillo 6x1"', cantidad: 50, precio_unitario: 25, subtotal: 1250 },
  { id: 'd-2', descripcion: 'Pintura blanca 4L', cantidad: 1, precio_unitario: 3600, subtotal: 3600 },
];

const mockGetOk = vi.fn().mockResolvedValue({
  venta: ventaConfirmada,
  detalles: detallesMock,
  comprobante: { tipo: 'ticket_interno' },
  cliente: { razon_social: 'García, Roberto' },
});

const mockPrintHtml = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(false);
  vi.stubGlobal('ferreteria', {
    venta: { get: mockGetOk, anular: vi.fn() },
    catalogo: { print: { html: mockPrintHtml } },
  });
});

describe('VentaDetalleModal', () => {
  it('muestra estado de carga antes de resolver', () => {
    vi.stubGlobal('ferreteria', {
      venta: { get: vi.fn().mockReturnValue(new Promise(() => {})) },
      catalogo: { print: { html: vi.fn() } },
    });
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra error si venta.get retorna null', async () => {
    vi.stubGlobal('ferreteria', {
      venta: { get: vi.fn().mockResolvedValue(null) },
      catalogo: { print: { html: vi.fn() } },
    });
    const onClose = vi.fn();
    render(<VentaDetalleModal ventaId="v-1" onClose={onClose} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getByText(/no encontrada/i));
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('muestra numero_interno, cliente, forma_pago, ítems y total', async () => {
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    expect(screen.getByText('García, Roberto')).toBeInTheDocument();
    expect(screen.getByText('Efectivo')).toBeInTheDocument();
    expect(screen.getByText('Tornillo 6x1"')).toBeInTheDocument();
    expect(screen.getByText('Pintura blanca 4L')).toBeInTheDocument();
    expect(screen.getByText(/4\.850/)).toBeInTheDocument();
  });

  it('muestra badge ANULADA cuando estado es anulada', async () => {
    vi.stubGlobal('ferreteria', {
      venta: {
        get: vi.fn().mockResolvedValue({
          venta: { ...ventaConfirmada, estado: 'anulada' },
          detalles: detallesMock,
          comprobante: { tipo: 'ticket_interno' },
          cliente: { razon_social: 'García, Roberto' },
        }),
      },
      catalogo: { print: { html: vi.fn() } },
    });
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('ANULADA')).toBeInTheDocument());
  });

  it('no muestra fila descuento_global cuando es 0', async () => {
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    expect(screen.queryByText(/descuento global/i)).not.toBeInTheDocument();
  });

  it('muestra fila descuento_global cuando es mayor a 0', async () => {
    vi.stubGlobal('ferreteria', {
      venta: {
        get: vi.fn().mockResolvedValue({
          venta: { ...ventaConfirmada, descuento_global: 5 },
          detalles: detallesMock,
          comprobante: { tipo: 'ticket_interno' },
          cliente: { razon_social: 'García, Roberto' },
        }),
      },
      catalogo: { print: { html: vi.fn() } },
    });
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/descuento global/i)).toBeInTheDocument());
  });

  it('no muestra fila ajuste_redondeo cuando es 0', async () => {
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    expect(screen.queryByText(/ajuste redondeo/i)).not.toBeInTheDocument();
  });

  it('llama a print.html al hacer click en Reimprimir', async () => {
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', { name: /reimprimir/i }));
    fireEvent.click(screen.getByRole('button', { name: /reimprimir/i }));
    await waitFor(() => expect(mockPrintHtml).toHaveBeenCalledOnce());
    expect(mockPrintHtml.mock.calls[0][0]).toContain('V-C1-000001');
  });

  it('no muestra botón Cancelar venta si no tiene permiso venta.anular', async () => {
    mockCan.mockReturnValue(false);
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    expect(screen.queryByRole('button', { name: /cancelar venta/i })).not.toBeInTheDocument();
  });

  it('muestra botón Cancelar venta si tiene permiso y venta confirmada', async () => {
    mockCan.mockReturnValue(true);
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /cancelar venta/i })).toBeInTheDocument());
  });

  it('no muestra botón Cancelar venta si venta ya está anulada', async () => {
    mockCan.mockReturnValue(true);
    vi.stubGlobal('ferreteria', {
      venta: {
        get: vi.fn().mockResolvedValue({
          venta: { ...ventaConfirmada, estado: 'anulada' },
          detalles: detallesMock,
          comprobante: { tipo: 'ticket_interno' },
          cliente: { razon_social: 'García, Roberto' },
        }),
      },
      catalogo: { print: { html: vi.fn() } },
    });
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getByText('ANULADA'));
    expect(screen.queryByRole('button', { name: /cancelar venta/i })).not.toBeInTheDocument();
  });

  it('abre AnulacionModal al hacer click en Cancelar venta y en éxito llama onAnulada', async () => {
    mockCan.mockReturnValue(true);
    const onAnulada = vi.fn();
    render(<VentaDetalleModal ventaId="v-1" onClose={vi.fn()} onAnulada={onAnulada} />);
    await waitFor(() => screen.getByRole('button', { name: /cancelar venta/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancelar venta/i }));
    expect(screen.getByTestId('anulacion-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'confirmar-anulacion' }));
    expect(screen.getByText('ANULADA')).toBeInTheDocument();
    expect(onAnulada).toHaveBeenCalled();
  });

  it('llama onClose al hacer click en ✕', async () => {
    const onClose = vi.fn();
    render(<VentaDetalleModal ventaId="v-1" onClose={onClose} onAnulada={vi.fn()} />);
    await waitFor(() => screen.getAllByText('V-C1-000001'));
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr los tests — verificar que fallan**

```
cd packages/client && pnpm exec vitest run src/renderer/views/caja/__tests__/VentaDetalleModal.test.tsx
```

Esperado: FAIL — `Cannot find module '../VentaDetalleModal'`.

### Subtask 2b: Implementar el componente

- [ ] **Step 3: Crear `VentaDetalleModal.tsx`**

Crear `packages/client/src/renderer/views/caja/VentaDetalleModal.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { AnulacionModal } from '../pos/AnulacionModal';
import { useAuth } from '../../context/AuthContext';

type VentaData = {
  venta: any;
  detalles: any[];
  comprobante: any;
  cliente: { razon_social: string } | null;
};

type Props = {
  ventaId: string;
  onClose: () => void;
  onAnulada: () => void;
};

function fmt(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(v: any) {
  try {
    return (v instanceof Date ? v : new Date(v)).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function buildTicketHtml(venta: any, detalles: any[]): string {
  const fecha = new Date(venta.fecha).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const formaPago = venta.forma_pago.charAt(0).toUpperCase() + venta.forma_pago.slice(1);
  const rows = detalles.map((d: any) =>
    `<tr><td>${d.descripcion} × ${d.cantidad}</td><td align="right">$ ${fmt(d.subtotal)}</td></tr>`
  ).join('');
  const descRow = venta.descuento_global > 0
    ? `<tr><td>Descuento global</td><td align="right">-${venta.descuento_global}%</td></tr>` : '';
  const ajusteRow = venta.ajuste_redondeo === 0
    ? '' : `<tr><td>Ajuste redondeo</td><td align="right">$ ${fmt(venta.ajuste_redondeo)}</td></tr>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:monospace;font-size:12px;width:80mm;margin:0 auto;padding:8px}
    table{width:100%;border-collapse:collapse}td{padding:2px 4px}
    .hdr{text-align:center;margin-bottom:8px}
    .tot{border-top:1px solid #000;font-weight:bold;font-size:14px}
    hr{border:none;border-top:1px dashed #999}
  </style></head><body>
  <div class="hdr"><div style="font-size:18px;font-weight:bold">TICKET INTERNO</div>
  <div>${venta.numero_interno}</div><div>${fecha}</div></div>
  <hr/><table>${rows}${descRow}${ajusteRow}
  <tr class="tot"><td>TOTAL</td><td align="right">$ ${fmt(venta.total)}</td></tr>
  <tr><td>Forma de pago</td><td align="right">${formaPago}</td></tr>
  </table><hr/>
  </body></html>`;
}

export function VentaDetalleModal({ ventaId, onClose, onAnulada }: Readonly<Props>) {
  const { can } = useAuth();
  const [data, setData] = useState<VentaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnulacion, setShowAnulacion] = useState(false);
  const [anulada, setAnulada] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    (globalThis as any).ferreteria.venta.get({ id: ventaId })
      .then((result: VentaData | null) => {
        if (!result) { setError('Venta no encontrada'); return; }
        setData(result);
        if (result.venta.estado === 'anulada') setAnulada(true);
      })
      .catch(() => setError('Error al cargar la venta'))
      .finally(() => setLoading(false));
  }, [ventaId]);

  async function handleImprimir() {
    if (!data) return;
    setPrinting(true);
    try {
      const html = buildTicketHtml(data.venta, data.detalles);
      await (globalThis as any).ferreteria.catalogo.print.html(html);
    } catch {
      // print cancelled or failed — no action needed
    } finally {
      setPrinting(false);
    }
  }

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ width: 640 }}>
          <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>Cargando…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ width: 640 }}>
          <div className="modal-header"><span className="modal-title">Detalle de venta</span></div>
          <div className="modal-body"><div className="alert-danger">{error ?? 'Error desconocido'}</div></div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  }

  const { venta, detalles, comprobante, cliente } = data;
  const puedeAnular = can('venta.anular') && venta.estado === 'confirmada' && !anulada;
  const formaPagoLabel = venta.forma_pago.charAt(0).toUpperCase() + venta.forma_pago.slice(1);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: 640, maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--ink-3)', fontWeight: 700 }}>
              Detalle de venta
            </div>
            <div className="num" style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{venta.numero_interno}</div>
            <div className="text-muted text-sm">{fmtFecha(venta.fecha)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {anulada && (
              <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(192,57,43,.15)', color: 'var(--danger)', fontSize: 12, fontWeight: 700 }}>
                ANULADA
              </span>
            )}
            <button type="button" className="ia" onClick={onClose} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Comprobante</div>
              <div className="num" style={{ fontWeight: 700 }}>{venta.numero_interno}</div>
              <div className="text-muted text-xs">
                {comprobante?.tipo === 'ticket_interno' ? 'Ticket interno' : (comprobante?.tipo ?? '—')}
              </div>
            </div>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Cliente</div>
              <div style={{ fontWeight: 600 }}>{cliente?.razon_social ?? '—'}</div>
            </div>
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div className="shift-label">Forma de pago</div>
              <div style={{ fontWeight: 600 }}>{formaPagoLabel}</div>
              <div className="text-muted text-xs">{anulada ? 'Anulada' : 'Confirmada'}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th className="r">Cant.</th>
                  <th className="r">Precio u.</th>
                  <th className="r">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {detalles.map((d: any) => (
                  <tr key={d.id}>
                    <td>{d.descripcion}</td>
                    <td className="r num">{d.cantidad}</td>
                    <td className="r num">$ {fmt(d.precio_unitario)}</td>
                    <td className="r num">$ {fmt(d.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 8 }}>
            {venta.descuento_global > 0 && (
              <div className="srow">
                <span className="sl text-muted">Descuento global</span>
                <span className="sv num text-muted">-{venta.descuento_global}%</span>
              </div>
            )}
            {venta.ajuste_redondeo !== 0 && (
              <div className="srow">
                <span className="sl text-muted">Ajuste redondeo</span>
                <span className="sv num text-muted">$ {fmt(venta.ajuste_redondeo)}</span>
              </div>
            )}
            <div className="srow total">
              <span className="sl">TOTAL</span>
              <span className="sv num" style={{ color: 'var(--accent)' }}>$ {fmt(venta.total)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={handleImprimir} disabled={printing}>
            {printing ? 'Abriendo...' : '🖨 Reimprimir'}
          </button>
          {puedeAnular && (
            <button type="button" className="btn-danger" onClick={() => setShowAnulacion(true)}>
              Cancelar venta
            </button>
          )}
        </div>
      </div>

      {showAnulacion && (
        <AnulacionModal
          ventaId={venta.id}
          onSuccess={() => { setAnulada(true); setShowAnulacion(false); onAnulada(); }}
          onCancel={() => setShowAnulacion(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Correr los tests — verificar que pasan**

```
cd packages/client && pnpm exec vitest run src/renderer/views/caja/__tests__/VentaDetalleModal.test.tsx
```

Esperado: todos los tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/renderer/views/caja/__tests__/VentaDetalleModal.test.tsx packages/client/src/renderer/views/caja/VentaDetalleModal.tsx
git commit -m "feat(caja): VentaDetalleModal con ítems, cliente, reimprimir y cancelar"
```

---

## Task 3: Modificar `CajaDashboard` — wiring del modal

**Files:**
- Create: `packages/client/src/renderer/views/caja/__tests__/CajaDashboard.test.tsx`
- Modify: `packages/client/src/renderer/views/caja/CajaDashboard.tsx`

### Subtask 3a: Tests del dashboard (crear, verificar que fallan)

- [ ] **Step 1: Crear `CajaDashboard.test.tsx`**

Crear `packages/client/src/renderer/views/caja/__tests__/CajaDashboard.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CajaDashboard } from '../CajaDashboard';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ can: mockCan }),
}));

vi.mock('../../../components/export/ExportarButton', () => ({
  ExportarButton: () => null,
}));

const mockCaja = {
  id: 'caja-1',
  usuario_id: 'u-1',
  fecha_apertura: new Date('2026-07-14T08:00:00'),
  monto_inicial: 0,
  estado: 'abierta' as const,
};

const ventaMock = {
  id: 'v-1',
  numero_interno: 'V-C1-000001',
  fecha: new Date('2026-07-14T09:42:00'),
  total: 4850,
  estado: 'confirmada',
  forma_pago: 'efectivo',
};

const mockVentaGet = vi.fn().mockResolvedValue({
  venta: { ...ventaMock, descuento_global: 0, ajuste_redondeo: 0 },
  detalles: [{ id: 'd-1', descripcion: 'Tornillo', cantidad: 1, precio_unitario: 4850, subtotal: 4850 }],
  comprobante: { tipo: 'ticket_interno' },
  cliente: { razon_social: 'Consumidor Final' },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockCan.mockReturnValue(true);
  vi.stubGlobal('ferreteria', {
    venta: { listByCaja: vi.fn().mockResolvedValue([ventaMock]), get: mockVentaGet },
    caja: { listMovimientos: vi.fn().mockResolvedValue([]) },
    catalogo: { print: { html: vi.fn() } },
  });
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <CajaDashboard caja={mockCaja} onRefetch={vi.fn()} />
    </MemoryRouter>
  );
}

describe('CajaDashboard — número de venta como link', () => {
  it('el numero_interno es un botón clickeable', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
  });

  it('click en numero_interno abre VentaDetalleModal', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
    fireEvent.click(screen.getByRole('button', { name: 'V-C1-000001' }));
    await waitFor(() => expect(mockVentaGet).toHaveBeenCalledWith({ id: 'v-1' }));
    await waitFor(() => expect(screen.getByText('Detalle de venta')).toBeInTheDocument());
  });

  it('no muestra botón Anular en la fila de venta', async () => {
    renderDashboard();
    await waitFor(() => screen.getByRole('button', { name: 'V-C1-000001' }));
    expect(screen.queryByTitle('Anular')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests — verificar que fallan**

```
cd packages/client && pnpm exec vitest run src/renderer/views/caja/__tests__/CajaDashboard.test.tsx
```

Esperado: FAIL — `numero_interno` no es botón aún, botón Anular aún existe.

### Subtask 3b: Modificar CajaDashboard

- [ ] **Step 3: Aplicar los cambios en `CajaDashboard.tsx`**

**3a. Reemplazar el import de `AnulacionModal` — eliminar esa línea:**
```typescript
// ELIMINAR esta línea:
import { AnulacionModal } from '../pos/AnulacionModal';
```

**3b. Agregar import de `VentaDetalleModal` — añadir junto a los otros imports:**
```typescript
import { VentaDetalleModal } from './VentaDetalleModal';
```

**3c. En el bloque de estados, reemplazar `anularVentaId` por `detalleVentaId`:**

Reemplazar:
```typescript
  const [anularVentaId, setAnularVentaId] = useState<string | null>(null);
```
Por:
```typescript
  const [detalleVentaId, setDetalleVentaId] = useState<string | null>(null);
```

**3d. En la celda del número de venta, convertir de texto a botón:**

Reemplazar:
```tsx
                    <td><span className="num">{v.numero_interno}</span></td>
```
Por:
```tsx
                    <td>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', color: 'inherit', font: 'inherit' }}
                        onClick={() => setDetalleVentaId(v.id)}
                      >
                        {v.numero_interno}
                      </button>
                    </td>
```

**3e. Eliminar la columna de anular del `<thead>`:**

Reemplazar:
```tsx
                  {can('venta.anular') && <th />}
```
Por: *(nada — eliminar la línea completa)*

**3f. Eliminar la celda de anular del `<tbody>`:**

Eliminar este bloque completo de cada fila:
```tsx
                    {can('venta.anular') && (
                      <td>
                        {v.estado === 'confirmada' && (
                          <div className="row-act">
                            <button className="ia del" onClick={() => setAnularVentaId(v.id)} title="Anular">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    )}
```

**3g. Corregir el `colSpan` de "Sin resultados":**

Reemplazar:
```tsx
                  <tr><td colSpan={can('venta.anular') ? 5 : 4} style={{ textAlign: 'center', padding: '1rem', opacity: 0.5 }}>Sin resultados</td></tr>
```
Por:
```tsx
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem', opacity: 0.5 }}>Sin resultados</td></tr>
```

**3h. Al pie del componente, reemplazar `AnulacionModal` por `VentaDetalleModal`:**

Reemplazar:
```tsx
      {anularVentaId && (
        <AnulacionModal
          ventaId={anularVentaId}
          onSuccess={() => { setAnularVentaId(null); cargarDatos(); }}
          onCancel={() => setAnularVentaId(null)}
        />
      )}
```
Por:
```tsx
      {detalleVentaId && (
        <VentaDetalleModal
          ventaId={detalleVentaId}
          onClose={() => setDetalleVentaId(null)}
          onAnulada={() => { setDetalleVentaId(null); cargarDatos(); }}
        />
      )}
```

- [ ] **Step 4: Correr los tests del dashboard — verificar que pasan**

```
cd packages/client && pnpm exec vitest run src/renderer/views/caja/__tests__/CajaDashboard.test.tsx
```

Esperado: todos PASS.

- [ ] **Step 5: Correr la suite completa de renderer**

```
cd packages/client && pnpm exec vitest run --config vitest.config.ts
```

Esperado: todos los tests PASS (ninguna regresión).

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/renderer/views/caja/__tests__/CajaDashboard.test.tsx packages/client/src/renderer/views/caja/CajaDashboard.tsx
git commit -m "feat(caja): click en número de venta abre VentaDetalleModal, elimina botón anular de fila"
```

---

## Task 4: Verificación final

- [ ] **Step 1: Correr todos los tests**

```
cd packages/client && pnpm test
```

Esperado: renderer + main process, todos PASS.

- [ ] **Step 2: Smoke test manual**

1. `pnpm dev` desde la raíz del repo
2. Iniciar sesión como Supervisor
3. Abrir una caja
4. Crear al menos una venta desde el POS
5. Ir a Caja → verificar que el número de venta es subrayado/clickeable
6. Click en el número → modal grande con ítems, cliente, forma de pago, total
7. Click "🖨 Reimprimir" → ventana de impresión se abre con el ticket
8. Click "Cancelar venta" → aparece AnulacionModal con campo de motivo y credenciales supervisor
9. Completar anulación → badge ANULADA aparece en el modal, lista del dashboard se refresca
10. Verificar que **no** hay botón de anular en las filas de la tabla

- [ ] **Step 3: Commit final si hay ajustes menores del smoke test**

```bash
git add -p
git commit -m "fix(caja): ajustes post smoke-test VentaDetalleModal"
```
