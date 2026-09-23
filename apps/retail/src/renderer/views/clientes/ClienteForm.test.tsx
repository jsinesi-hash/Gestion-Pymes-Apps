import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ClienteForm } from '@core/ui';

// ADR-050 — cliente.razon_social se separó en nombre/apellido (ambos NOT NULL).
// El formulario pasa a tener dos inputs editables en vez del único de razón social.

const mockUpsert = vi.fn();
const mockGet = vi.fn();
// Seam B6: la lista de precios que antes venía de ferreteria.precios.lista.list ahora
// llega por prop; el selector sólo se renderiza si se pasa cargarListasPrecio.
const cargarListas = () => Promise.resolve([{ id: 'l1', nombre: 'Mayorista' }]);

function renderForm(initialPath = '/clientes/nuevo') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/clientes/nuevo" element={<ClienteForm cargarListasPrecio={cargarListas} />} />
        <Route path="/clientes/:id/editar" element={<ClienteForm cargarListasPrecio={cargarListas} />} />
        <Route path="/clientes/:id" element={<div>detalle</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({ id: 'cli-nuevo' });
  mockGet.mockResolvedValue(null);
  (globalThis as any).ferreteria = {
    cliente: { get: mockGet, upsert: mockUpsert },
    geo: {
      provincias: vi.fn().mockResolvedValue([]),
      localidades: vi.fn().mockResolvedValue([]),
    },
    precios: {
      lista: {
        list: vi.fn().mockResolvedValue([{ id: 'l1', nombre: 'Mayorista', activo: true, predeterminada: false }]),
      },
    },
  };
});

describe('ClienteForm — nombre y apellido separados (ADR-050)', () => {
  it('muestra inputs separados de Nombre y Apellido, no uno de razón social', () => {
    renderForm();
    expect(screen.getByPlaceholderText('Juan Carlos')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('García')).toBeInTheDocument();
  });

  it('exige nombre y apellido antes de enviar', async () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('12345678'), { target: { value: '30111222' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cliente/i }));
    expect(await screen.findByText('El nombre es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('El apellido es obligatorio.')).toBeInTheDocument();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('envía nombre y apellido por separado en el payload de alta', async () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('12345678'), { target: { value: '30111222' } });
    fireEvent.change(screen.getByPlaceholderText('Juan Carlos'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('García'), { target: { value: 'López' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cliente/i }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    const payload = mockUpsert.mock.calls[0][0];
    expect(payload.nombre).toBe('Ana');
    expect(payload.apellido).toBe('López');
    expect(payload).not.toHaveProperty('razon_social');
  });

  it('ADR-082: si el backend rechaza por un campo, pinta su error inline y lo enfoca', async () => {
    mockUpsert.mockRejectedValue(new Error('VALIDATION:nombre:REQUERIDO'));
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('12345678'), { target: { value: '30111222' } });
    fireEvent.change(screen.getByPlaceholderText('Juan Carlos'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('García'), { target: { value: 'López' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cliente/i }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/obligatorio|requerido/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Juan Carlos')).toHaveFocus();
  });

  it('en edición precarga nombre y apellido existentes', async () => {
    mockGet.mockResolvedValue({
      id: 'c1', tipo_documento: 'DNI', numero_documento: '30111222',
      nombre: 'Ana', apellido: 'López', condicion_fiscal: 'Consumidor Final',
    });
    renderForm('/clientes/c1/editar');
    expect(await screen.findByDisplayValue('Ana')).toBeInTheDocument();
    expect(screen.getByDisplayValue('López')).toBeInTheDocument();
  });
});

describe('ClienteForm — selector de lista de precios (ADR-083)', () => {
  it('incluye lista_precio_id en el payload de alta al seleccionar una lista', async () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('12345678'), { target: { value: '30111222' } });
    fireEvent.change(screen.getByPlaceholderText('Juan Carlos'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('García'), { target: { value: 'López' } });
    const selectLista = await screen.findByLabelText(/lista de precios/i);
    fireEvent.change(selectLista, { target: { value: 'l1' } });
    fireEvent.click(screen.getByRole('button', { name: /crear cliente/i }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(mockUpsert.mock.calls[0][0]).toEqual(expect.objectContaining({ lista_precio_id: 'l1' }));
  });
});
