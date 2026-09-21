import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecalcularModal } from '../RecalcularModal';

const CATEGORIAS = [
  { id: 'c1', nombre: 'Herramientas' },
  { id: 'c2', nombre: 'Electricidad' },
];
const MARCAS = [
  { id: 'm1', nombre: 'Stanley' },
  { id: 'm2', nombre: 'Bosch' },
];
const PROVEEDORES = [
  { id: 'p1', razon_social: 'Dist. Norte S.A.' },
  { id: 'p2', razon_social: 'Ferro Total' },
];

const mockContarAfectados = vi.fn();
const mockRecalcular = vi.fn();
const mockCategoriaList = vi.fn();
const mockMarcaList = vi.fn();
const mockProveedorList = vi.fn();

const onClose = vi.fn();
const onSuccess = vi.fn();

function renderModal() {
  return render(
    <MemoryRouter>
      <RecalcularModal
        listaId="l1"
        listaNombre="Lista General"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCategoriaList.mockResolvedValue(CATEGORIAS);
  mockMarcaList.mockResolvedValue(MARCAS);
  mockProveedorList.mockResolvedValue(PROVEEDORES);
  mockContarAfectados.mockResolvedValue(5);
  mockRecalcular.mockResolvedValue(undefined);
  (window as any).ferreteria = {
    catalogo: {
      categoria: { list: mockCategoriaList },
      marca: { list: mockMarcaList },
    },
    compras: { proveedor: { list: mockProveedorList } },
    precios: {
      valor: {
        contarAfectados: mockContarAfectados,
        recalcularMasivo: mockRecalcular,
      },
      cambioProgramado: { crear: vi.fn() },
    },
  };
});

describe('RecalcularModal — alcance', () => {
  it('con alcance "catalogo" no muestra selector de entidad', async () => {
    renderModal();
    await waitFor(() => expect(screen.queryByRole('combobox', { name: /rubro|marca|proveedor/i })).not.toBeInTheDocument());
    expect(mockCategoriaList).not.toHaveBeenCalled();
  });

  it('al elegir alcance "rubro" muestra un select con las categorías', async () => {
    renderModal();

    fireEvent.change(screen.getByDisplayValue('Catálogo completo'), { target: { value: 'rubro' } });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Herramientas' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Electricidad' })).toBeInTheDocument();
    });
    expect(mockCategoriaList).toHaveBeenCalledOnce();
  });

  it('al elegir alcance "marca" muestra un select con las marcas', async () => {
    renderModal();

    fireEvent.change(screen.getByDisplayValue('Catálogo completo'), { target: { value: 'marca' } });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Stanley' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Bosch' })).toBeInTheDocument();
    });
    expect(mockMarcaList).toHaveBeenCalledOnce();
  });

  it('al elegir alcance "proveedor" muestra un select con los proveedores', async () => {
    renderModal();

    fireEvent.change(screen.getByDisplayValue('Catálogo completo'), { target: { value: 'proveedor' } });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Dist. Norte S.A.' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Ferro Total' })).toBeInTheDocument();
    });
    expect(mockProveedorList).toHaveBeenCalledOnce();
  });

  it('seleccionar una categoría asigna su id al alcance_id', async () => {
    renderModal();

    fireEvent.change(screen.getByDisplayValue('Catálogo completo'), { target: { value: 'rubro' } });

    await waitFor(() => expect(screen.getByRole('option', { name: 'Herramientas' })).toBeInTheDocument());

    const alcanceSelect = screen.getAllByRole('combobox').find(
      el => el.querySelector?.('option[value="c1"]') || el.innerHTML.includes('Herramientas')
    );
    fireEvent.change(alcanceSelect!, { target: { value: 'c1' } });

    fireEvent.click(screen.getByRole('button', { name: /calcular productos afectados/i }));

    await waitFor(() => expect(mockContarAfectados).toHaveBeenCalledWith(
      expect.objectContaining({ alcance: 'rubro', alcance_id: 'c1' })
    ));
  });

  it('volver a "catalogo" oculta el selector de entidad', async () => {
    renderModal();

    const alcanceSelect = screen.getByDisplayValue('Catálogo completo');
    fireEvent.change(alcanceSelect, { target: { value: 'marca' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Stanley' })).toBeInTheDocument());

    // El select de alcance ahora muestra 'Marca'; lo buscamos por su valor actual
    fireEvent.change(screen.getByDisplayValue('Marca'), { target: { value: 'catalogo' } });

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Stanley' })).not.toBeInTheDocument();
    });
  });
});

// ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form, en el
// flujo "programar cambio" (cambioProgramado.crear).
describe('RecalcularModal — ruteo de error de validación al programar (ADR-085)', () => {
  async function irAProgramado() {
    renderModal();
    await waitFor(() => expect(screen.getByDisplayValue('Catálogo completo')).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue('Aplicar ahora'), { target: { value: 'programado' } });
    fireEvent.click(screen.getByRole('button', { name: /calcular productos afectados/i }));
    await waitFor(() => expect(mockContarAfectados).toHaveBeenCalled());
  }

  it('rutea VALIDATION:fecha_aplicacion:TIPO al input de fecha y lo enfoca', async () => {
    (window as any).ferreteria.precios.cambioProgramado.crear =
      vi.fn().mockRejectedValue(new Error('VALIDATION:fecha_aplicacion:TIPO'));
    await irAProgramado();

    fireEvent.click(screen.getByRole('button', { name: /programar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('fecha_aplicacion')));
    expect(await screen.findByText(/formato inválido/i)).toBeInTheDocument();
  });

  it('rutea VALIDATION:porcentaje:TIPO al input de porcentaje y lo enfoca', async () => {
    (window as any).ferreteria.precios.cambioProgramado.crear =
      vi.fn().mockRejectedValue(new Error('VALIDATION:porcentaje:TIPO'));
    await irAProgramado();

    fireEvent.click(screen.getByRole('button', { name: /programar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('porcentaje')));
    expect(await screen.findByText(/formato inválido/i)).toBeInTheDocument();
  });

  it('rutea VALIDATION:alcance:ENUM al select de alcance y lo enfoca', async () => {
    (window as any).ferreteria.precios.cambioProgramado.crear =
      vi.fn().mockRejectedValue(new Error('VALIDATION:alcance:ENUM'));
    await irAProgramado();

    fireEvent.click(screen.getByRole('button', { name: /programar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('alcance')));
    expect(await screen.findByText(/no es válido/i)).toBeInTheDocument();
  });

  it('un error de campo no ruteable (lista_precio_id) cae en el error general del modal', async () => {
    (window as any).ferreteria.precios.cambioProgramado.crear =
      vi.fn().mockRejectedValue(new Error('VALIDATION:lista_precio_id:TIPO'));
    await irAProgramado();

    fireEvent.click(screen.getByRole('button', { name: /programar/i }));

    await waitFor(() => expect(screen.getByText(/formato inválido/i)).toBeInTheDocument());
    expect(document.activeElement).not.toBe(document.getElementById('fecha_aplicacion'));
  });

  it('crear exitoso llama a onSuccess y onClose', async () => {
    (window as any).ferreteria.precios.cambioProgramado.crear = vi.fn().mockResolvedValue({ id: 'cp1' });
    await irAProgramado();

    fireEvent.click(screen.getByRole('button', { name: /programar/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('RecalcularModal — cierre con Escape', () => {
  it('llama a onClose al presionar Escape', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByDisplayValue('Catálogo completo')).toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('NO cierra con Escape mientras está contando productos afectados', async () => {
    let resolveContar: (n: number) => void = () => {};
    mockContarAfectados.mockReturnValue(new Promise<number>((resolve) => { resolveContar = resolve; }));
    renderModal();
    await waitFor(() => expect(screen.getByDisplayValue('Catálogo completo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /calcular productos afectados/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /calcular productos afectados/i })).toBeDisabled());

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    resolveContar(5);
  });
});
