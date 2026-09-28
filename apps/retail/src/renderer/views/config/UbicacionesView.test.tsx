import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { UbicacionesView } from './UbicacionesView';

const mockCan = vi.fn(() => true);

// ExportarButton vive ahora en @core/ui y usa useAuth internamente por ruta relativa
// (no vía el barrel), así que overridear useAuth del barrel no lo alcanza; se mockea el
// componente entero, igual que el resto de las vistas del repo que renderizan <ExportarButton>.
vi.mock('@core/ui', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
  ExportarButton: () => null,
}));

const rows = [
  { id: 'u1', codigo: 'A-0-1', sector: 'A', estante: '0', posicion: '1', descripcion: 'Frente', activo: true, cantidad_productos: 0 },
  { id: 'u2', codigo: 'B-1-2', sector: 'B', estante: '1', posicion: '2', descripcion: null, activo: true, cantidad_productos: 3 },
];

beforeEach(() => {
  (globalThis as any).ferreteria = {
    catalogo: { ubicacion: {
      listAll: vi.fn().mockResolvedValue(rows),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      dedupPreview: vi.fn().mockResolvedValue([]),
      dedupAplicar: vi.fn(),
    } },
  };
});

describe('UbicacionesView', () => {
  it('lista las ubicaciones con su código canónico', async () => {
    render(<UbicacionesView />);
    await waitFor(() => expect(screen.getByText('A-0-1')).toBeInTheDocument());
    expect(screen.getByText('B-1-2')).toBeInTheDocument();
  });

  it('muestra el conteo de duplicados detectados al abrir dedup', async () => {
    (globalThis as any).ferreteria.catalogo.ubicacion.dedupPreview = vi.fn().mockResolvedValue([
      { codigo: 'A-0-1', sobreviviente: { id: 'u1', codigo: 'A-0-1' }, duplicados: [{ id: 'u9', codigo: 'A-0-01' }], productos_a_reasignar: 2 },
    ]);
    const { getByText } = render(<UbicacionesView />);
    await waitFor(() => expect(getByText('A-0-1')).toBeInTheDocument());
    await act(async () => { getByText('Detectar duplicados').click(); });
    await waitFor(() => expect(getByText(/1 grupo/i)).toBeInTheDocument());
  });

  it('ADR-082: rutea VALIDATION:sector del backend a un error inline en el campo sector', async () => {
    (globalThis as any).ferreteria.catalogo.ubicacion.create =
      vi.fn().mockRejectedValue(new Error('VALIDATION:sector:REQUERIDO'));
    render(<UbicacionesView />);
    await waitFor(() => expect(screen.getByText('A-0-1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nueva ubicación/i }));
    fireEvent.change(screen.getByLabelText('Sector *'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('Estante *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Posición *'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    const inline = await screen.findByText('Este campo es obligatorio.');
    expect(inline).toHaveClass('field-error');
    expect(screen.getByLabelText('Sector *')).toHaveClass('error');
  });

  it('muestra el error cuando "Fusionar duplicados" falla (antes quedaba en silencio)', async () => {
    (globalThis as any).ferreteria.catalogo.ubicacion.dedupPreview = vi.fn().mockResolvedValue([
      { codigo: 'A-0-1', sobreviviente: { id: 'u1', codigo: 'A-0-1' }, duplicados: [{ id: 'u9', codigo: 'A-0-01' }], productos_a_reasignar: 2 },
    ]);
    (globalThis as any).ferreteria.catalogo.ubicacion.dedupAplicar = vi.fn().mockRejectedValue(new Error('UBICACION_EN_USO'));
    render(<UbicacionesView />);
    await waitFor(() => expect(screen.getByText('A-0-1')).toBeInTheDocument());

    await act(async () => { screen.getByText('Detectar duplicados').click(); });
    await waitFor(() => expect(screen.getByText(/1 grupo/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /fusionar duplicados/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('UBICACION_EN_USO'));
    // el diálogo sigue abierto y el botón vuelve a estar disponible, no queda inerte
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fusionar duplicados/i })).toBeEnabled();
  });
});
