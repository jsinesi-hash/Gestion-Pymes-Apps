import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RecepcionView } from './RecepcionView';

const mockGet = vi.fn();
const mockCrear = vi.fn();

const OC = {
  id: 'oc1', numero_interno: 'OC-C1-000001', proveedor_id: 'prov1',
  razon_social: 'Proveedor SA', estado: 'recibida_parcial',
  items: [{
    id: 'item1', producto_id: 'p1', descripcion: 'Tornillo',
    cantidad_pedida: 10, cantidad_recibida: 4, costo_unitario_centavos: 5000,
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(OC);
  mockCrear.mockResolvedValue({ id: 'rec1' });
  (window as any).ferreteria = {
    compras: { oc: { get: mockGet }, recepcion: { crear: mockCrear } },
  };
});

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/compras/ordenes/oc1/recibir']}>
      <Routes>
        <Route path="/compras/ordenes/:ocId/recibir" element={<RecepcionView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RecepcionView — ADR-066 recepción parcial', () => {
  it('pre-carga el campo con el pendiente (6)', async () => {
    renderView();
    const input = await screen.findByDisplayValue('6');
    expect(input).toBeTruthy();
  });

  it('deja EDITAR la cantidad a un valor menor sin revertir (regresión)', async () => {
    renderView();
    const input = await screen.findByDisplayValue('6') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    expect(input.value).toBe('4');
  });

  it('no revierte al máximo mientras se tipea un valor > pendiente (onChange no clampa)', async () => {
    renderView();
    const input = await screen.findByDisplayValue('6') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '64' } });
    expect(input.value).toBe('64');
  });

  it('clampa al pendiente en onBlur', async () => {
    renderView();
    const input = await screen.findByDisplayValue('6') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '64' } });
    fireEvent.blur(input);
    expect(input.value).toBe('6');
  });

  it('envía la cantidad editada al confirmar', async () => {
    renderView();
    const input = await screen.findByDisplayValue('6') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar recepción/i }));
    await waitFor(() => expect(mockCrear).toHaveBeenCalled());
    const payload = mockCrear.mock.calls[0][0];
    expect(payload.items).toEqual([{ item_oc_id: 'item1', cantidad_recibida: 4 }]);
  });

  it('onBlur con campo vacío normaliza a 0 (evita pérdida silenciosa de datos)', async () => {
    renderView();
    const input = await screen.findByDisplayValue('6') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('0');
  });

  it('onBlur con texto no numérico normaliza a 0', async () => {
    renderView();
    const input = await screen.findByDisplayValue('6') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(input.value).toBe('0');
  });

  it('camino feliz con blur: valor válido menor al pendiente se conserva y se envía', async () => {
    renderView();
    const input = await screen.findByDisplayValue('6') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);
    expect(input.value).toBe('5');
    fireEvent.click(screen.getByRole('button', { name: /Registrar recepción/i }));
    await waitFor(() => expect(mockCrear).toHaveBeenCalled());
    const payload = mockCrear.mock.calls[0][0];
    expect(payload.items).toEqual([{ item_oc_id: 'item1', cantidad_recibida: 5 }]);
  });
});

// ── ADR-085 (SEC-2): ruteo de errores de validación del backend ──────────────────

describe('RecepcionView — validación de payload (ADR-085)', () => {
  it('rutea el error de validación del backend al campo remito_proveedor', async () => {
    mockCrear.mockRejectedValue(new Error('VALIDATION:remito_proveedor:MAX:100'));
    renderView();

    await screen.findByDisplayValue('6');
    fireEvent.click(screen.getByRole('button', { name: /Registrar recepción/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('remito_proveedor')));
    expect(await screen.findByText(/no puede superar 100/i)).toBeInTheDocument();
  });

  it('muestra en la región general de error un rechazo por ítem (items.0.cantidad_recibida)', async () => {
    mockCrear.mockRejectedValue(new Error('VALIDATION:items.0.cantidad_recibida:MIN:0'));
    renderView();

    await screen.findByDisplayValue('6');
    fireEvent.click(screen.getByRole('button', { name: /Registrar recepción/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mayor o igual a 0/i);
  });
});
