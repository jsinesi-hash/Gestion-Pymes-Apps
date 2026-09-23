import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CommandPalette, buscadorClientes, AuthContext } from '@core/ui';
import {
  COMANDOS_ACCION, COMANDOS_NAV,
  buscadorProductos, buscadorProveedores,
} from '../../shell/comandosRetail';

// B5: CommandPalette vive en @core/ui y lee useAuth por import relativo; un vi.mock del
// barrel NO lo intercepta (lección B3). Se provee la sesión con el AuthContext real.
let mockCan = vi.fn(() => true);
function authValue() {
  return { can: mockCan, session: { id: 'u1' }, login: vi.fn(), logout: vi.fn(), actualizarPreferencias: vi.fn() } as any;
}

// Task B4: CommandPalette es genérico; se le pasan los comandos y buscadores de Retail.
const comandosRetail = { accion: COMANDOS_ACCION, nav: COMANDOS_NAV };
const buscadoresRetail = [buscadorProductos, buscadorClientes, buscadorProveedores];

function renderPalette() {
  return render(
    <AuthContext.Provider value={authValue()}>
      <MemoryRouter initialEntries={['/inicio']}>
        <Routes>
          <Route path="/inicio" element={<><CommandPalette comandos={comandosRetail} buscadores={buscadoresRetail} /><div>pagina-inicio</div></>} />
          <Route path="/productos/nuevo" element={<><CommandPalette comandos={comandosRetail} buscadores={buscadoresRetail} /><div>pagina-nuevo-producto</div></>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  mockCan = vi.fn(() => true);
  (globalThis as any).ferreteria = {
    catalogo: { producto: { list: vi.fn().mockResolvedValue({ items: [], total: 0 }) } },
    cliente: { list: vi.fn().mockResolvedValue([]) },
    compras: { proveedor: { list: vi.fn().mockResolvedValue([]) } },
  };
  localStorage.clear();
});

afterEach(() => {
  delete (globalThis as any).ferreteria;
});

describe('CommandPalette', () => {
  it('Ctrl+K abre la paleta y Esc la cierra', async () => {
    renderPalette();
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Buscar' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument();
    });
  });

  it('filtra acciones por texto y navega al elegir con Enter', async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('dialog', { name: 'Buscar' }).then(d => d.querySelector('input') as HTMLInputElement);

    fireEvent.change(input, { target: { value: 'producto' } });
    expect(await screen.findByText('Nuevo producto')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('pagina-nuevo-producto')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument();
  });

  it('oculta comandos sin permiso', async () => {
    mockCan = vi.fn(() => false);
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Buscar' });
    const input = dialog.querySelector('input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'producto' } });

    await waitFor(() => {
      expect((globalThis as any).ferreteria.catalogo.producto.list).toHaveBeenCalled();
    });
    expect(screen.queryByText('Nuevo producto')).not.toBeInTheDocument();
  });

  it('cierra al hacer click fuera (overlay)', async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Buscar' });
    const overlay = dialog.parentElement as HTMLElement;

    fireEvent.click(overlay);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument();
    });
  });

  it('busca productos por IPC y navega con ArrowDown+Enter al segundo resultado', async () => {
    (globalThis as any).ferreteria.catalogo.producto.list = vi.fn().mockResolvedValue({
      items: [
        { id: 'p1', nombre_corto: 'Taladro', sku: 'P-0000001-3' },
        { id: 'p2', nombre_corto: 'Martillo', sku: 'P-0000002-1' },
      ],
      total: 2,
    });
    render(
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter initialEntries={['/inicio']}>
          <Routes>
            <Route path="/inicio" element={<><CommandPalette comandos={comandosRetail} buscadores={buscadoresRetail} /><div>pagina-inicio</div></>} />
            <Route path="/productos/p1" element={<><CommandPalette comandos={comandosRetail} buscadores={buscadoresRetail} /><div>pagina-producto-p1</div></>} />
            <Route path="/productos/p2" element={<><CommandPalette comandos={comandosRetail} buscadores={buscadoresRetail} /><div>pagina-producto-p2</div></>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Buscar' });
    const input = dialog.querySelector('input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'a' } });
    expect(await screen.findByText('Taladro')).toBeInTheDocument();
    expect(screen.getByText('Martillo')).toBeInTheDocument();

    // idx arranca en 0 (Taladro/p1); ArrowDown mueve al segundo resultado (Martillo/p2).
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('pagina-producto-p2')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument();
  });

  it('navega a /productos/p1 al hacer click en el primer resultado de producto', async () => {
    (globalThis as any).ferreteria.catalogo.producto.list = vi.fn().mockResolvedValue({
      items: [
        { id: 'p1', nombre_corto: 'Taladro', sku: 'P-0000001-3' },
        { id: 'p2', nombre_corto: 'Martillo', sku: 'P-0000002-1' },
      ],
      total: 2,
    });
    render(
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter initialEntries={['/inicio']}>
          <Routes>
            <Route path="/inicio" element={<><CommandPalette comandos={comandosRetail} buscadores={buscadoresRetail} /><div>pagina-inicio</div></>} />
            <Route path="/productos/p1" element={<><CommandPalette comandos={comandosRetail} buscadores={buscadoresRetail} /><div>pagina-producto-p1</div></>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Buscar' });
    const input = dialog.querySelector('input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'tal' } });
    const opcion = await screen.findByText('Taladro');
    fireEvent.click(opcion);

    await waitFor(() => {
      expect(screen.getByText('pagina-producto-p1')).toBeInTheDocument();
    });
  });

  it('no consulta proveedores cuando falta el permiso proveedor.gestionar', async () => {
    mockCan = vi.fn((codigo: string) => codigo !== 'proveedor.gestionar');
    (globalThis as any).ferreteria.compras.proveedor.list = vi.fn().mockResolvedValue([
      { id: 'prov1', razon_social: 'Proveedor Uno' },
    ]);
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Buscar' });
    const input = dialog.querySelector('input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Proveedor' } });

    await waitFor(() => {
      expect(screen.queryByText('Sin resultados')).toBeInTheDocument();
    });
    expect((globalThis as any).ferreteria.compras.proveedor.list).not.toHaveBeenCalled();
    expect(screen.queryByText('Proveedor Uno')).not.toBeInTheDocument();
  });

  it('guarda un reciente por usuario al ejecutar un resultado', async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = await screen.findByRole('dialog', { name: 'Buscar' }).then(d => d.querySelector('input') as HTMLInputElement);

    fireEvent.change(input, { target: { value: 'producto' } });
    expect(await screen.findByText('Nuevo producto')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      const raw = localStorage.getItem('cmdk_recientes_u1');
      expect(raw).toBeTruthy();
      const recientes = JSON.parse(raw as string);
      expect(recientes.some((r: any) => r.to === '/productos/nuevo')).toBe(true);
    });
  });

  it('muestra un reciente guardado al abrir la paleta con la búsqueda vacía', async () => {
    localStorage.setItem('cmdk_recientes_u1', JSON.stringify([
      { label: 'Taladro', to: '/productos/p1', hint: 'P-0000001-3' },
    ]));
    renderPalette();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await screen.findByRole('dialog', { name: 'Buscar' });

    expect(await screen.findByText('Taladro')).toBeInTheDocument();
  });

  it('no crashea si "recientes" en localStorage es un valor no-array (null)', async () => {
    localStorage.setItem('cmdk_recientes_u1', 'null');
    renderPalette();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(await screen.findByRole('dialog', { name: 'Buscar' })).toBeInTheDocument();
    expect(screen.getByText('pagina-inicio')).toBeInTheDocument();
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument();
  });

  it('no crashea si "recientes" en localStorage es un valor no-array (objeto)', async () => {
    localStorage.setItem('cmdk_recientes_u1', '{}');
    renderPalette();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(await screen.findByRole('dialog', { name: 'Buscar' })).toBeInTheDocument();
    expect(screen.getByText('pagina-inicio')).toBeInTheDocument();
    expect(screen.queryByText('Sin resultados')).not.toBeInTheDocument();
  });

  it('no abre con Ctrl+K cuando está disabled', () => {
    render(
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter initialEntries={['/inicio']}>
          <Routes>
            <Route path="/inicio" element={<><CommandPalette disabled comandos={comandosRetail} buscadores={buscadoresRetail} /><div>pagina-inicio</div></>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(screen.queryByRole('dialog', { name: 'Buscar' })).not.toBeInTheDocument();
  });
});
