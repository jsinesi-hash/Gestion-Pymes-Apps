import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@core/ui';
import { PosSessionProvider } from '../PosSessionContext';
import { PosView } from '../../views/pos/PosView';

// ADR-056 Lote 1: "venta en curso persistente". El cart vive en un provider de renderer
// que NO se desmonta al navegar; al volver a /pos el cart aparece idéntico. Esta
// persistencia es SOLO de UI: no debe escribir en la BD (ni venta borrador, ni caja, ni
// stock).

const mockCaja = { id: 'c-1', estado: 'abierta', monto_inicial: 0, usuario_id: 'u-1', fecha_apertura: new Date() };
const mockProd = { id: 'p-1', nombre_corto: 'Tornillo', activo: true, precio_venta_lista: 1000, impuesto_id: null, permite_fraccion: false, unidad_venta: 'un' };
const mockEx = { producto_id: 'p-1', stock_fisico: 10 };

function buildAuth() {
  return {
    session: { userId: 'u-1', nombreCompleto: 'Test', permisos: new Set(['venta.crear']) } as any,
    can: () => true,
    login: async () => {},
    logout: async () => {},
    actualizarPreferencias: () => {},
  };
}

function setupFerreteria() {
  const confirmar = vi.fn();
  const pausar = vi.fn();
  (window as any).ferreteria = {
    caja: { getActiva: vi.fn().mockResolvedValue(mockCaja) },
    precios: {
      lista: { list: vi.fn().mockResolvedValue([]) },
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
    venta: {
      confirmar,
      espera: { listar: vi.fn().mockResolvedValue([]), pausar },
    },
    cliente: { list: vi.fn().mockResolvedValue([]) },
  };
  return { confirmar, pausar };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/** Provider montado por FUERA de la vista que se monta/desmonta (simula la navegación). */
function Harness({ show }: { show: boolean }) {
  return (
    <MemoryRouter>
      <AuthContext.Provider value={buildAuth()}>
        <PosSessionProvider>
          {show ? <PosView /> : <div>OTRA PANTALLA</div>}
        </PosSessionProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

async function agregarTornillo() {
  const input = await screen.findByPlaceholderText(/escanear/i);
  fireEvent.change(input, { target: { value: 'T001' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
}

describe('PosSessionProvider — cart persistente al navegar', () => {
  it('el cart sobrevive al desmontar y volver a montar la vista', async () => {
    setupFerreteria();
    const { rerender } = render(<Harness show={true} />);

    await agregarTornillo();

    // Navego a otra pantalla: PosView se desmonta.
    rerender(<Harness show={false} />);
    await waitFor(() => expect(screen.getByText('OTRA PANTALLA')).toBeInTheDocument());
    expect(screen.queryByText('Tornillo')).not.toBeInTheDocument();

    // Vuelvo a /pos: el cart debe seguir intacto.
    rerender(<Harness show={true} />);
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());
  });

  it('re-consulta la caja activa al volver a la vista (caja abierta en otra pantalla se refleja)', async () => {
    // El provider vive montado desde el login; si la caja se abre DESPUÉS (en /caja) y el
    // usuario vuelve a /pos, la vista debe reflejar la caja recién abierta, no la foto
    // vieja del arranque.
    const getActiva = vi.fn().mockResolvedValue(null);
    (window as any).ferreteria = {
      caja: { getActiva },
      precios: {
        lista: { list: vi.fn().mockResolvedValue([]) },
        valor: { getPrecioEnLista: vi.fn().mockResolvedValue({ precio_centavos: 0, origen: 'vigente' }) },
      },
      catalogo: { impuesto: { list: vi.fn().mockResolvedValue([]) } },
      venta: { confirmar: vi.fn(), espera: { listar: vi.fn().mockResolvedValue([]) } },
      cliente: { list: vi.fn().mockResolvedValue([]) },
    };

    const { rerender } = render(<Harness show={true} />);
    // Sin caja: banner.
    await waitFor(() => expect(screen.getByText(/necesitás una caja abierta/i)).toBeInTheDocument());

    // Se abre la caja en otra pantalla.
    getActiva.mockResolvedValue(mockCaja);

    // Navego afuera y vuelvo.
    rerender(<Harness show={false} />);
    await waitFor(() => expect(screen.getByText('OTRA PANTALLA')).toBeInTheDocument());
    rerender(<Harness show={true} />);

    // Al volver a /pos, debe verse el área de scan (caja detectada).
    await waitFor(() => expect(screen.getByPlaceholderText(/escanear/i)).toBeInTheDocument());
  });

  it('GATE: navegar con el cart en curso NO escribe en la BD (ni venta ni espera)', async () => {
    const { confirmar, pausar } = setupFerreteria();
    const { rerender } = render(<Harness show={true} />);

    await agregarTornillo();
    rerender(<Harness show={false} />);
    await waitFor(() => expect(screen.getByText('OTRA PANTALLA')).toBeInTheDocument());
    rerender(<Harness show={true} />);
    await waitFor(() => expect(screen.getByText('Tornillo')).toBeInTheDocument());

    expect(confirmar).not.toHaveBeenCalled();
    expect(pausar).not.toHaveBeenCalled();
  });
});
