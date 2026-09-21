import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProveedorForm } from './ProveedorForm';

const mockUpsert = vi.fn();
const mockGet = vi.fn();
const mockGetParam = vi.fn();

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/compras/proveedores/nuevo']}>
      <Routes>
        <Route path="/compras/proveedores/nuevo" element={<ProveedorForm />} />
        <Route path="/compras/proveedores/:id" element={<div>detalle</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({ id: 'prov-nuevo' });
  mockGet.mockResolvedValue(null);
  mockGetParam.mockResolvedValue('true');
  (window as any).ferreteria = {
    parametros: { get: mockGetParam },
    compras: { proveedor: { get: mockGet, upsert: mockUpsert } },
    geo: {
      provincias: vi.fn().mockResolvedValue([]),
      localidades: vi.fn().mockResolvedValue([]),
    },
  };
});

describe('ProveedorForm — condiciones comerciales (ADR-049, flag ON)', () => {
  it('muestra la tarjeta de condiciones comerciales con el flag encendido', async () => {
    renderForm();
    expect(await screen.findByLabelText(/Bonificación % por defecto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Costo financiero % por defecto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Flete % por defecto/i)).toBeInTheDocument();
  });

  it('envía los defaults comerciales en el payload de alta', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Razón social/i), { target: { value: 'Bosch' } });
    fireEvent.change(screen.getByLabelText(/Número de documento/i), { target: { value: '20123456789' } });
    fireEvent.change(await screen.findByLabelText(/Bonificación % por defecto/i), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText(/Flete % por defecto/i), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: /crear proveedor/i }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.bonificacion_pct_default).toBe(12);
    expect(payload.flete_pct_default).toBe(1.5);
    expect(payload.costo_financiero_pct_default).toBe(0);
  });
});

describe('ProveedorForm — ADR-082: error de validación del backend al campo', () => {
  it('si el backend rechaza por un campo, pinta su error inline y lo enfoca', async () => {
    mockUpsert.mockRejectedValue(new Error('VALIDATION:razon_social:REQUERIDO'));
    renderForm();
    fireEvent.change(await screen.findByLabelText(/Razón social/i), { target: { value: 'Bosch' } });
    fireEvent.change(screen.getByLabelText(/Número de documento/i), { target: { value: '20123456789' } });
    fireEvent.click(screen.getByRole('button', { name: /crear proveedor/i }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/obligatorio|requerido/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Razón social/i)).toHaveFocus();
  });
});

describe('ProveedorForm — flag OFF oculta las condiciones comerciales', () => {
  it('sin flag no se muestra la tarjeta comercial', async () => {
    mockGetParam.mockResolvedValue('false');
    renderForm();
    await screen.findByLabelText(/Razón social/i);
    expect(screen.queryByLabelText(/Bonificación % por defecto/i)).not.toBeInTheDocument();
  });
});
