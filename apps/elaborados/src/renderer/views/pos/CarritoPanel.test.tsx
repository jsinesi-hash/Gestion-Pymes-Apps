import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { formatPesos } from '@core/ui';
import { CarritoPanel } from './CarritoPanel';
import type { Cotizacion, LineaCarrito } from './tipos';

const linea: LineaCarrito = {
  key: 'l1', producto_venta_id: 'p1', nombre: 'Pote 1/4', detalle: 'Choco, DDL', cantidad: 2,
  descuento_linea_pct: 0, modificadores: [],
};
const cot: Cotizacion = {
  lineas: [{ descripcion: 'Pote 1/4', cantidad: 2, precio_unitario_centavos: 150000, descuento_linea_pct: 0, subtotal_centavos: 300000, opciones: [] }],
  subtotal_centavos: 300000, descuento_global_centavos: 0, total_centavos: 300000,
  ajuste_redondeo_centavos: 0, importe_iva_centavos: 0, bloqueos: [], advertencias: [],
};

function montar(over: Partial<React.ComponentProps<typeof CarritoPanel>> = {}) {
  const props = {
    lineas: [linea], cotizacion: cot, cotizando: false, errorCotizacion: null, descuentoGlobalPct: 0,
    onCantidad: vi.fn(), onQuitar: vi.fn(), onDescuentoLinea: vi.fn(), onDescuentoGlobal: vi.fn(),
    onCobrar: vi.fn(), puedeCobrar: true, ...over,
  };
  render(<CarritoPanel {...props} />);
  return props;
}
const cobrar = () => screen.getByRole('button', { name: 'COBRAR' });

describe('CarritoPanel', () => {
  it('carrito vacío: mensaje y COBRAR deshabilitado', () => {
    montar({ lineas: [], cotizacion: null });
    expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();
    expect(cobrar()).toBeDisabled();
  });

  it('con líneas y cotización muestra detalle, subtotal y total, y COBRAR habilitado', () => {
    montar();
    expect(screen.getByText('Choco, DDL')).toBeInTheDocument();
    expect(screen.getAllByText(formatPesos(300000)).length).toBeGreaterThanOrEqual(2);
    expect(cobrar()).toBeEnabled();
  });

  it('+, − y ✕ llaman a los callbacks con la key', () => {
    const p = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(p.onCantidad).toHaveBeenCalledWith('l1', 3);
    fireEvent.click(screen.getByRole('button', { name: 'Menos' }));
    expect(p.onCantidad).toHaveBeenCalledWith('l1', 1);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(p.onQuitar).toHaveBeenCalledWith('l1');
  });

  it('los descuentos de línea y global llaman a los callbacks con el número', () => {
    const p = montar();
    fireEvent.change(screen.getByLabelText('Descuento de línea'), { target: { value: '10' } });
    expect(p.onDescuentoLinea).toHaveBeenCalledWith('l1', 10);
    fireEvent.change(screen.getByLabelText('Descuento global'), { target: { value: '5' } });
    expect(p.onDescuentoGlobal).toHaveBeenCalledWith(5);
  });

  it('bloqueos: alerta y COBRAR deshabilitado; advertencias: aviso y COBRAR habilitado', () => {
    const b = { articulo_id: 'a1', nombre: 'Leche', stockResultante: -2 };
    montar({ cotizacion: { ...cot, bloqueos: [b] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Sin stock suficiente de Leche');
    expect(cobrar()).toBeDisabled();
    cleanup();
    montar({ cotizacion: { ...cot, advertencias: [{ articulo_id: 'a1', nombre: 'Leche', stockResultante: -1 }] } });
    expect(screen.getByText('Leche quedará en negativo')).toBeInTheDocument();
    expect(cobrar()).toBeEnabled();
  });

  it('errorCotizacion se muestra y deshabilita COBRAR', () => {
    montar({ errorCotizacion: 'No se pudo cotizar' });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cotizar');
    expect(cobrar()).toBeDisabled();
  });

  it('puedeCobrar=false deshabilita COBRAR', () => {
    montar({ puedeCobrar: false });
    expect(cobrar()).toBeDisabled();
  });

  it('cotización desfasada (distinta cantidad de líneas): no muestra subtotales ajenos', () => {
    const otra: LineaCarrito = { ...linea, key: 'l2', nombre: 'Palito' };
    montar({ lineas: [linea, otra], cotizacion: cot });
    expect(screen.getAllByText('—')).toHaveLength(2);
    // el único 300000 visible es el del resumen (Subtotal/TOTAL), no el de una fila
    expect(screen.getAllByText(formatPesos(300000))).toHaveLength(2);
  });
});
