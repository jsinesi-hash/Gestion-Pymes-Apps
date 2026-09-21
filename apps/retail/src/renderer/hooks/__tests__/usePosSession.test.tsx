import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePosSession } from '../usePosSession';

const mockCaja = { id: 'c-1', estado: 'abierta', monto_inicial: 0, usuario_id: 'u-1', fecha_apertura: new Date() };
const mockLista = { id: 'l-1', nombre: 'General', ajuste_porcentual: 0, predeterminada: true, activo: true };
const mockImpuesto = { id: 'i-1', alicuota: 21, predeterminado: true };
const mockProd = { id: 'p-1', nombre_corto: 'Tornillo', activo: true, precio_venta_lista: 1000, impuesto_id: 'i-1', permite_fraccion: false };
const mockEx = { producto_id: 'p-1', stock_fisico: 10 };

function makeFerreteria(overrides: Record<string, unknown> = {}) {
  return {
    caja: { getActiva: vi.fn().mockResolvedValue(mockCaja) },
    precios: {
      lista: { list: vi.fn().mockResolvedValue([mockLista]) },
      detalle: { listByProducto: vi.fn().mockResolvedValue([]) },
      valor: { getPrecioEnLista: vi.fn().mockResolvedValue({ precio_centavos: 100000, origen: 'vigente' }) },
    },
    catalogo: {
      impuesto: { list: vi.fn().mockResolvedValue([mockImpuesto]) },
      produto: { get: vi.fn() },
      producto: { get: vi.fn().mockResolvedValue(mockProd) },
      existencias: { get: vi.fn().mockResolvedValue(mockEx) },
    },
    venta: { confirmar: vi.fn().mockResolvedValue({ venta: { id: 'v-1' }, detalles: [], comprobante: {} }) },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = makeFerreteria();
});

describe('usePosSession', () => {
  it('inicia con cajaActiva undefined (cargando)', () => {
    const { result } = renderHook(() => usePosSession());
    expect(result.current.cajaActiva).toBeUndefined();
  });

  it('carga cajaActiva, lista predeterminada e impuestos al montar', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());
    expect(result.current.cajaActiva?.id).toBe('c-1');
  });

  it('addLinea agrega producto al carrito con precio correcto', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => { await result.current.addLinea('p-1'); });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].producto_id).toBe('p-1');
    expect(result.current.lines[0].cantidad).toBe(1);
  });

  it('addLinea duplicado incrementa cantidad', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => { await result.current.addLinea('p-1'); });
    await act(async () => { await result.current.addLinea('p-1'); });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].cantidad).toBe(2);
  });

  it('addLinea con producto inactivo establece error', async () => {
    (window as any).ferreteria.catalogo.producto.get = vi.fn().mockResolvedValue({ ...mockProd, activo: false });
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => { await result.current.addLinea('p-1'); });

    expect(result.current.error).toBe('PRODUCTO_INACTIVO');
    expect(result.current.lines).toHaveLength(0);
  });

  it('addLinea con stock insuficiente establece error', async () => {
    (window as any).ferreteria.catalogo.existencias.get = vi.fn().mockResolvedValue({ ...mockEx, stock_fisico: 0 });
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => { await result.current.addLinea('p-1'); });

    expect(result.current.error).toBe('STOCK_INSUFICIENTE');
  });

  it('totales recalculan al cambiar líneas', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    expect(result.current.totales.totalCentavos).toBe(0);
    await act(async () => { await result.current.addLinea('p-1'); });
    expect(result.current.totales.totalCentavos).toBeGreaterThan(0);
  });

  it('reset limpia el carrito', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => { await result.current.addLinea('p-1'); });
    act(() => { result.current.reset(); });

    expect(result.current.lines).toHaveLength(0);
    expect(result.current.descuentoGlobalPct).toBe(0);
    expect(result.current.formaPago).toBe('efectivo');
  });

  it('inicia con clienteId = CONSUMIDOR_FINAL_ID y clienteInfo = null', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());
    expect(result.current.clienteId).toBe('cf000000-0000-0000-0000-000000000001');
    expect(result.current.clienteInfo).toBeNull();
  });

  it('setCliente actualiza clienteId y clienteInfo', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    act(() => {
      result.current.setCliente('c-123', { nombre_completo: 'Juan García', habilita_ccc: false });
    });

    expect(result.current.clienteId).toBe('c-123');
    expect(result.current.clienteInfo?.nombre_completo).toBe('Juan García');
  });

  it('setCliente con habilita_ccc=false y formaPago=cuenta_corriente resetea a efectivo', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    act(() => {
      result.current.setCliente('c-ccc', { nombre_completo: 'Empresa CCC', habilita_ccc: true });
      result.current.setFormaPago('cuenta_corriente');
    });
    expect(result.current.formaPago).toBe('cuenta_corriente');

    act(() => {
      result.current.setCliente('c-noccc', { nombre_completo: 'Sin CCC', habilita_ccc: false });
    });
    expect(result.current.formaPago).toBe('efectivo');
  });

  it('reset() vuelve clienteId a CONSUMIDOR_FINAL_ID', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    act(() => {
      result.current.setCliente('c-123', { nombre_completo: 'Juan', habilita_ccc: false });
    });
    act(() => { result.current.reset(); });

    expect(result.current.clienteId).toBe('cf000000-0000-0000-0000-000000000001');
    expect(result.current.clienteInfo).toBeNull();
  });

  // ── Multi-presentación ────────────────────────────────────────────────────

  it('updatePresentacion multiplica precioListaCentavos por el nuevo factor', async () => {
    // precio base = 100000 centavos ($1000). Caja factor=10 → precio caja = $10000
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => { await result.current.addLinea('p-1'); });
    expect(result.current.lines[0].precioListaCentavos).toBe(100000);

    await act(async () => {
      await result.current.updatePresentacion('p-1', 'pp-caja', 10, 'caja');
    });

    expect(result.current.lines[0].precioListaCentavos).toBe(1000000);
    expect(result.current.lines[0].factor_a_stock).toBe(10);
    expect(result.current.totales.totalCentavos).toBe(1000000);
  });

  it('updatePresentacion vuelve al precio original al revertir al factor base', async () => {
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => { await result.current.addLinea('p-1'); });
    await act(async () => { await result.current.updatePresentacion('p-1', 'pp-caja', 10, 'caja'); });
    await act(async () => { await result.current.updatePresentacion('p-1', 'pp-u', 1, 'u'); });

    expect(result.current.lines[0].precioListaCentavos).toBe(100000);
    expect(result.current.lines[0].factor_a_stock).toBe(1);
  });

  it('updatePresentacion detecta stock insuficiente con el nuevo factor', async () => {
    // stock=10, cantidad=2, factor nuevo=10 → necesita 20 unidades → error
    (window as any).ferreteria.catalogo.existencias.get = vi.fn().mockResolvedValue({ ...mockEx, stock_fisico: 10 });
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => { await result.current.addLinea('p-1'); });
    await act(async () => { await result.current.addLinea('p-1'); }); // cantidad=2
    expect(result.current.lines[0].cantidad).toBe(2);

    await act(async () => {
      await result.current.updatePresentacion('p-1', 'pp-caja', 10, 'caja');
    });

    expect(result.current.error).toMatch(/STOCK_INSUFICIENTE/);
    // línea no cambia
    expect(result.current.lines[0].factor_a_stock).toBe(1);
  });

  it('addLinea con factor>1 multiplica el precio base por el factor', async () => {
    // Simula scan de barcode de caja (factor=10)
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => {
      await result.current.addLinea('p-1', 'pp-caja', 10, 'caja');
    });

    expect(result.current.lines[0].precioListaCentavos).toBe(1000000); // 100000 × 10
    expect(result.current.lines[0].factor_a_stock).toBe(10);
    expect(result.current.totales.totalCentavos).toBe(1000000);
  });

  it('addLinea sobre línea existente usa el factor actual de la línea para el check de stock', async () => {
    // stock=15, caja factor=10, cantidad=1 → ok (10<15); incrementar a 2 → 20>15 → error
    (window as any).ferreteria.catalogo.existencias.get = vi.fn().mockResolvedValue({ ...mockEx, stock_fisico: 15 });
    const { result } = renderHook(() => usePosSession());
    await waitFor(() => expect(result.current.cajaActiva).not.toBeUndefined());

    await act(async () => { await result.current.addLinea('p-1', 'pp-caja', 10, 'caja'); });
    expect(result.current.lines[0].factor_a_stock).toBe(10);

    // segundo scan del mismo producto: addLinea sin presentacion (scan generico)
    await act(async () => { await result.current.addLinea('p-1'); });

    expect(result.current.error).toMatch(/STOCK_INSUFICIENTE/);
    expect(result.current.lines[0].cantidad).toBe(1); // no incrementó
  });
});
