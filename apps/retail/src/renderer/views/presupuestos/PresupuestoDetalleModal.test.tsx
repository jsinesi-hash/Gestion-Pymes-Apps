import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresupuestoDetalleModal } from './PresupuestoDetalleModal';

const obtener = vi.fn();

beforeEach(() => {
  obtener.mockReset();
  (globalThis as any).ferreteria = { presupuesto: { obtener } };
});

describe('PresupuestoDetalleModal', () => {
  it('muestra cabecera, líneas y total cotizado', async () => {
    obtener.mockResolvedValue({
      numero: 'PR-0000001', estado: 'emitido',
      fecha_emision: Date.now(), fecha_validez: Date.now() + 86400000, validez_dias: 15,
      descuento_global_pct: 0, total_centavos: 180000, observaciones: null,
      cliente_nombre_completo: 'Ferreteria Sur', cliente_documento: '20111', cliente_condicion_fiscal: 'RI',
      venta_numero_interno: null, venta_total: null,
      lineas: [{ id: 'l1', descripcion: 'Martillo', cantidad: 2, precio_unitario_centavos: 90000, descuento_linea_pct: 0, subtotal_centavos: 180000 }],
    });
    render(<PresupuestoDetalleModal presupuestoId="p1" onClose={vi.fn()} />);
    expect(await screen.findByText('Presupuesto PR-0000001')).toBeInTheDocument();
    expect(screen.getByText('Martillo')).toBeInTheDocument();
    // 1.800,00 aparece en el subtotal de línea y en el total cotizado
    expect(screen.getAllByText(/1\.800,00/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Total cotizado/)).toBeInTheDocument();
    expect(screen.getByText('Ferreteria Sur')).toBeInTheDocument();
  });

  it('en un convertido muestra la venta asociada y avisa si el total difiere', async () => {
    obtener.mockResolvedValue({
      numero: 'PR-0000002', estado: 'convertido',
      fecha_emision: Date.now(), fecha_validez: Date.now(), validez_dias: 15,
      descuento_global_pct: 0, total_centavos: 180000, observaciones: null,
      cliente_nombre_completo: null, cliente_documento: null, cliente_condicion_fiscal: null,
      venta_numero_interno: 'V-C1-000009', venta_total: 900, // pesos → 90000 centavos ≠ 180000
      lineas: [{ id: 'l1', descripcion: 'Martillo', cantidad: 2, precio_unitario_centavos: 90000, descuento_linea_pct: 0, subtotal_centavos: 180000 }],
    });
    render(<PresupuestoDetalleModal presupuestoId="p2" onClose={vi.fn()} />);
    expect(await screen.findByText(/V-C1-000009/)).toBeInTheDocument();
    expect(screen.getByText(/difiere del cotizado/)).toBeInTheDocument();
  });
});
