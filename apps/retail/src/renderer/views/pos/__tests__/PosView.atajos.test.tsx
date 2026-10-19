import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@core/ui';
import { PosSessionProvider } from '../../../context/PosSessionContext';
import { PosView } from '../PosView';

const mockCaja = { id: 'c-1', estado: 'abierta', monto_inicial: 0, usuario_id: 'u-1', fecha_apertura: new Date() };
const mockProd = { id: 'p-1', nombre_corto: 'Tornillo', activo: true, precio_venta_lista: 1000, impuesto_id: null, permite_fraccion: false };

function buildAuth(canOverride: boolean) {
  return {
    session: { userId: 'u-1', nombreCompleto: 'Test', permisos: new Set(['venta.crear']) } as any,
    can: (codigo: string) => (codigo === 'precio.override' ? canOverride : codigo !== 'venta.anular'),
    login: async () => {},
    logout: async () => {},
    actualizarPreferencias: () => {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
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
      existencias: { get: vi.fn().mockResolvedValue({ producto_id: 'p-1', stock_fisico: 10 }) },
    },
    venta: { confirmar: vi.fn() },
    cliente: { list: vi.fn().mockResolvedValue([]) },
  };
});

function renderPos(canOverride = true) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={buildAuth(canOverride)}>
        <PosSessionProvider>
          <PosView />
        </PosSessionProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function conUnaLinea(canOverride = true) {
  renderPos(canOverride);
  await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());
  const input = screen.getByPlaceholderText(/escanear/i);
  fireEvent.change(input, { target: { value: 'T001' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
}

describe('PosView — atajos de teclado', () => {
  it('F2 enfoca el buscador', async () => {
    await conUnaLinea();
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(window, { key: 'F2' });
    expect(screen.getByPlaceholderText(/escanear/i)).toHaveFocus();
  });

  it('F4 abre Confirmar venta cuando hay líneas', async () => {
    await conUnaLinea();
    fireEvent.keyDown(window, { key: 'F4' });
    await waitFor(() => expect(screen.getByText('Confirmar venta')).toBeInTheDocument());
  });

  it('F4 sin líneas no hace nada', async () => {
    renderPos();
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'F4' });
    expect(screen.queryByText('Confirmar venta')).not.toBeInTheDocument();
  });

  it('F9 abre el modal de poner en espera', async () => {
    await conUnaLinea();
    fireEvent.keyDown(window, { key: 'F9' });
    await waitFor(() => expect(screen.getByText('Poner venta en espera')).toBeInTheDocument());
  });

  it('regresión: con Confirmar venta abierto, F9 no abre la pausa por detrás', async () => {
    await conUnaLinea();
    fireEvent.keyDown(window, { key: 'F4' });
    await waitFor(() => expect(screen.getByText('Confirmar venta')).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'F9' });
    fireEvent.keyDown(window, { key: 'F8' });
    expect(screen.queryByText('Poner venta en espera')).not.toBeInTheDocument();
  });

  it('F6 enfoca el Desc. % de la última línea con precio.override', async () => {
    await conUnaLinea(true);
    fireEvent.keyDown(window, { key: 'F6' });
    expect(screen.getByLabelText(/desc\. % tornillo/i)).toHaveFocus();
  });

  it('F6 sin precio.override no hace nada', async () => {
    await conUnaLinea(false);
    const buscador = screen.getByPlaceholderText(/escanear/i);
    buscador.focus();
    const ev = new KeyboardEvent('keydown', { key: 'F6', bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(buscador).toHaveFocus();
  });

  it('los botones muestran la tecla del atajo', async () => {
    await conUnaLinea();
    expect(screen.getByTitle(/cobrar \(F4\)/i)).toBeInTheDocument();
    expect(screen.getByTitle(/poner en espera \(F9\)/i)).toBeInTheDocument();
    expect(screen.getByTitle(/ventas en espera \(F8\)/i)).toBeInTheDocument();
  });
});
