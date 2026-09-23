import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresPanel } from './ProveedoresPanel';

// ADR-083 — alta rápida de proveedor asociado desde el detalle del producto.
// Suite separada de ProveedoresPanel.test.tsx porque mockea AuthContext y el
// flag del motor de precios de forma global: mezclarla con los tests de
// overrides/costo neto (que dependen del hook real + parametros.get) rompería esos.
let canReturn = true;
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()), useAuth: () => ({ can: () => canReturn }) }));
vi.mock('../../hooks/useMotorPrecios', () => ({ useMotorPreciosV2Habilitado: () => false }));

const mockListByProducto = vi.fn();
const mockProveedorList = vi.fn();
const mockUpsert = vi.fn();
const mockSetPreferido = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  canReturn = true;
  mockListByProducto.mockResolvedValue([]);
  mockProveedorList.mockResolvedValue([{ id: 'prov-1', razon_social: 'Alfa', activo: true }]);
  mockUpsert.mockResolvedValue({ id: 'pp-nuevo' });
  mockSetPreferido.mockResolvedValue({ id: 'pp-nuevo' });
  (globalThis as any).ferreteria = {
    compras: {
      proveedor: { list: mockProveedorList },
      pp: { listByProducto: mockListByProducto, upsert: mockUpsert, setPreferido: mockSetPreferido },
    },
  };
});

function renderPanel() {
  return render(<MemoryRouter><ProveedoresPanel productoId="p1" /></MemoryRouter>);
}

describe('ADR-083 — agregar proveedor desde el producto', () => {
  it('muestra el botón "Agregar proveedor" en el estado vacío', async () => {
    renderPanel();
    expect(await screen.findByRole('button', { name: /agregar proveedor/i })).toBeInTheDocument();
  });

  it('sin proveedores previos: al agregar, marca el nuevo como preferido', async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /agregar proveedor/i }));
    fireEvent.change(await screen.findByLabelText(/proveedor/i), { target: { value: 'prov-1' } });
    fireEvent.change(screen.getByLabelText(/costo/i), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ producto_id: 'p1', proveedor_id: 'prov-1', costo_centavos: 15000 }),
    ));
    await waitFor(() => expect(mockSetPreferido).toHaveBeenCalledWith('pp-nuevo'));
  });
});

describe('ADR-083 — permiso proveedor.gestionar', () => {
  it('sin el permiso, no muestra el botón "Agregar proveedor"', async () => {
    canReturn = false;
    renderPanel();
    await screen.findByText(/sin proveedores asociados/i);
    expect(screen.queryByRole('button', { name: /agregar proveedor/i })).not.toBeInTheDocument();
  });
});

describe('ADR-085 (SEC-2) — ruteo del error de validación del backend', () => {
  it('rutea VALIDATION:proveedor_id al select de proveedor y no marca preferido', async () => {
    mockUpsert.mockRejectedValue(new Error('VALIDATION:proveedor_id:REQUERIDO'));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /agregar proveedor/i }));
    fireEvent.change(await screen.findByLabelText(/proveedor/i), { target: { value: 'prov-1' } });
    fireEvent.change(screen.getByLabelText(/costo/i), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('pp_add_proveedor_id')));
    expect(await screen.findByText(/obligatorio/i)).toBeInTheDocument();
    expect(mockSetPreferido).not.toHaveBeenCalled();
  });

  it('rutea VALIDATION:costo_centavos al input de costo bruto', async () => {
    mockUpsert.mockRejectedValue(new Error('VALIDATION:costo_centavos:NEGATIVO'));
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /agregar proveedor/i }));
    fireEvent.change(await screen.findByLabelText(/proveedor/i), { target: { value: 'prov-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('pp_add_costo_centavos')));
  });
});
