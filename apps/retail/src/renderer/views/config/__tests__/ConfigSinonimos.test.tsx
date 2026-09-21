import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigSinonimos } from '../ConfigSinonimos';

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockImportarValidar = vi.fn();
const mockImportar = vi.fn();
const mockGetParam = vi.fn();
const mockSetParam = vi.fn();

const GRUPO = {
  grupo_id: 'g1', canonico: 'alicate', sinonimos: ['pinza', 'tenaza'], abreviaturas: ['alic.'],
  rubro: 'Herramientas', nota: null, origen: 'seed', total_terminos: 4,
};

function setup() {
  (window as any).ferreteria = {
    sinonimo: { list: mockList, create: mockCreate, update: mockUpdate, delete: mockDelete, importarValidar: mockImportarValidar, importar: mockImportar },
    parametros: { get: mockGetParam, set: mockSetParam },
  };
}

const renderView = () => render(<MemoryRouter><ConfigSinonimos /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([GRUPO]);
  mockCreate.mockResolvedValue({ ...GRUPO, grupo_id: 'g2' });
  mockUpdate.mockResolvedValue(GRUPO);
  mockDelete.mockResolvedValue({ eliminados: 4 });
  mockImportarValidar.mockResolvedValue({ grupos: 2, errores: [], advertencias: [] });
  mockImportar.mockResolvedValue({ grupos: 2, gruposImportados: 2, errores: [], advertencias: [] });
  mockGetParam.mockResolvedValue('false');
  mockSetParam.mockResolvedValue(undefined);
  setup();
});

describe('ConfigSinonimos', () => {
  it('lista los grupos al montar', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('alicate')).toBeInTheDocument());
    expect(screen.getByText('pinza, tenaza')).toBeInTheDocument();
    expect(screen.getByText('alic.')).toBeInTheDocument();
  });

  it('muestra el estado del flag y lo activa', async () => {
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledWith({ clave: 'sinonimos_habilitado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(mockSetParam).toHaveBeenCalledWith({ clave: 'sinonimos_habilitado', valor: 'true' }));
  });

  it('muestra el estado del flag de búsqueda por similitud y lo activa', async () => {
    renderView();
    await waitFor(() => expect(mockGetParam).toHaveBeenCalledWith({ clave: 'busqueda_similares_habilitado' }));
    fireEvent.click(screen.getByRole('button', { name: /Activar búsqueda por similitud/i }));
    await waitFor(() => expect(mockSetParam).toHaveBeenCalledWith({ clave: 'busqueda_similares_habilitado', valor: 'true' }));
  });

  it('crea un grupo nuevo', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('alicate')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    fireEvent.change(screen.getByLabelText(/Término canónico/i), { target: { value: 'martillo' } });
    fireEvent.change(screen.getByLabelText(/Sinónimos \(separados/i), { target: { value: 'maceta, hammer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ canonico: 'martillo', sinonimos: ['maceta', 'hammer'] }),
    ));
  });

  it('no permite guardar sin canónico', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('alicate')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/canónico es obligatorio/i);
  });

  it('rutea el error de validación del backend al campo canonico (ADR-085)', async () => {
    mockCreate.mockRejectedValue(new Error('VALIDATION:canonico:REQUERIDO'));
    renderView();
    await waitFor(() => expect(screen.getByText('alicate')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
    fireEvent.change(screen.getByLabelText(/Término canónico/i), { target: { value: 'martillo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('canonico')));
    expect(await screen.findByText(/obligatorio/i)).toBeInTheDocument();
  });

  it('importa un CSV: previsualiza y confirma', async () => {
    const { container } = renderView();
    await waitFor(() => expect(screen.getByText('alicate')).toBeInTheDocument());
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['canonico,sinonimos,abreviaturas,rubro,nota\nalicate,pinza,,,'], 'sin.csv', { type: 'text/csv' });
    fireEvent.change(input, { target: { files: [file] } });
    // preview
    await waitFor(() => expect(mockImportarValidar).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('dialog', { name: /Importar sinónimos/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    await waitFor(() => expect(mockImportar).toHaveBeenCalled());
  });

  it('elimina un grupo con confirmación', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderView();
    await waitFor(() => expect(screen.getByText('alicate')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ grupo_id: 'g1' }));
    confirmSpy.mockRestore();
  });

  it('ADR-069: la tabla usa el contenedor estándar .table-wrap', async () => {
    renderView();
    await waitFor(() => expect(screen.getByText('alicate')).toBeInTheDocument());
    expect(document.querySelector('.table-wrap')).not.toBeNull();
  });

  it('ADR-069: clic en la fila abre la edición del grupo', async () => {
    renderView();
    const canonico = await screen.findByText('alicate');
    fireEvent.click(canonico.closest('tr')!);
    expect(screen.getByDisplayValue('alicate')).toBeInTheDocument();
  });

  it('ADR-069: clic en Eliminar no abre la edición', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderView();
    await waitFor(() => expect(screen.getByText('alicate')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(screen.queryByDisplayValue('alicate')).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
