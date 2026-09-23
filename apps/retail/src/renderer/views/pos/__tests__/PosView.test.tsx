import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@core/ui';
import { PosSessionProvider } from '../../../context/PosSessionContext';
import { PosView } from '../PosView';

const mockCaja = { id: 'c-1', estado: 'abierta', monto_inicial: 0, usuario_id: 'u-1', fecha_apertura: new Date() };
const mockProd = { id: 'p-1', nombre_corto: 'Tornillo', activo: true, precio_venta_lista: 1000, impuesto_id: null, permite_fraccion: false };
const mockEx = { producto_id: 'p-1', stock_fisico: 10 };
const mockVentaResult = {
  venta: { id: 'v-1', numero_interno: 'V-C1-000001', total: 1000, forma_pago: 'efectivo', fecha: new Date() },
  detalles: [{ id: 'd-1', descripcion: 'Tornillo', cantidad: 1, precio_unitario: 1000, subtotal: 1000 }],
  comprobante: { tipo: 'ticket_interno' },
};

function buildAuth(canAnular = false) {
  return {
    session: { userId: 'u-1', nombreCompleto: 'Test', permisos: new Set(['venta.crear']) } as any,
    can: (codigo: string) => codigo === 'venta.anular' ? canAnular : true,
    login: async () => {},
    logout: async () => {},
    actualizarPreferencias: () => {},
  };
}

function setupFerreteria(overrides: Record<string, unknown> = {}) {
  (window as any).ferreteria = {
    caja: { getActiva: vi.fn().mockResolvedValue(mockCaja) },
    precios: {
      lista: { list: vi.fn().mockResolvedValue([]) },
      detalle: { listByProducto: vi.fn().mockResolvedValue([]) },
      valor: { getPrecioEnLista: vi.fn().mockResolvedValue({ precio_centavos: 100000, origen: 'vigente' }) },
    },
    catalogo: {
      impuesto: { list: vi.fn().mockResolvedValue([]) },
      producto: {
        list: vi.fn().mockResolvedValue({ items: [{ id: 'p-1', nombre_corto: 'Tornillo', sku: 'T001' }] }),
        get: vi.fn().mockResolvedValue(mockProd),
      },
      existencias: { get: vi.fn().mockResolvedValue(mockEx) },
    },
    venta: { confirmar: vi.fn().mockResolvedValue(mockVentaResult) },
    cliente: { list: vi.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = {
    caja: { getActiva: vi.fn().mockResolvedValue(null) },
    precios: {
      lista: { list: vi.fn().mockResolvedValue([]) },
      detalle: { listByProducto: vi.fn().mockResolvedValue([]) },
      valor: { getPrecioEnLista: vi.fn().mockResolvedValue({ precio_centavos: 100000, origen: 'vigente' }) },
    },
    catalogo: { impuesto: { list: vi.fn().mockResolvedValue([]) } },
    venta: { confirmar: vi.fn() },
    cliente: { list: vi.fn().mockResolvedValue([]) },
  };
});

function renderPos(canAnular = false) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={buildAuth(canAnular)}>
        <PosSessionProvider>
          <PosView />
        </PosSessionProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

// Abre el modal de pago (botón "Confirmar" de la barra inferior). En ese momento el modal
// aún no está abierto, así que "Confirmar" matchea sólo el botón de la barra.
function abrirModalPago() {
  fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));
}

// Confirma dentro del ConfirmarVentaModal. Con el modal abierto hay dos "Confirmar" (el de
// la barra y el del modal), por eso se scopea al panel del modal.
function confirmarEnModal() {
  const modal = screen.getByText('Confirmar venta').closest('.panel') as HTMLElement;
  fireEvent.click(within(modal).getByRole('button', { name: /^confirmar$/i }));
}

describe('PosView', () => {
  it('muestra banner sin caja cuando cajaActiva es null', async () => {
    renderPos();
    await waitFor(() => expect(screen.getByText(/necesitás una caja abierta/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /caja/i })).toBeInTheDocument();
  });

  it('muestra el área de scan cuando hay caja abierta', async () => {
    setupFerreteria();
    renderPos();
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());
  });

  it('producto válido escaneado aparece en la tabla de líneas', async () => {
    setupFerreteria();
    renderPos();
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/escanear/i);
    fireEvent.change(input, { target: { value: 'T001' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
  });

  it('botón Anular ausente en TicketModal para Operador', async () => {
    setupFerreteria();
    renderPos(false);
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());

    // Agregar producto
    const input = screen.getByPlaceholderText(/escanear/i);
    fireEvent.change(input, { target: { value: 'T001' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());

    // Abrir modal de confirmación
    abrirModalPago();
    await waitFor(() => expect(screen.getByLabelText(/monto/i)).toBeInTheDocument());

    // Ingresar monto y confirmar
    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: '1000' } });
    confirmarEnModal();
    await waitFor(() => expect(screen.getByText('V-C1-000001')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /anular venta/i })).not.toBeInTheDocument();
  });

  it('botón Anular presente en TicketModal para Supervisor', async () => {
    setupFerreteria();
    renderPos(true);
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/escanear/i);
    fireEvent.change(input, { target: { value: 'T001' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());

    // Abrir modal de confirmación
    abrirModalPago();
    await waitFor(() => expect(screen.getByLabelText(/monto/i)).toBeInTheDocument());

    // Ingresar monto y confirmar
    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: '1000' } });
    confirmarEnModal();
    await waitFor(() => expect(screen.getByText('V-C1-000001')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /anular venta/i })).toBeInTheDocument();
  });

  it('muestra un error claro cuando la venta falla al confirmar (no lo traga)', async () => {
    setupFerreteria({ venta: { confirmar: vi.fn().mockRejectedValue(new Error('STOCK_INSUFICIENTE')) } });
    renderPos();
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/escanear/i);
    fireEvent.change(input, { target: { value: 'T001' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());

    abrirModalPago();
    await waitFor(() => expect(screen.getByLabelText(/monto/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/monto/i), { target: { value: '1000' } });
    confirmarEnModal();

    await waitFor(() => expect(screen.getByText(/No hay stock suficiente/i)).toBeInTheDocument());
  });

  it('Volver en modal cierra sin llamar a venta.confirmar', async () => {
    setupFerreteria();
    renderPos();
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/escanear/i);
    fireEvent.change(input, { target: { value: 'T001' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());

    abrirModalPago();
    await waitFor(() => expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));
    expect(screen.queryByRole('button', { name: /volver/i })).not.toBeInTheDocument();
    expect((window as any).ferreteria.venta.confirmar).not.toHaveBeenCalled();
  });

  // ADR-056 Lote 2 — Cancelar vuelve el cart a cero, con confirmación previa para no
  // borrar por accidente. No registra nada en la BD.
  async function agregarUnTornillo() {
    const input = screen.getByPlaceholderText(/escanear/i);
    fireEvent.change(input, { target: { value: 'T001' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
  }

  it('Cancelar pide confirmación y, al confirmar, vacía el cart sin registrar nada', async () => {
    setupFerreteria();
    renderPos();
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());
    await agregarUnTornillo();

    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));

    // Aparece la confirmación (no se vacía todavía).
    await waitFor(() => expect(screen.getByRole('button', { name: /descartar venta/i })).toBeInTheDocument());
    expect(screen.getByText('Tornillo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /descartar venta/i }));

    await waitFor(() => expect(screen.queryByText('Tornillo')).not.toBeInTheDocument());
    expect((window as any).ferreteria.venta.confirmar).not.toHaveBeenCalled();
  });

  it('ADR-069: el área de ítems está dentro de un .panel (tarjeta blanca)', async () => {
    setupFerreteria();
    renderPos();
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());
    await agregarUnTornillo();

    // Con al menos una línea, PosItemsTable renderiza su .table-wrap; debe vivir dentro de un .panel.
    const tableWrap = document.querySelector('.table-wrap');
    expect(tableWrap).not.toBeNull();
    expect(tableWrap!.closest('.panel')).not.toBeNull();
  });

  it('Cancelar → Volver conserva el cart intacto', async () => {
    setupFerreteria();
    renderPos();
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());
    await agregarUnTornillo();

    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /descartar venta/i })).toBeInTheDocument());

    // Cierro la confirmación sin descartar.
    fireEvent.click(screen.getByRole('button', { name: /^volver$/i }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /descartar venta/i })).not.toBeInTheDocument());
    expect(screen.getByText('Tornillo')).toBeInTheDocument();
  });
});
