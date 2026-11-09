import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@core/ui';
import { ListasPreciosView } from '../ListasPreciosView';

const LISTA = { id: 'l1', nombre: 'General', tipo: 'general', ajuste_porcentual: 0, modo_calculo: 'margen_costo', predeterminada: true, activo: true };

function auth() {
  return {
    session: { id: 'u1', nombreCompleto: 'Admin', rolId: 'r1', rolNombre: '', permisos: [], preferencias: { tema: 'claro' as const, acento: 'amber' as const, ui_font: 'Hanken Grotesk' as const, densidad: 'comfortable' as const, skin: 'actual' as const, pantalla_inicio: null, favoritos: [] } },
    can: (c: string) => c === 'precio.gestionar',
    login: async () => {}, logout: async () => {},
    actualizarPreferencias: () => {},
  };
}

function renderView() {
  return render(
    <AuthContext.Provider value={auth()}>
      <MemoryRouter><ListasPreciosView /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

const mockCreate = vi.fn();
const mockListarVigentesPorLista = vi.fn();

const VIGENTE_A = {
  id: 'v1', producto_id: 'p1', nombre_corto: 'Tornillo 3/4', sku: 'P-0000001-9',
  gtin_barcode: '7791234560001', lista_precio_id: 'l1', precio_centavos: 15000,
  fecha_desde: new Date('2026-01-01').toISOString(), origen: 'manual',
  precio_promocion_centavos: null, promocion_hasta: null,
};
const VIGENTE_B = {
  id: 'v2', producto_id: 'p2', nombre_corto: 'Martillo', sku: 'P-0000002-7',
  gtin_barcode: '7791234560002', lista_precio_id: 'l1', precio_centavos: 500000,
  fecha_desde: new Date('2026-01-02').toISOString(), origen: 'recalculo',
  precio_promocion_centavos: null, promocion_hasta: null,
};
const VIGENTE_C = {
  id: 'v3', producto_id: 'p3', nombre_corto: 'Clavo 1"', sku: 'P-0000003-5',
  gtin_barcode: '7791234560003', lista_precio_id: 'l1', precio_centavos: 8000,
  fecha_desde: new Date('2026-01-03').toISOString(), origen: 'manual',
  precio_promocion_centavos: null, promocion_hasta: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ ...LISTA, id: 'l9' });
  mockListarVigentesPorLista.mockResolvedValue([VIGENTE_A, VIGENTE_B, VIGENTE_C]);
  (window as any).ferreteria = {
    parametros: { get: vi.fn().mockResolvedValue('true') }, // motor v2 ON
    precios: {
      lista: { list: vi.fn().mockResolvedValue([LISTA]), create: mockCreate, update: vi.fn(), deactivate: vi.fn() },
      valor: { listarVigentesPorLista: mockListarVigentesPorLista },
      reglas: { listByLista: vi.fn().mockResolvedValue([]), upsert: vi.fn(), remove: vi.fn() },
    },
    catalogo: {
      marca: { list: vi.fn().mockResolvedValue([]) },
      categoria: { list: vi.fn().mockResolvedValue([]) },
      producto: { list: vi.fn().mockResolvedValue({ items: [] }) },
    },
    compras: { proveedor: { list: vi.fn().mockResolvedValue([]) } },
  };
});

describe('ListasPreciosView — motor v2 ON', () => {
  it('el maestro muestra la columna "Modo de cálculo"', async () => {
    renderView();
    expect(await screen.findByText('Modo de cálculo')).toBeInTheDocument();
  });

  it('al seleccionar una lista aparece el tab "Reglas" y NO "Cambios programados"', async () => {
    renderView();
    fireEvent.click(await screen.findByText('General'));
    await waitFor(() => expect(screen.getByText('Reglas')).toBeInTheDocument());
    expect(screen.queryByText('Cambios programados')).not.toBeInTheDocument();
    expect(screen.queryByText('Ajustes por producto')).not.toBeInTheDocument();
  });

  it('el alta de lista envía modo_calculo en el payload', async () => {
    renderView();
    fireEvent.click(await screen.findByRole('button', { name: /nueva lista/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Costo' } });
    fireEvent.change(screen.getByLabelText(/modo de cálculo/i), { target: { value: 'margen_costo' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledOnce());
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ modo_calculo: 'margen_costo' }));
  });

  // ── ADR-071 Task 2 — SKU, filtro y orden en Precios vigentes ──────────────────

  describe('tab Precios vigentes — SKU, filtro y orden (ADR-071)', () => {
    async function abrirVigentes() {
      renderView();
      fireEvent.click(await screen.findByText('General'));
      await waitFor(() => expect(mockListarVigentesPorLista).toHaveBeenCalled());
      await screen.findByText('Tornillo 3/4');
    }

    it('muestra la columna SKU con los valores de cada producto', async () => {
      await abrirVigentes();
      expect(screen.getByText('P-0000001-9')).toBeInTheDocument();
      expect(screen.getByText('P-0000002-7')).toBeInTheDocument();
      expect(screen.getByText('P-0000003-5')).toBeInTheDocument();
    });

    it('el filtro de texto narrows por SKU', async () => {
      await abrirVigentes();
      const filtro = screen.getByPlaceholderText(/nombre, sku o ean/i);
      fireEvent.change(filtro, { target: { value: 'P-0000002-7' } });

      expect(screen.getByText('Martillo')).toBeInTheDocument();
      expect(screen.queryByText('Tornillo 3/4')).not.toBeInTheDocument();
      expect(screen.queryByText('Clavo 1"')).not.toBeInTheDocument();
    });

    it('el filtro de texto narrows por EAN/gtin_barcode', async () => {
      await abrirVigentes();
      const filtro = screen.getByPlaceholderText(/nombre, sku o ean/i);
      fireEvent.change(filtro, { target: { value: '7791234560003' } });

      expect(screen.getByText('Clavo 1"')).toBeInTheDocument();
      expect(screen.queryByText('Tornillo 3/4')).not.toBeInTheDocument();
      expect(screen.queryByText('Martillo')).not.toBeInTheDocument();
    });

    it('clic en el header "Precio vigente" ordena ascendente y luego descendente', async () => {
      await abrirVigentes();
      const headerPrecio = screen.getByText('Precio vigente');
      const tablaVigentes = headerPrecio.closest('table') as HTMLTableElement;

      fireEvent.click(headerPrecio);
      let filas = tablaVigentes.querySelectorAll('tbody tr');
      expect(filas[0].textContent).toContain('Clavo 1"');
      expect(filas[1].textContent).toContain('Tornillo 3/4');
      expect(filas[2].textContent).toContain('Martillo');

      fireEvent.click(headerPrecio);
      filas = tablaVigentes.querySelectorAll('tbody tr');
      expect(filas[0].textContent).toContain('Martillo');
      expect(filas[1].textContent).toContain('Tornillo 3/4');
      expect(filas[2].textContent).toContain('Clavo 1"');
    });
  });
});
