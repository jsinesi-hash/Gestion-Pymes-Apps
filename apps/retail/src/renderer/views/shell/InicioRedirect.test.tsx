import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { InicioRedirect, AuthContext, AppProfileProvider } from '@core/ui';
import { navegacionRetail } from '../../../common/navegacion';

let mockSession: any = { rolNombre: 'SUPERVISOR', permisos: ['dashboard.ver'], preferencias: { pantalla_inicio: null, favoritos: [] } };
// InicioRedirect vive en @core/ui y lee useAuth por ruta relativa interna; se provee el
// AuthContext real vía Provider, y useAppProfile vía AppProfileProvider (navegación de Retail).
function renderCon(flag: string | null) {
  (globalThis as any).ferreteria = { parametros: { get: vi.fn().mockResolvedValue(flag) } };
  return render(
    <AppProfileProvider value={{ nombreApp: 'Ferretería', navegacion: navegacionRetail }}>
      <AuthContext.Provider value={{ session: mockSession, can: (c: string) => mockSession?.permisos.includes(c) } as any}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<InicioRedirect />} />
            <Route path="/productos" element={<div>PRODUCTOS</div>} />
            <Route path="/pos" element={<div>POS</div>} />
            <Route path="/dashboard" element={<div>DASHBOARD</div>} />
            <Route path="/stock" element={<div>STOCK</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </AppProfileProvider>,
  );
}

describe('InicioRedirect', () => {
  afterEach(() => { delete (globalThis as any).ferreteria; });

  it('flag off → /productos', async () => {
    mockSession = { rolNombre: 'SUPERVISOR', permisos: ['dashboard.ver'], preferencias: { pantalla_inicio: null, favoritos: [] } };
    renderCon('false');
    await waitFor(() => expect(screen.getByText('PRODUCTOS')).toBeInTheDocument());
  });

  it('flag on + Supervisor sin pantalla → /dashboard', async () => {
    mockSession = { rolNombre: 'SUPERVISOR', permisos: ['dashboard.ver'], preferencias: { pantalla_inicio: null, favoritos: [] } };
    renderCon('true');
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeInTheDocument());
  });

  it('flag on + Operador sin pantalla → /pos', async () => {
    mockSession = { rolNombre: 'OPERADOR', permisos: ['venta.crear'], preferencias: { pantalla_inicio: null, favoritos: [] } };
    renderCon('true');
    await waitFor(() => expect(screen.getByText('POS')).toBeInTheDocument());
  });

  it('flag on + pantalla configurada con permiso → esa pantalla', async () => {
    mockSession = { rolNombre: 'OPERADOR', permisos: ['stock.entrada'], preferencias: { pantalla_inicio: '/stock', favoritos: [] } };
    renderCon('true');
    await waitFor(() => expect(screen.getByText('STOCK')).toBeInTheDocument());
  });

  it('flag on + default por rol sin permiso → fallback /productos', async () => {
    mockSession = { rolNombre: 'SUPERVISOR', permisos: [], preferencias: { pantalla_inicio: null, favoritos: [] } };
    renderCon('true');
    await waitFor(() => expect(screen.getByText('PRODUCTOS')).toBeInTheDocument());
  });
});
