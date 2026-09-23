import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { VistosRecientesPanel, useRegistrarVisto, leerVistos, AuthContext } from '@core/ui';

// VistosRecientesPanel vive en @core/ui e importa useNavigate desde 'react-router-dom'; en vez
// de mockear el módulo (el mock no intercepta al componente ya empaquetado en otro paquete) se
// monta un MemoryRouter real y una sonda captura el pathname al que navega el click.
let ultimaRuta = '';
function SondaRuta() {
  ultimaRuta = useLocation().pathname;
  return null;
}

// useAuth se lee por ruta relativa interna de @core/ui; se provee el AuthContext real.
const authValue = { session: { id: 'u1' }, can: () => true } as any;
const Wrap = ({ children }: any) => (
  <AuthContext.Provider value={authValue}>
    <MemoryRouter>
      {children}
      <SondaRuta />
    </MemoryRouter>
  </AuthContext.Provider>
);

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
    const { container } = render(<Wrap><VistosRecientesPanel /></Wrap>);
    await waitFor(() => {}); // deja resolver la promesa del flag
    expect(container.textContent).toBe('');
  });

  it('con el flag encendido muestra los vistos y navega al hacer click', async () => {
    setFlag('true');
    localStorage.setItem('vistos_recientes_uu1', JSON.stringify([
      { tipo: 'producto', id: 'p1', etiqueta: 'Tornillo', ts: 1 },
    ]));
    render(<Wrap><VistosRecientesPanel /></Wrap>);
    const chip = await screen.findByText('Tornillo');
    fireEvent.click(chip);
    expect(ultimaRuta).toBe('/productos/p1');
  });
});

describe('useRegistrarVisto — gating por flag', () => {
  function Harness() {
    const registrar = useRegistrarVisto();
    return <button onClick={() => registrar({ tipo: 'producto', id: 'p9', etiqueta: 'X' })}>reg</button>;
  }

  it('registra cuando el flag está encendido', async () => {
    setFlag('true');
    render(<Wrap><Harness /></Wrap>);
    await waitFor(() => {});
    act(() => { fireEvent.click(screen.getByText('reg')); });
    expect(leerVistos('u1').some((v) => v.id === 'p9')).toBe(true);
  });

  it('no registra con el flag apagado', async () => {
    setFlag('false');
    render(<Wrap><Harness /></Wrap>);
    await waitFor(() => {});
    act(() => { fireEvent.click(screen.getByText('reg')); });
    expect(leerVistos('u1')).toEqual([]);
  });
});
