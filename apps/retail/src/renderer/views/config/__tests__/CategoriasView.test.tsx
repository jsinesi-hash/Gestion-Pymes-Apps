import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CategoriasView } from '../CategoriasView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ can: mockCan, session: { id: '1', rolNombre: 'SUPERVISOR' } }),
}));

const mockListAll = vi.fn().mockResolvedValue([
  { id: '1', nombre: 'Herramientas', descripcion: null, activo: true, categoria_padre_id: null },
  { id: '2', nombre: 'Inactiva', descripcion: null, activo: false, categoria_padre_id: null },
]);
const mockCreate = vi.fn().mockResolvedValue({ id: '3', nombre: 'Nueva', activo: true });
const mockDesactivar = vi.fn().mockResolvedValue(undefined);
const mockReactivar = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('ferreteria', {
  catalogo: {
    categoria: { listAll: mockListAll, create: mockCreate, update: vi.fn(), desactivar: mockDesactivar, reactivar: mockReactivar },
  },
});

function render_() {
  return render(<MemoryRouter><CategoriasView /></MemoryRouter>);
}

describe('CategoriasView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAll.mockResolvedValue([
      { id: '1', nombre: 'Herramientas', descripcion: null, activo: true, categoria_padre_id: null },
      { id: '2', nombre: 'Inactiva', descripcion: null, activo: false, categoria_padre_id: null },
    ]);
    mockDesactivar.mockResolvedValue(undefined);
    mockReactivar.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue({ id: '3', nombre: 'Nueva', activo: true });
  });

  it('muestra las categorías cargadas', async () => {
    render_();
    await waitFor(() => expect(screen.getByText('Herramientas')).toBeInTheDocument());
    expect(screen.getAllByText('Inactiva').length).toBeGreaterThan(0);
  });

  it('muestra badge Activa e Inactiva según estado', async () => {
    render_();
    await waitFor(() => expect(screen.getByText('Herramientas')).toBeInTheDocument());
    expect(screen.getAllByText(/activa/i).length).toBeGreaterThan(0);
  });

  it('abre modal de nueva categoría al hacer click en "Nueva categoría"', async () => {
    render_();
    await waitFor(() => expect(screen.getByText('Herramientas')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /nueva categoría/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('muestra error TIENE_PRODUCTOS cuando desactivar falla', async () => {
    mockDesactivar.mockRejectedValue(new Error('TIENE_PRODUCTOS:3'));
    render_();
    await waitFor(() => expect(screen.getByText('Herramientas')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /desactivar/i })[0]);
    await waitFor(() =>
      expect(screen.getByText(/tiene 3 producto/i)).toBeInTheDocument()
    );
  });

  it('ADR-082: rutea VALIDATION:nombre del backend a un error inline en el campo nombre', async () => {
    mockCreate.mockRejectedValue(new Error('VALIDATION:nombre:TIPO'));
    render_();
    await waitFor(() => expect(screen.getByText('Herramientas')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /nueva categoría/i }));

    const nombreInput = screen.getByLabelText('Nombre *');
    fireEvent.change(nombreInput, { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    const inline = await screen.findByText('El valor tiene un formato inválido.');
    expect(inline).toHaveClass('field-error');
    expect(nombreInput).toHaveClass('error');
  });
});
