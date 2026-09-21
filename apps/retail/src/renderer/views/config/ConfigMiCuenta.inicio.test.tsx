import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigMiCuenta } from './ConfigMiCuenta';

let inicioPersonalizable = true;
vi.mock('../../hooks/useInicioPersonalizable', () => ({ useInicioPersonalizableHabilitado: () => inicioPersonalizable }));
const guardarInicio = vi.fn();
vi.mock('../../hooks/usePreferencias', () => ({ usePreferencias: () => ({ preferencias: null, guardar: vi.fn(), guardarInicio, toggleFavorito: vi.fn() }) }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ session: { id: 'u1', rolNombre: 'OPERADOR', permisos: ['venta.crear', 'stock.entrada'], preferencias: { pantalla_inicio: null, favoritos: [] } }, can: (c: string) => ['venta.crear', 'stock.entrada'].includes(c) }),
}));

describe('ConfigMiCuenta — pantalla de inicio (ADR-080)', () => {
  afterEach(() => { inicioPersonalizable = true; guardarInicio.mockClear(); delete (globalThis as any).ferreteria; });

  function setupBridge() {
    (globalThis as any).ferreteria = { auth: { whoami: vi.fn().mockResolvedValue({ id: 'u1', nombreCompleto: 'X' }) } };
  }

  it('con el flag on muestra el selector y guarda la elección', async () => {
    setupBridge();
    render(<ConfigMiCuenta />);
    const select = await screen.findByLabelText(/pantalla de inicio/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '/stock' } });
    expect(guardarInicio).toHaveBeenCalledWith('/stock');
  });

  it('con el flag off no muestra el selector', async () => {
    inicioPersonalizable = false;
    setupBridge();
    render(<ConfigMiCuenta />);
    await screen.findByText('Mi cuenta'); // esperar a que cargue el perfil
    expect(screen.queryByLabelText(/pantalla de inicio/i)).not.toBeInTheDocument();
  });
});
