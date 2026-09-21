import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CtaCteDetalle } from './CtaCteDetalle';

const getByCliente = vi.fn();
const setLimite = vi.fn();
const registrarSaldoInicial = vi.fn();

const cuentaSinMovimientos = {
  cuenta: { id: 'cc1', cliente_id: 'cli1', saldo_centavos: 0, limite_credito_centavos: 0 },
  movimientos: [],
};

beforeEach(() => {
  getByCliente.mockReset();
  setLimite.mockReset();
  registrarSaldoInicial.mockReset();
  (globalThis as any).ferreteria = {
    ctacte: { getByCliente, setLimite, registrarSaldoInicial },
  };
  getByCliente.mockResolvedValue(cuentaSinMovimientos);
});

function renderDetalle() {
  return render(
    <MemoryRouter initialEntries={['/credito/cli1']}>
      <Routes>
        <Route path="/credito/:clienteId" element={<CtaCteDetalle />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CtaCteDetalle — saldo inicial', () => {
  it('registra el saldo inicial con los datos cargados', async () => {
    registrarSaldoInicial.mockResolvedValue({ saldo_centavos: 30000 });
    renderDetalle();

    fireEvent.click(await screen.findByRole('button', { name: /saldo inicial/i }));
    fireEvent.change(document.getElementById('saldo-inicial-monto')!, { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(registrarSaldoInicial).toHaveBeenCalledWith({
      cuentaId: 'cc1', monto_centavos: 30000, tipo: 'cargo',
    }));
  });

  it('rutea el error de validación del backend al campo monto_centavos', async () => {
    registrarSaldoInicial.mockRejectedValue(new Error('VALIDATION:monto_centavos:NEGATIVO'));
    renderDetalle();

    fireEvent.click(await screen.findByRole('button', { name: /saldo inicial/i }));
    fireEvent.change(document.getElementById('saldo-inicial-monto')!, { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('saldo-inicial-monto')));
    expect(await screen.findByText(/no puede ser negativo/i)).toBeInTheDocument();
  });

  it('rutea el error de validación del backend al campo tipo', async () => {
    registrarSaldoInicial.mockRejectedValue(new Error('VALIDATION:tipo:ENUM'));
    renderDetalle();

    fireEvent.click(await screen.findByRole('button', { name: /saldo inicial/i }));
    fireEvent.change(document.getElementById('saldo-inicial-monto')!, { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('saldo-inicial-tipo')));
    expect(await screen.findByText(/no es válido/i)).toBeInTheDocument();
  });
});

describe('CtaCteDetalle — límite de crédito', () => {
  it('actualiza el límite', async () => {
    setLimite.mockResolvedValue({ ok: true });
    renderDetalle();

    fireEvent.click(await screen.findByTitle(/editar límite/i));
    fireEvent.change(document.getElementById('limite-centavos')!, { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(setLimite).toHaveBeenCalledWith({ cuentaId: 'cc1', limite_centavos: 200000 }));
  });

  it('rutea el error de validación del backend al campo limite_centavos', async () => {
    setLimite.mockRejectedValue(new Error('VALIDATION:limite_centavos:NO_ENTERO'));
    renderDetalle();

    fireEvent.click(await screen.findByTitle(/editar límite/i));
    fireEvent.change(document.getElementById('limite-centavos')!, { target: { value: '20.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('limite-centavos')));
    expect(await screen.findByText(/número entero/i)).toBeInTheDocument();
  });
});
