import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProveedoresPanel } from './ProveedoresPanel';

const mockList = vi.fn();
const mockSetOverrides = vi.fn();
const mockSetPreferido = vi.fn();
const mockGetParam = vi.fn();

// Fila Bosch estilo mockup, en centavos: bruto $10.000, bonif default 10%, sin overrides.
const FILA_HEREDA = {
  id: 'pp-1',
  proveedor_id: 'prov-1',
  razon_social: 'Bosch Argentina SA',
  costo_centavos: 1000000,
  codigo_proveedor: 'BSH-7700',
  preferido: true,
  bonificacion_pct: null,
  costo_financiero_pct: null,
  flete_pct: null,
  flete_centavos: null,
  otros_costos_centavos: null,
  bonificacion_pct_default: 10,
  costo_financiero_pct_default: 0,
  flete_pct_default: 0,
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <ProveedoresPanel productoId="p1" />
    </MemoryRouter>,
  );
}

// Segunda fila (proveedor B), NO preferida, para poder cambiar el preferido.
const FILA_NO_PREF = {
  id: 'pp-2',
  proveedor_id: 'prov-2',
  razon_social: 'Distribuidora Beta SA',
  costo_centavos: 800000,
  codigo_proveedor: 'BETA-01',
  preferido: false,
  bonificacion_pct: null,
  costo_financiero_pct: null,
  flete_pct: null,
  flete_centavos: null,
  otros_costos_centavos: null,
  bonificacion_pct_default: 0,
  costo_financiero_pct_default: 0,
  flete_pct_default: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue([FILA_HEREDA]);
  mockSetOverrides.mockResolvedValue({ id: 'pp-1' });
  mockSetPreferido.mockResolvedValue({ id: 'pp-2' });
  mockGetParam.mockResolvedValue('true'); // flag encendido
  (window as any).ferreteria = {
    parametros: { get: mockGetParam },
    compras: {
      pp: { listByProducto: mockList, setOverrides: mockSetOverrides, setPreferido: mockSetPreferido },
    },
  };
});

describe('ProveedoresPanel — costo neto (ADR-049, flag ON)', () => {
  it('muestra el costo neto desglosado del proveedor (bonif. heredada 10% → $9.000)', async () => {
    renderPanel();
    // bruto 10.000 con bonificación 10% => neto 9.000
    expect(await screen.findByText(/9\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/Bosch Argentina SA/)).toBeInTheDocument();
  });

  it('permite cargar un override y lo guarda vía compras.pp.setOverrides', async () => {
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    // abrir el editor de overrides de la fila
    fireEvent.click(screen.getByRole('button', { name: /ajustar costos/i }));
    // cargar bonificación 12% como override
    const bonif = await screen.findByLabelText(/Bonif/i);
    fireEvent.change(bonif, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(mockSetOverrides).toHaveBeenCalledTimes(1));
    const [id, patch] = mockSetOverrides.mock.calls[0];
    expect(id).toBe('pp-1');
    expect(patch.bonificacion_pct).toBe(12);
    expect(patch.costo_financiero_pct).toBeNull();
  });

  it('clic en el indicador Pref. de una fila no preferida la marca vía compras.pp.setPreferido', async () => {
    mockList.mockResolvedValue([FILA_HEREDA, FILA_NO_PREF]);
    renderPanel();
    await screen.findByText(/Distribuidora Beta SA/);
    // El indicador de preferido de la fila B es un control accionable.
    const btn = screen.getByRole('button', { name: /marcar.*preferido/i });
    fireEvent.click(btn);
    await waitFor(() => expect(mockSetPreferido).toHaveBeenCalledTimes(1));
    expect(mockSetPreferido).toHaveBeenCalledWith('pp-2');
  });

  it('actualiza el preferido de forma optimista (la fila B pasa a preferida sin esperar refetch)', async () => {
    mockList.mockResolvedValue([FILA_HEREDA, FILA_NO_PREF]);
    // El IPC nunca resuelve durante el test: si la UI muestra el cambio, es optimista.
    mockSetPreferido.mockReturnValue(new Promise(() => {}));
    renderPanel();
    await screen.findByText(/Distribuidora Beta SA/);
    const filaB = screen.getByText(/Distribuidora Beta SA/).closest('tr')!;
    fireEvent.click(within(filaB).getByRole('button', { name: /marcar.*preferido/i }));
    // Optimista: la fila B queda marcada como preferida (ya no es "marcar como preferido").
    await waitFor(() =>
      expect(within(filaB).queryByRole('button', { name: /marcar.*preferido/i })).not.toBeInTheDocument(),
    );
    expect(within(filaB).getByText('●')).toBeInTheDocument();
  });

  it('si setPreferido falla, revierte el cambio optimista y muestra error', async () => {
    mockList.mockResolvedValue([FILA_HEREDA, FILA_NO_PREF]);
    mockSetPreferido.mockRejectedValue(new Error('IPC caído'));
    renderPanel();
    await screen.findByText(/Distribuidora Beta SA/);
    const filaB = screen.getByText(/Distribuidora Beta SA/).closest('tr')!;
    fireEvent.click(within(filaB).getByRole('button', { name: /marcar.*preferido/i }));
    // Tras el rechazo, la fila B vuelve a ser no preferida (rollback) y se muestra el error.
    await screen.findByText(/IPC caído/);
    expect(within(filaB).getByRole('button', { name: /marcar.*preferido/i })).toBeInTheDocument();
  });

  it('cierra el editor de overrides con Escape', async () => {
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    fireEvent.click(screen.getByRole('button', { name: /ajustar costos/i }));
    await screen.findByLabelText(/Bonif/i);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByLabelText(/Bonif/i)).not.toBeInTheDocument();
  });

  it('prellena Costo bruto y los % con el valor efectivo (0), no "hereda"', async () => {
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    fireEvent.click(screen.getByRole('button', { name: /ajustar costos/i }));
    expect(await screen.findByLabelText(/Costo bruto/i)).toHaveValue(10000);
    expect(screen.getByLabelText(/Bonif/i)).toHaveValue(10);       // default proveedor, no vacío
    expect(screen.getByLabelText(/Cost\. fin/i)).toHaveValue(0);   // 0, no "hereda"
  });

  it('guardar sin cambiar un % lo manda como null (sigue heredando) y manda el costo', async () => {
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    fireEvent.click(screen.getByRole('button', { name: /ajustar costos/i }));
    await screen.findByLabelText(/Costo bruto/i);
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(mockSetOverrides).toHaveBeenCalledTimes(1));
    const [id, patch] = mockSetOverrides.mock.calls[0];
    expect(id).toBe('pp-1');
    expect(patch.bonificacion_pct).toBeNull();       // 10 == default 10 → null
    expect(patch.costo_financiero_pct).toBeNull();
    expect(patch.flete_pct).toBeNull();
    expect(patch.costo_centavos).toBe(1000000);      // costo bruto sin cambiar
  });

  it('cambiar un % lo guarda como override numérico', async () => {
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    fireEvent.click(screen.getByRole('button', { name: /ajustar costos/i }));
    const bonif = await screen.findByLabelText(/Bonif/i);
    fireEvent.change(bonif, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(mockSetOverrides).toHaveBeenCalledTimes(1));
    const [, patch] = mockSetOverrides.mock.calls[0];
    expect(patch.bonificacion_pct).toBe(15);
  });

  it('editar el Costo bruto lo manda en costo_centavos', async () => {
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    fireEvent.click(screen.getByRole('button', { name: /ajustar costos/i }));
    const costo = await screen.findByLabelText(/Costo bruto/i);
    fireEvent.change(costo, { target: { value: '12000' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(mockSetOverrides).toHaveBeenCalledTimes(1));
    const [, patch] = mockSetOverrides.mock.calls[0];
    expect(patch.costo_centavos).toBe(1200000);
  });

  it('Flete $ vacío se guarda como null (nunca 0)', async () => {
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    fireEvent.click(screen.getByRole('button', { name: /ajustar costos/i }));
    await screen.findByLabelText(/Costo bruto/i);
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => expect(mockSetOverrides).toHaveBeenCalledTimes(1));
    const [, patch] = mockSetOverrides.mock.calls[0];
    expect(patch.flete_centavos).toBeNull();
  });
});

describe('ProveedoresPanel — ADR-085 (SEC-2) ruteo del error de validación del backend', () => {
  it('rutea VALIDATION:bonificacion_pct al input de bonificación', async () => {
    mockSetOverrides.mockRejectedValue(new Error('VALIDATION:bonificacion_pct:TIPO'));
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    fireEvent.click(screen.getByRole('button', { name: /ajustar costos/i }));
    await screen.findByLabelText(/Costo bruto/i);
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('pp_ov_bonificacion_pct')));
    expect(await screen.findAllByText(/formato inválido/i)).not.toHaveLength(0);
  });

  it('rutea VALIDATION:flete_centavos al input de flete $', async () => {
    mockSetOverrides.mockRejectedValue(new Error('VALIDATION:flete_centavos:NEGATIVO'));
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    fireEvent.click(screen.getByRole('button', { name: /ajustar costos/i }));
    await screen.findByLabelText(/Costo bruto/i);
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('pp_ov_flete_centavos')));
  });
});

describe('ProveedoresPanel — flag OFF conserva el comportamiento actual', () => {
  it('sin flag, muestra la lista simple (link al proveedor), sin columnas de costo neto', async () => {
    mockGetParam.mockResolvedValue('false');
    renderPanel();
    await screen.findByText(/Bosch Argentina SA/);
    // no aparece el editor de overrides con el flag apagado
    expect(screen.queryByRole('button', { name: /ajustar costos/i })).not.toBeInTheDocument();
  });
});
