import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportesView } from './ReportesView';

vi.mock('@core/ui', async (importOriginal) => ({ ...(await importOriginal<any>()),
  useAuth: () => ({ can: () => true }),
}));

const ventasPeriodo = vi.fn();
const ventasProducto = vi.fn();
const stockAlertas = vi.fn();
vi.stubGlobal('elaborados', { reporte: { ventasPeriodo, ventasProducto, stockAlertas } });

const PERIODO = {
  resumen: { cantidad: 3, total_centavos: 450000, neto_centavos: 400000, costo_centavos: 100000, margen_centavos: 300000 },
  por_dia: [{ dia: '2026-03-02', cantidad: 3, total_centavos: 450000, neto_centavos: 400000, costo_centavos: 100000, margen_centavos: 300000 }],
  por_medio: [{ medio_pago: 'efectivo', monto_centavos: 300000 }, { medio_pago: 'tarjeta', monto_centavos: 150000 }],
};

const montar = () => render(<MemoryRouter><ReportesView /></MemoryRouter>);

describe('ReportesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ventasPeriodo.mockResolvedValue(PERIODO);
    ventasProducto.mockResolvedValue({
      productos: [{ producto_venta_id: 'p1', descripcion: 'Pote 1/4', unidades: 3, importe_centavos: 450000 }],
      sabores: [{ descripcion: 'Chocolate', veces: 3, consumo: 0.375 }],
    });
    stockAlertas.mockResolvedValue([
      { articulo_id: 'a1', nombre: 'Leche', unidad: 'l', stock: -2, stock_minimo: null, estado: 'negativo' },
      { articulo_id: 'a2', nombre: 'Azúcar', unidad: 'kg', stock: 3, stock_minimo: 5, estado: 'bajo_minimo' },
    ]);
  });

  it('ventas: pide el mes en curso y muestra totales, margen %, por día y por medio', async () => {
    montar();
    await screen.findByLabelText('Ventas por día');
    const arg = ventasPeriodo.mock.calls[0][0];
    expect(arg.desde).toMatch(/^\d{4}-\d{2}-01$/);
    expect(arg.hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByText('$4500.00', { selector: '.v' })).toBeInTheDocument();
    expect(screen.getByText('$3000.00 (75.0%)')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Ventas por día')).getByText('2026-03-02')).toBeInTheDocument();
    const medios = within(screen.getByLabelText('Ventas por medio de pago'));
    expect(medios.getByText('Efectivo')).toBeInTheDocument();
    expect(medios.getByText('Tarjeta')).toBeInTheDocument();
  });

  it('cambiar el período vuelve a pedir; un rango invertido avisa y no pide', async () => {
    montar();
    await screen.findByLabelText('Ventas por día');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-01-31' } });
    await waitFor(() => expect(ventasPeriodo).toHaveBeenLastCalledWith({ desde: '2026-01-01', hasta: '2026-01-31' }));
    const llamadas = ventasPeriodo.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-02-15' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/no puede ser posterior/i);
    expect(ventasPeriodo.mock.calls.length).toBe(llamadas);
  });

  it('error del main → alerta traducida', async () => {
    ventasPeriodo.mockRejectedValueOnce(new Error('FORBIDDEN'));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent(/no tenés permiso/i);
  });

  it('productos y sabores', async () => {
    montar();
    fireEvent.click(screen.getByRole('tab', { name: /productos y sabores/i }));
    await screen.findByLabelText('Ventas por producto');
    expect(within(screen.getByLabelText('Ventas por producto')).getByText('Pote 1/4')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Sabores más pedidos')).getByText('Chocolate')).toBeInTheDocument();
  });

  it('stock: negativos y bajo mínimo; sin filtro de fechas', async () => {
    montar();
    fireEvent.click(screen.getByRole('tab', { name: /^stock$/i }));
    const tabla = within(await screen.findByLabelText('Alertas de stock'));
    expect(tabla.getByText('Negativo')).toBeInTheDocument();
    expect(tabla.getByText('Bajo mínimo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Desde')).toBeNull();
  });

  it('stock sin alertas', async () => {
    stockAlertas.mockResolvedValueOnce([]);
    montar();
    fireEvent.click(screen.getByRole('tab', { name: /^stock$/i }));
    expect(await screen.findByText('Sin alertas de stock')).toBeInTheDocument();
  });
});
