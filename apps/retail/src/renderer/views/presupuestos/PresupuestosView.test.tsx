import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PresupuestosView } from './PresupuestosView';
import { __resetPersistentListState } from '@core/ui';

const navigateSpy = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

// El form y el detalle son unidades aparte; los stubeamos para aislar la vista lista.
vi.mock('./PresupuestoFormModal', () => ({
  PresupuestoFormModal: ({ onGuardado }: any) => (
    <div data-testid="form-modal"><button type="button" onClick={onGuardado}>guardar-stub</button></div>
  ),
}));
vi.mock('./PresupuestoDetalleModal', () => ({
  PresupuestoDetalleModal: ({ presupuestoId }: any) => (
    <div data-testid="detalle-modal">detalle {presupuestoId}</div>
  ),
}));

const listar = vi.fn();
const emitir = vi.fn();
const anular = vi.fn();
const imprimir = vi.fn();
const config = vi.fn();

beforeEach(() => {
  __resetPersistentListState();
  navigateSpy.mockReset();
  [listar, emitir, anular, imprimir, config].forEach((f) => f.mockReset());
  config.mockResolvedValue({ validez_dias_default: 15 });
  emitir.mockResolvedValue({});
  anular.mockResolvedValue({});
  imprimir.mockResolvedValue({ guardado: true });
  (globalThis as any).ferreteria = {
    presupuesto: { listar, emitir, anular, imprimir, config },
    parametros: { get: vi.fn().mockResolvedValue('false') },
  };
});

function unPresupuesto(over: Partial<any> = {}) {
  return {
    id: 'p1', numero: 'PR-0000001', numero_secuencial: 1, estado: 'emitido',
    fecha_emision: Date.now(), fecha_validez: Date.now() + 86400000, validez_dias: 15,
    total_centavos: 180000, cliente_id: 'c1', cliente_nombre_completo: 'Ferreteria Sur',
    venta_id: null, creado_en: Date.now(), ...over,
  };
}

function renderView() {
  return render(<MemoryRouter><PresupuestosView /></MemoryRouter>);
}

describe('PresupuestosView', () => {
  it('lista presupuestos con numero, cliente y total formateado', async () => {
    listar.mockResolvedValue([unPresupuesto()]);
    renderView();
    expect(await screen.findByText('PR-0000001')).toBeInTheDocument();
    expect(screen.getByText('Ferreteria Sur')).toBeInTheDocument();
    expect(screen.getByText(/1\.800,00/)).toBeInTheDocument();
    expect(screen.getByText('Emitido', { selector: 'span.badge-warn' })).toBeInTheDocument();
  });

  it('un emitido ofrece Convertir y PDF, y Convertir navega al POS con el id', async () => {
    listar.mockResolvedValue([unPresupuesto()]);
    renderView();
    const convertir = await screen.findByText('Convertir');
    fireEvent.click(convertir);
    expect(navigateSpy).toHaveBeenCalledWith('/pos', { state: { presupuestoId: 'p1' } });
  });

  it('un borrador se puede Editar y Emitir; emitir usa la validez del modal', async () => {
    listar.mockResolvedValue([unPresupuesto({ estado: 'borrador', numero: null })]);
    renderView();
    fireEvent.click(await screen.findByText('Emitir'));
    // modal de emision
    fireEvent.click(await screen.findByText('Confirmar emisión'));
    await waitFor(() => expect(emitir).toHaveBeenCalledWith({ id: 'p1', validez_dias: 15 }));
  });

  it('anula un presupuesto tras confirmar', async () => {
    listar.mockResolvedValue([unPresupuesto()]);
    renderView();
    fireEvent.click(await screen.findByText('Anular'));
    fireEvent.click(await screen.findByText('Confirmar anulación'));
    await waitFor(() => expect(anular).toHaveBeenCalledWith({ id: 'p1' }));
  });

  it('ADR-085 (SEC-2): emitir rechazado por validez_dias muestra error inline y enfoca el control', async () => {
    listar.mockResolvedValue([unPresupuesto({ estado: 'borrador', numero: null })]);
    emitir.mockRejectedValue(new Error('VALIDATION:validez_dias:MIN:0'));
    renderView();
    fireEvent.click(await screen.findByText('Emitir'));
    fireEvent.click(await screen.findByText('Confirmar emisión'));

    expect(await screen.findByText('Ingresá un valor mayor o igual a 0.')).toBeInTheDocument();
    expect(document.getElementById('validez_dias')).toHaveFocus();
  });

  it('ADR-085 (SEC-2): anular rechazado por id cae en la región general de error del modal', async () => {
    listar.mockResolvedValue([unPresupuesto()]);
    anular.mockRejectedValue(new Error('VALIDATION:id:REQUERIDO'));
    renderView();
    fireEvent.click(await screen.findByText('Anular'));
    fireEvent.click(await screen.findByText('Confirmar anulación'));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Este campo es obligatorio.');
  });

  it('exporta PDF de un emitido', async () => {
    listar.mockResolvedValue([unPresupuesto()]);
    renderView();
    fireEvent.click(await screen.findByText('PDF'));
    await waitFor(() => expect(imprimir).toHaveBeenCalledWith({ id: 'p1' }));
  });

  it('al hacer click en una fila abre el detalle (en cualquier estado)', async () => {
    listar.mockResolvedValue([unPresupuesto({ id: 'px', estado: 'convertido' })]);
    renderView();
    await screen.findByRole('combobox');
    // fuerzo estado "Todos" para que un convertido sea visible
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.click(await screen.findByText('Ferreteria Sur')); // celda cliente (no es botón)
    expect(await screen.findByTestId('detalle-modal')).toHaveTextContent('detalle px');
  });

  it('por defecto muestra solo Borrador + Emitido (oculta convertido/anulado)', async () => {
    listar.mockResolvedValue([
      unPresupuesto({ id: 'b', numero: null, numero_secuencial: null, estado: 'borrador' }),
      unPresupuesto({ id: 'e', numero: 'PR-0000002', numero_secuencial: 2, estado: 'emitido' }),
      unPresupuesto({ id: 'c', numero: 'PR-0000003', numero_secuencial: 3, estado: 'convertido' }),
      unPresupuesto({ id: 'a', numero: 'PR-0000004', numero_secuencial: 4, estado: 'anulado' }),
    ]);
    renderView();
    expect(await screen.findByText('PR-0000002')).toBeInTheDocument();
    expect(screen.getByText('—', { selector: 'td.num' })).toBeInTheDocument(); // borrador sin número
    expect(screen.queryByText('PR-0000003')).not.toBeInTheDocument(); // convertido oculto
    expect(screen.queryByText('PR-0000004')).not.toBeInTheDocument(); // anulado oculto
  });

  it('busca por cliente o número de presupuesto', async () => {
    listar.mockResolvedValue([
      unPresupuesto({ id: '1', numero: 'PR-0000001', numero_secuencial: 1, cliente_nombre_completo: 'Ferreteria Norte' }),
      unPresupuesto({ id: '2', numero: 'PR-0000002', numero_secuencial: 2, cliente_nombre_completo: 'Kiosco Sur' }),
    ]);
    renderView();
    await screen.findByText('PR-0000001');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por cliente/), { target: { value: 'norte' } });
    expect(screen.getByText('PR-0000001')).toBeInTheDocument();
    expect(screen.queryByText('PR-0000002')).not.toBeInTheDocument();
  });

  it('ordena por Número al hacer click en el encabezado', async () => {
    listar.mockResolvedValue([
      unPresupuesto({ id: '1', numero: 'PR-0000001', numero_secuencial: 1 }),
      unPresupuesto({ id: '2', numero: 'PR-0000002', numero_secuencial: 2 }),
    ]);
    renderView();
    await screen.findByText('PR-0000001');
    // default: numero desc → PR-2 antes que PR-1
    let filas = screen.getAllByText(/PR-000000/);
    expect(filas[0]).toHaveTextContent('PR-0000002');
    // click en "Número" alterna a asc → PR-1 primero
    fireEvent.click(screen.getByRole('columnheader', { name: /Número/ }));
    filas = screen.getAllByText(/PR-000000/);
    expect(filas[0]).toHaveTextContent('PR-0000001');
  });
});
