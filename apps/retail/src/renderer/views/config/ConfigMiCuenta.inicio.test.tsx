import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigMiCuenta, AuthContext, AppProfileProvider } from '@core/ui';
import { navegacionRetail } from '../../../common/navegacion';

// ConfigMiCuenta vive ahora en @core/ui e importa useAuth/useInicioPersonalizableHabilitado/
// usePreferencias RELATIVAMENTE: un vi.mock('@core/ui') de este test NO los interceptaría.
// Se conducen con providers reales (AuthContext + AppProfile) y un bridge stub; el flag y el
// guardado se leen/observan a través de `ferreteria` (parametros/preferencias).
let inicioPersonalizable = true;
const saveSpy = vi.fn().mockResolvedValue(undefined);
const actualizarPreferencias = vi.fn();

const session = {
  id: 'u1',
  rolNombre: 'OPERADOR',
  permisos: ['venta.crear', 'stock.entrada'],
  preferencias: { pantalla_inicio: null, favoritos: [] },
} as any;
const authValue = {
  session,
  can: (c: string) => ['venta.crear', 'stock.entrada'].includes(c),
  login: async () => {},
  logout: async () => {},
  actualizarPreferencias,
} as any;

function renderMiCuenta() {
  return render(
    <AppProfileProvider value={{ nombreApp: 'Ferretería', navegacion: navegacionRetail }}>
      <AuthContext.Provider value={authValue}>
        <ConfigMiCuenta />
      </AuthContext.Provider>
    </AppProfileProvider>,
  );
}

beforeEach(() => {
  (globalThis as any).ferreteria = {
    auth: { whoami: vi.fn().mockResolvedValue({ id: 'u1', nombreCompleto: 'X' }) },
    parametros: { get: vi.fn().mockImplementation(() => Promise.resolve(inicioPersonalizable ? 'true' : 'false')) },
    preferencias: { save: saveSpy, get: vi.fn().mockResolvedValue(null) },
  };
});

describe('ConfigMiCuenta — pantalla de inicio (ADR-080)', () => {
  afterEach(() => { inicioPersonalizable = true; saveSpy.mockClear(); delete (globalThis as any).ferreteria; });

  it('con el flag on muestra el selector y guarda la elección', async () => {
    renderMiCuenta();
    const select = await screen.findByLabelText(/pantalla de inicio/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '/stock' } });
    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ pantalla_inicio: '/stock' })),
    );
  });

  it('con el flag off no muestra el selector', async () => {
    inicioPersonalizable = false;
    renderMiCuenta();
    await screen.findByText('Mi cuenta'); // esperar a que cargue el perfil
    expect(screen.queryByLabelText(/pantalla de inicio/i)).not.toBeInTheDocument();
  });
});
