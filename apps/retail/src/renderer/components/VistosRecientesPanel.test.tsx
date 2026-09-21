import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { VistosRecientesPanel } from './VistosRecientesPanel';
import { useRegistrarVisto, leerVistos } from '../hooks/useVistosRecientes';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ session: { id: 'u1' }, can: () => true }),
}));

function setFlag(valor: 'true' | 'false') {
  (globalThis as any).ferreteria = {
    parametros: { get: vi.fn().mockResolvedValue(valor) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('VistosRecientesPanel (ADR-081 / PERF-2)', () => {
  it('no renderiza nada con el flag apagado', async () => {
    setFlag('false');
    leerVistos('u1'); // no-op, sólo para claridad
    const { container } = render(<VistosRecientesPanel />);
    await waitFor(() => {}); // deja resolver la promesa del flag
    expect(container.textContent).toBe('');
  });

  it('con el flag encendido muestra los vistos y navega al hacer click', async () => {
    setFlag('true');
    localStorage.setItem('vistos_recientes_uu1', JSON.stringify([
      { tipo: 'producto', id: 'p1', etiqueta: 'Tornillo', ts: 1 },
    ]));
    render(<VistosRecientesPanel />);
    const chip = await screen.findByText('Tornillo');
    fireEvent.click(chip);
    expect(mockNavigate).toHaveBeenCalledWith('/productos/p1');
  });
});

describe('useRegistrarVisto — gating por flag', () => {
  function Harness() {
    const registrar = useRegistrarVisto();
    return <button onClick={() => registrar({ tipo: 'producto', id: 'p9', etiqueta: 'X' })}>reg</button>;
  }

  it('registra cuando el flag está encendido', async () => {
    setFlag('true');
    render(<Harness />);
    await waitFor(() => {});
    act(() => { fireEvent.click(screen.getByText('reg')); });
    expect(leerVistos('u1').some((v) => v.id === 'p9')).toBe(true);
  });

  it('no registra con el flag apagado', async () => {
    setFlag('false');
    render(<Harness />);
    await waitFor(() => {});
    act(() => { fireEvent.click(screen.getByText('reg')); });
    expect(leerVistos('u1')).toEqual([]);
  });
});
