import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ClienteDetalle } from '@core/ui';

// ADR-083 (Task 7) — el detalle de cliente muestra la lista de precios asignada,
// resuelta por nombre contra `precios.lista.list()` (cliente.get sólo trae el id).

function renderDetalle(id = 'c1') {
  return render(
    <MemoryRouter initialEntries={[`/clientes/${id}`]}>
      <Routes>
        <Route path="/clientes/:id" element={<ClienteDetalle cargarListasPrecio={() => mockListaList()} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const BASE_CLIENTE = {
  id: 'c1',
  tipo_documento: 'DNI',
  numero_documento: '30111222',
  nombre: 'Ana',
  apellido: 'Pérez',
  nombre_fantasia: null,
  condicion_fiscal: 'Consumidor Final',
  telefono: null,
  telefono_adicional: null,
  email: null,
  domicilio: null,
  calle: null,
  numero: null,
  aclaracion: null,
  localidad: null,
  provincia: null,
  codigo_postal: null,
  habilita_cuenta_corriente: false,
  activo: true,
  lista_precio_id: null as string | null,
};

const mockGet = vi.fn();
const mockListaList = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockListaList.mockResolvedValue([{ id: 'l1', nombre: 'Mayorista', activo: true }]);
  (globalThis as any).ferreteria = {
    cliente: { get: mockGet },
    precios: { lista: { list: mockListaList } },
  };
});

describe('ADR-083 — lista de precios en el detalle', () => {
  it('muestra el nombre de la lista asignada', async () => {
    mockGet.mockResolvedValue({ ...BASE_CLIENTE, lista_precio_id: 'l1' });
    renderDetalle();
    expect(await screen.findByText('Mayorista')).toBeInTheDocument();
  });

  it('muestra "Predeterminada" cuando no hay lista asignada', async () => {
    mockGet.mockResolvedValue({ ...BASE_CLIENTE, lista_precio_id: null });
    renderDetalle();
    expect(await screen.findByText('Predeterminada')).toBeInTheDocument();
  });
});
