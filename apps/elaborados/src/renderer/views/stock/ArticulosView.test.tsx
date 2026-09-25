import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ArticulosView } from './ArticulosView';

const mockCan = vi.fn().mockReturnValue(true);
vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: mockCan }),
}));

const ARTICULOS_BASE = [
  { id: '1', nombre: 'Harina 000', tipo: 'insumo', unidad: 'kg', bloquea_sin_stock: true, stock_minimo: 5, costo_promedio_centavos: 100, activo: true, stock: 20 },
  { id: '2', nombre: 'Torta de chocolate', tipo: 'elaborado', unidad: 'u', bloquea_sin_stock: false, stock_minimo: null, costo_promedio_centavos: 500, activo: true, stock: -3 },
];

const mockList = vi.fn();
const mockCreate = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockRecetaGet = vi.fn();
const mockRecetaSet = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('elaborados', {
  articulo: {
    list: mockList,
    get: vi.fn(),
    create: mockCreate,
    update: mockUpdate,
  },
  movimientoArticulo: {
    list: vi.fn(),
    create: vi.fn(),
  },
  recetaProduccion: {
    get: mockRecetaGet,
    set: mockRecetaSet,
  },
});

function renderView() {
  return render(<MemoryRouter><ArticulosView /></MemoryRouter>);
}

describe('ArticulosView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCan.mockReturnValue(true);
    mockList.mockResolvedValue(ARTICULOS_BASE.map((a) => ({ ...a })));
    mockCreate.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockRecetaGet.mockResolvedValue(null);
    mockRecetaSet.mockResolvedValue(undefined);
  });

  it('muestra los articulos cargados', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());
    expect(screen.getByText('Torta de chocolate')).toBeInTheDocument();
  });

  it('el checkbox "Solo en negativo" filtra y la badge de alerta solo aparece con negativos', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    // Hay un artículo con stock < 0 -> la badge de alerta está presente.
    expect(screen.getByText('!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /solo en negativo/i }));

    expect(screen.queryByText('Harina 000')).not.toBeInTheDocument();
    expect(screen.getByText('Torta de chocolate')).toBeInTheDocument();
  });

  it('no muestra la badge de alerta cuando ningún articulo está en negativo', async () => {
    mockList.mockResolvedValue(ARTICULOS_BASE.map((a) => ({ ...a, stock: 10 })));
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());
    expect(screen.queryByText('!')).not.toBeInTheDocument();
  });

  it('"+ Nuevo artículo" abre el modal en modo creación con selects de tipo y unidad', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nuevo artículo/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/tipo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/unidad/i)).toBeInTheDocument();
  });

  it('"Editar" abre el modal en modo edición sin selects de tipo ni unidad', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^tipo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^unidad/i)).not.toBeInTheDocument();
  });

  it('al enviar el formulario de creación llama a articulo.create con el payload correcto', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nuevo artículo/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Azúcar' } });
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: 'reventa' } });
    fireEvent.change(screen.getByLabelText(/unidad/i), { target: { value: 'l' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({
      nombre: 'Azúcar',
      tipo: 'reventa',
      unidad: 'l',
      bloquea_sin_stock: true,
      stock_minimo: null,
    }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('al enviar el formulario de edición llama a articulo.update con el payload correcto', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Harina 0000' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar$/i }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({
      id: '1',
      nombre: 'Harina 0000',
      bloquea_sin_stock: true,
      stock_minimo: 5,
    }));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('oculta los botones de alta/edición cuando el usuario no tiene el permiso', async () => {
    mockCan.mockReturnValue(false);
    renderView();
    await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /nuevo artículo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });

  describe('edición de receta', () => {
    it('muestra el botón "Receta" solo para artículos elaborados y con el permiso receta.gestionar', async () => {
      renderView();
      await waitFor(() => expect(screen.getByText('Harina 000')).toBeInTheDocument());

      // Harina 000 (insumo) no tiene botón Receta; Torta de chocolate (elaborado) sí.
      const filaHarina = screen.getByText('Harina 000').closest('tr')!;
      const filaTorta = screen.getByText('Torta de chocolate').closest('tr')!;
      expect(within(filaHarina).queryByRole('button', { name: /receta/i })).not.toBeInTheDocument();
      expect(within(filaTorta).getByRole('button', { name: /receta/i })).toBeInTheDocument();
    });

    it('oculta el botón "Receta" cuando el usuario no tiene el permiso receta.gestionar', async () => {
      mockCan.mockImplementation((codigo: string) => codigo !== 'receta.gestionar');
      renderView();
      await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

      expect(screen.queryByRole('button', { name: /receta/i })).not.toBeInTheDocument();
    });

    it('al abrir "Receta" sin receta previa, muestra un ítem vacío para completar', async () => {
      mockRecetaGet.mockResolvedValue(null);
      renderView();
      await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /receta/i }));

      await waitFor(() => expect(mockRecetaGet).toHaveBeenCalledWith({ articulo_id: '2' }));
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/rinde/i)).toHaveValue(12);
      expect(screen.getByPlaceholderText(/cantidad/i)).toHaveValue(null);
      // El select de insumo default es "Harina 000" (único insumo disponible).
      expect(screen.getByRole('combobox')).toHaveValue('1');
    });

    it('al abrir "Receta" con receta existente, precarga rinde e ítems', async () => {
      mockRecetaGet.mockResolvedValue({
        rinde_cantidad: 24,
        items: [{ articulo_id: '1', cantidad: 2.5 }],
      });
      renderView();
      await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /receta/i }));

      await waitFor(() => expect(screen.getByLabelText(/rinde/i)).toHaveValue(24));
      expect(screen.getByPlaceholderText(/cantidad/i)).toHaveValue(2.5);
    });

    it('al guardar la receta llama a recetaProduccion.set con el payload correcto', async () => {
      mockRecetaGet.mockResolvedValue(null);
      renderView();
      await waitFor(() => expect(screen.getByText('Torta de chocolate')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /receta/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/rinde/i), { target: { value: '10' } });
      fireEvent.change(screen.getByPlaceholderText(/cantidad/i), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: /guardar receta/i }));

      await waitFor(() => expect(mockRecetaSet).toHaveBeenCalledWith({
        articulo_id: '2',
        rinde_cantidad: 10,
        items: [{ articulo_id: '1', cantidad: 3 }],
      }));
    });
  });
});
