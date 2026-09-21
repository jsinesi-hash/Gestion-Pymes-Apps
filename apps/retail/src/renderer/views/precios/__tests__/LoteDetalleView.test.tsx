import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../../../context/AuthContext';
import { LoteDetalleView } from '../LoteDetalleView';

const mockObtener = vi.fn();
const mockAprobar = vi.fn();
const mockExcluirErrores = vi.fn();
const mockRevalidar = vi.fn();

function auth(perms: string[]) {
  return {
    session: { id: 'u1', nombreCompleto: 'Admin', rolId: 'r1', rolNombre: '', permisos: perms, preferencias: { tema: 'claro' as const, acento: 'amber' as const, ui_font: 'Hanken Grotesk' as const, densidad: 'comfortable' as const, skin: 'actual' as const, pantalla_inicio: null, favoritos: [] } },
    can: (c: string) => perms.includes(c),
    login: async () => {}, logout: async () => {}, actualizarPreferencias: () => {},
  };
}

function renderDetalle(perms: string[] = ['config.fiscal', 'precio.aprobar']) {
  return render(
    <AuthContext.Provider value={auth(perms)}>
      <MemoryRouter initialEntries={['/precios/lotes/b1']}>
        <Routes><Route path="/precios/lotes/:id" element={<LoteDetalleView />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function batch(over: any = {}) {
  return {
    id: 'b1', lista_precio_id: 'l1', proveedor_id: null, origen: 'MARGIN_UPDATE',
    estado: 'validado', productos_ok: 1, advertencias: 0, errores: 0, excluidas: 0,
    impacto_incremento_centavos: -300000, fecha_creacion: Date.now(), lista_nombre: 'Tornillos', ...over,
  };
}
const FILA = {
  id: 'd1', producto_id: 'p1', nombre_corto: 'Amoladora', sku: 'P-0001042-7',
  costo_neto_centavos: 500000, precio_anterior_centavos: 1000000, precio_propuesto_centavos: 700000,
  margen_nuevo_pct: 28.6, regla_precio_id: 'r1', variacion_pct: -30, estado_validacion: 'ok', motivo_validacion: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAprobar.mockResolvedValue({ id: 'b1', estado: 'aprobado' });
  mockExcluirErrores.mockResolvedValue({ ok: true });
  mockRevalidar.mockResolvedValue({ id: 'b1', estado: 'validado' });
  (window as any).ferreteria = {
    precios: { batch: { obtener: mockObtener, aprobar: mockAprobar, excluirErrores: mockExcluirErrores, revalidar: mockRevalidar, publicar: vi.fn(), revertir: vi.fn(), excluirFila: vi.fn() } },
  };
});

describe('LoteDetalleView', () => {
  it('muestra los KPIs y la fila del detalle', async () => {
    mockObtener.mockResolvedValue({ batch: batch(), detalle: [FILA] });
    renderDetalle();
    expect(await screen.findByText('Amoladora')).toBeInTheDocument();
    expect(screen.getByText(/7\.000,00/)).toBeInTheDocument(); // precio nuevo
  });

  it('muestra la lista del lote (ADR-071)', async () => {
    mockObtener.mockResolvedValue({ batch: batch(), detalle: [FILA] });
    renderDetalle();
    expect(await screen.findByText(/Tornillos/)).toBeInTheDocument();
  });

  it('lote validado sin errores: Aprobar habilitado y llama al handler', async () => {
    mockObtener.mockResolvedValue({ batch: batch(), detalle: [FILA] });
    renderDetalle();
    const btn = await screen.findByRole('button', { name: /aprobar/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    await waitFor(() => expect(mockAprobar).toHaveBeenCalledWith('b1'));
  });

  it('lote con errores: Aprobar deshabilitado y muestra el motivo', async () => {
    mockObtener.mockResolvedValue({
      batch: batch({ estado: 'validacion_fallida', errores: 1, productos_ok: 0 }),
      detalle: [{ ...FILA, estado_validacion: 'error', motivo_validacion: 'Precio bajo el costo neto' }],
    });
    renderDetalle();
    const btn = await screen.findByRole('button', { name: /aprobar/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/en error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /excluir errores/i })).toBeInTheDocument();
  });

  it('sin permiso precio.aprobar, Aprobar queda deshabilitado', async () => {
    mockObtener.mockResolvedValue({ batch: batch(), detalle: [FILA] });
    renderDetalle(['config.fiscal']);
    const btn = await screen.findByRole('button', { name: /aprobar/i });
    expect(btn).toBeDisabled();
  });

  it('lote validacion_fallida con config.fiscal: muestra "Re-validar" y llama al handler', async () => {
    mockObtener.mockResolvedValue({
      batch: batch({ estado: 'validacion_fallida', errores: 1, productos_ok: 0 }),
      detalle: [{ ...FILA, estado_validacion: 'error', motivo_validacion: 'Sin proveedor preferido / sin costo' }],
    });
    renderDetalle(['config.fiscal']);
    const btn = await screen.findByRole('button', { name: /re-validar/i });
    fireEvent.click(btn);
    await waitFor(() => expect(mockRevalidar).toHaveBeenCalledWith('b1'));
  });

  it('sin config.fiscal no muestra "Re-validar"', async () => {
    mockObtener.mockResolvedValue({ batch: batch(), detalle: [FILA] });
    renderDetalle(['precio.aprobar']);
    await screen.findByText('Amoladora');
    expect(screen.queryByRole('button', { name: /re-validar/i })).not.toBeInTheDocument();
  });

  it('el nombre del producto linkea al detalle del producto (NAV-2)', async () => {
    mockObtener.mockResolvedValue({ batch: batch(), detalle: [FILA] });
    renderDetalle();
    const link = await screen.findByRole('link', { name: /amoladora/i });
    expect(link).toHaveAttribute('href', '/productos/p1');
  });
});
