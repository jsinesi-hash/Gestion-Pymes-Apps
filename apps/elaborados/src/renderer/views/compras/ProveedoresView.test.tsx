import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresView } from './ProveedoresView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const PROVEEDORES = [
  { id: 'p1', codigo: 'PROV-0001', razon_social: 'Lácteos SA', tipo_documento: 'CUIT', numero_documento: '30111111118',
    condicion_fiscal: 'Responsable Inscripto', telefono: '11-5555', email: 'ventas@lacteos.com', persona_contacto: 'Ana',
    domicilio: null, observaciones: null, activo: true },
  { id: 'p2', codigo: 'PROV-0002', razon_social: 'Dulces SRL', tipo_documento: 'DNI', numero_documento: '0',
    condicion_fiscal: 'Consumidor Final', telefono: null, email: null, persona_contacto: null,
    domicilio: null, observaciones: null, activo: true },
];

const mockList = vi.fn();
const mockUpsert = vi.fn();
const mockDeactivate = vi.fn();
vi.stubGlobal('elaborados', { proveedor: { list: mockList, get: vi.fn(), upsert: mockUpsert, deactivate: mockDeactivate } });

const renderView = () => render(<MemoryRouter><ProveedoresView /></MemoryRouter>);

describe('ProveedoresView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockList.mockResolvedValue(PROVEEDORES.map((p) => ({ ...p })));
    mockUpsert.mockResolvedValue({ id: 'x' });
    mockDeactivate.mockResolvedValue({ id: 'p1' });
  });

  it('lista los proveedores con sus datos de contacto', async () => {
    renderView();
    const fila = (await screen.findByText('Lácteos SA')).closest('tr')!;
    expect(within(fila).getByText('PROV-0001')).toBeInTheDocument();
    expect(within(fila).getByText('ventas@lacteos.com')).toBeInTheDocument();
    expect(within(fila).getByText('Ana')).toBeInTheDocument();
  });

  it('sin permiso no hay acciones de gestión', async () => {
    mockCan.mockReturnValue(false);
    renderView();
    await screen.findByText('Lácteos SA');
    expect(screen.queryByRole('button', { name: /nuevo proveedor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dar de baja/i })).not.toBeInTheDocument();
  });

  it('crea un proveedor con los datos del formulario', async () => {
    renderView();
    await screen.findByText('Lácteos SA');
    fireEvent.click(screen.getByRole('button', { name: /nuevo proveedor/i }));
    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: ' Harinas SA ' } });
    fireEvent.change(screen.getByLabelText(/número de documento/i), { target: { value: '30222222226' } });
    fireEvent.change(screen.getByLabelText(/teléfono/i), { target: { value: '11-1234' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith({
      razon_social: 'Harinas SA', tipo_documento: 'CUIT', numero_documento: '30222222226',
      condicion_fiscal: 'Responsable Inscripto', telefono: '11-1234', email: '', persona_contacto: '',
      domicilio: '', observaciones: '',
    }));
  });

  it('edita: manda el id y muestra vacío el documento placeholder "0" del alta rápida', async () => {
    renderView();
    const fila = (await screen.findByText('Dulces SRL')).closest('tr')!;
    fireEvent.click(within(fila).getByRole('button', { name: /editar/i }));
    expect((screen.getByLabelText(/número de documento/i) as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByLabelText(/número de documento/i), { target: { value: '30333333334' } });
    fireEvent.change(screen.getByLabelText(/tipo de documento/i), { target: { value: 'CUIT' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'p2', razon_social: 'Dulces SRL', tipo_documento: 'CUIT', numero_documento: '30333333334',
    })));
  });

  it('error al guardar → alerta traducida y el modal sigue abierto', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('FORBIDDEN'));
    renderView();
    await screen.findByText('Lácteos SA');
    fireEvent.click(screen.getByRole('button', { name: /nuevo proveedor/i }));
    fireEvent.change(screen.getByLabelText(/razón social/i), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no tenés permiso/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('dar de baja pide confirmación y llama a deactivate', async () => {
    const confirmar = vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderView();
    const fila = (await screen.findByText('Lácteos SA')).closest('tr')!;
    fireEvent.click(within(fila).getByRole('button', { name: /dar de baja/i }));
    expect(mockDeactivate).not.toHaveBeenCalled();
    fireEvent.click(within(fila).getByRole('button', { name: /dar de baja/i }));
    await waitFor(() => expect(mockDeactivate).toHaveBeenCalledWith('p1'));
    confirmar.mockRestore();
  });
});
