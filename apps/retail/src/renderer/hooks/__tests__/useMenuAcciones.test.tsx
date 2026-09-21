import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { useMenuAcciones } from '../useMenuAcciones';

function Harness() {
  useMenuAcciones();
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

function renderConAccion(logout = vi.fn(async () => {})) {
  let cb: ((p: { action: string }) => void) | undefined;
  (globalThis as any).ferreteria = {
    menu: { onAccion: (fn: (p: { action: string }) => void) => { cb = fn; return () => {}; } },
  };
  const auth = { session: null, can: () => false, login: async () => {}, logout };
  render(
    <AuthContext.Provider value={auth as any}>
      <MemoryRouter initialEntries={['/pos']}>
        <Harness />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { emitir: (action: string) => act(() => cb!({ action })), logout };
}

afterEach(() => { delete (globalThis as any).ferreteria; });

describe('useMenuAcciones', () => {
  it('navega a /caja cuando llega la acción abrir-caja', () => {
    const { emitir } = renderConAccion();
    emitir('abrir-caja');
    expect(screen.getByTestId('loc').textContent).toBe('/caja');
  });

  it('navega a /compras/ordenes cuando llega recepcion-compra', () => {
    const { emitir } = renderConAccion();
    emitir('recepcion-compra');
    expect(screen.getByTestId('loc').textContent).toBe('/compras/ordenes');
  });

  it('llama logout() cuando llega cerrar-sesion, sin navegar', () => {
    const { emitir, logout } = renderConAccion();
    emitir('cerrar-sesion');
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('loc').textContent).toBe('/pos');
  });

  it('ignora acciones desconocidas', () => {
    const { emitir } = renderConAccion();
    emitir('no-existe');
    expect(screen.getByTestId('loc').textContent).toBe('/pos');
  });

  it.each([
    ['nueva-venta', '/pos'],
    ['importar-datos', '/importar'],
    ['backup', '/config/backup-restore'],
    ['abrir-caja', '/caja'],
    ['cerrar-caja', '/caja/cerrar'],
    ['movimiento-caja', '/caja'],
    ['buscar-producto', '/productos'],
    ['entrada-stock', '/stock'],
    ['recepcion-compra', '/compras/ordenes'],
    ['cobro-ctacte', '/credito'],
    ['ventas-espera', '/pos'],
  ])('acción %s navega a %s', (action, ruta) => {
    const { emitir } = renderConAccion();
    emitir(action);
    expect(screen.getByTestId('loc').textContent).toBe(ruta);
  });
});
