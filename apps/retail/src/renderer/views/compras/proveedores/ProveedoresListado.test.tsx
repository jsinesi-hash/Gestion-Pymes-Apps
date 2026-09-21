import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresListado } from './ProveedoresListado';
import { __resetPersistentListState } from '../../../hooks/usePersistentListState';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockList = vi.fn();

const PROV = {
  id: 'prov-1',
  razon_social: 'Bosch SA',
  nombre_fantasia: 'Bosch',
  tipo_documento: 'CUIT',
  numero_documento: '30-11111111-7',
  condicion_fiscal: 'Responsable Inscripto',
  codigo: 'BSH',
  telefono: '011-4000-0000',
  email: 'ventas@bosch.com',
  activo: true,
};

function renderListado() {
  return render(
    <MemoryRouter>
      <ProveedoresListado />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetPersistentListState();
  mockList.mockResolvedValue([PROV]);
  (globalThis as any).ferreteria = {
    compras: { proveedor: { list: mockList } },
  };
});

describe('ProveedoresListado — navegación por fila completa (ADR-055)', () => {
  it('un clic en un campo que NO es razón social abre el detalle del proveedor', async () => {
    renderListado();
    // Click sobre la celda del email (no la razón social).
    const emailCell = await screen.findByText('ventas@bosch.com');
    fireEvent.click(emailCell);
    expect(mockNavigate).toHaveBeenCalledWith('/compras/proveedores/prov-1');
  });

  it('un clic en la razón social también abre el detalle', async () => {
    renderListado();
    const razon = await screen.findByText('Bosch SA');
    fireEvent.click(razon);
    expect(mockNavigate).toHaveBeenCalledWith('/compras/proveedores/prov-1');
  });

  it('la fila es operable por teclado: Enter navega al detalle', async () => {
    renderListado();
    const razon = await screen.findByText('Bosch SA');
    const row = razon.closest('tr')!;
    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/compras/proveedores/prov-1');
  });

  it('la tecla Espacio también navega', async () => {
    renderListado();
    const razon = await screen.findByText('Bosch SA');
    const row = razon.closest('tr')!;
    fireEvent.keyDown(row, { key: ' ' });
    expect(mockNavigate).toHaveBeenCalledWith('/compras/proveedores/prov-1');
  });

  it('el botón "+ Nuevo proveedor" no navega al detalle de una fila', async () => {
    renderListado();
    await screen.findByText('Bosch SA');
    const nuevo = screen.getByRole('button', { name: /nuevo proveedor/i });
    // el botón vive en un <Link>, su comportamiento propio no debe disparar navigate de fila
    fireEvent.click(nuevo);
    expect(mockNavigate).not.toHaveBeenCalledWith('/compras/proveedores/prov-1');
  });
});

describe('ProveedoresListado — búsqueda unificada (ADR-081 SRCH-2/3)', () => {
  it('la búsqueda persiste al desmontar y remontar', async () => {
    const { unmount } = renderListado();
    await screen.findByText('Bosch SA');
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'bosch' } });
    unmount();

    renderListado();
    await screen.findByText('30-11111111-7');
    expect((screen.getByLabelText('Buscar') as HTMLInputElement).value).toBe('bosch');
  });
});
