import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HistorialImportacionCostosView } from './HistorialImportacionCostosView';

const HISTORIAL_MOCK = [
  { id: 'imp-1', proveedor: 'Insumos del Sur SA', nombre_archivo: 'costos_julio.csv', fecha_importacion: 1785000000000, filas_totales: 9, identificados: 6, rechazados: 2, pendientes: 1, descartados: 0, estado: 'confirmado' },
  { id: 'imp-2', proveedor: 'Metalúrgica Norte SRL', nombre_archivo: 'lista_agosto.xlsx', fecha_importacion: 1784000000000, filas_totales: 22, identificados: 22, rechazados: 0, pendientes: 0, descartados: 0, estado: 'confirmado' },
  { id: 'imp-4', proveedor: 'Insumos del Sur SA', nombre_archivo: 'prueba_incompleta.csv', fecha_importacion: 1783000000000, filas_totales: 0, identificados: 0, rechazados: 0, pendientes: 0, descartados: 0, estado: 'cancelado' },
  { id: 'imp-5', proveedor: 'Insumos del Sur SA', nombre_archivo: 'abandonada.csv', fecha_importacion: 1782000000000, filas_totales: 4, identificados: 3, rechazados: 0, pendientes: 1, descartados: 0, estado: 'pendiente' },
];

const DETALLE_MOCK = [
  { detalle_id: 'd1', fila_num: 2, datos: { COD_PRODUCTO_PROV: 'PT-001', COSTO: '250.00' }, nombre_producto: 'Tornillo', costo_anterior_centavos: 10000, costo_nuevo_centavos: 25000, estado: 'matched', motivo: null },
  { detalle_id: 'd2', fila_num: 3, datos: { COD_PRODUCTO_PROV: 'DESCONOCIDO', COSTO: '50.00' }, nombre_producto: null, costo_anterior_centavos: null, costo_nuevo_centavos: 5000, estado: 'sin_matchear', motivo: 'Sin identificar — revisar en Cola de Revisión' },
  { detalle_id: 'd3', fila_num: 4, datos: { COD_PRODUCTO_PROV: 'PT-009', COSTO: '90.00' }, nombre_producto: 'Bulón', costo_anterior_centavos: 8000, costo_nuevo_centavos: 9000, estado: 'resuelto_manual', motivo: null },
];

function mockFerreteria() {
  (window as any).ferreteria = {
    importacionCosto: {
      getHistorial: vi.fn().mockResolvedValue(HISTORIAL_MOCK),
      getHistorialDetalle: vi.fn().mockResolvedValue(DETALLE_MOCK),
      cancelar: vi.fn().mockResolvedValue({ ok: true }),
      eliminar: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
}

function renderView() {
  return render(<MemoryRouter><HistorialImportacionCostosView /></MemoryRouter>);
}

describe('HistorialImportacionCostosView — listado', () => {
  beforeEach(() => { mockFerreteria(); });

  it('lista las importaciones con proveedor, archivo, fecha, desglose en vivo y estado', async () => {
    renderView();
    // "Insumos del Sur SA" aparece en tres filas del mock (imp-1, imp-4 e imp-5).
    // Se cuenta sobre las filas de la tabla (no sobre la <option> del filtro por proveedor).
    await screen.findByText('costos_julio.csv');
    const filasProv = screen.getAllByRole('row').slice(1).filter(r => r.textContent?.includes('Insumos del Sur SA'));
    expect(filasProv.length).toBe(3);
    expect(screen.getByText('costos_julio.csv')).toBeDefined();
    expect(screen.getByText('lista_agosto.xlsx')).toBeDefined();
    expect(screen.getAllByText(/confirmado/i).length).toBeGreaterThan(0);
    // "cancelado" aparece como badge de fila y como <option> del filtro de estado.
    const filasCanceladas = screen.getAllByRole('row').slice(1).filter(r => r.textContent?.includes('prueba_incompleta.csv'));
    expect(filasCanceladas.length).toBe(1);
  });

  it('muestra columnas de desglose consistente: Total, Identificados, Rechazados, Pendientes (sin la columna frozen)', async () => {
    renderView();
    await screen.findAllByText('Insumos del Sur SA');
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Identificados' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Rechazados' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Pendientes' })).toBeDefined();
    // ya no existe la columna congelada que confundía
    expect(screen.queryByRole('columnheader', { name: 'Sin matchear' })).toBeNull();
  });
});

describe('HistorialImportacionCostosView — eliminar pendientes/canceladas (followup ADR-051)', () => {
  beforeEach(() => { mockFerreteria(); });

  it('las importaciones "pendiente" y "cancelado" muestran el botón Eliminar; "confirmado" no', async () => {
    renderView();
    await screen.findByText('abandonada.csv');
    // imp-4 (cancelado) + imp-5 (pendiente) → 2 botones; imp-1/imp-2 (confirmado) no lo tienen.
    expect(screen.getAllByText('Eliminar')).toHaveLength(2);
  });

  it('confirmar la eliminación llama a eliminar con el importacion_id y refresca el listado', async () => {
    renderView();
    await screen.findByText('abandonada.csv');
    fireEvent.click(screen.getAllByText('Eliminar')[0]);
    fireEvent.click(screen.getByText('Sí'));
    await waitFor(() => {
      expect((window as any).ferreteria.importacionCosto.eliminar).toHaveBeenCalled();
    });
    expect((window as any).ferreteria.importacionCosto.getHistorial).toHaveBeenCalledTimes(2);
  });

  it('clickear Eliminar no navega al detalle de la importación', async () => {
    renderView();
    await screen.findByText('abandonada.csv');
    fireEvent.click(screen.getAllByText('Eliminar')[0]);
    expect((window as any).ferreteria.importacionCosto.getHistorialDetalle).not.toHaveBeenCalled();
  });

  it('muestra el error cuando falla la eliminación (antes quedaba en silencio)', async () => {
    (window as any).ferreteria.importacionCosto.eliminar = vi.fn().mockRejectedValue(new Error('IMPORTACION_REFERENCIADA'));
    renderView();
    await screen.findByText('abandonada.csv');
    fireEvent.click(screen.getAllByText('Eliminar')[0]);
    fireEvent.click(screen.getByText('Sí'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('IMPORTACION_REFERENCIADA'));
    // la fila sigue en el listado (no se refrescó) y el botón "Eliminar" vuelve a estar disponible
    expect(screen.getByText('abandonada.csv')).toBeInTheDocument();
    expect(screen.getAllByText('Eliminar').length).toBeGreaterThan(0);
  });
});

describe('HistorialImportacionCostosView — filtros y orden (ADR-054)', () => {
  beforeEach(() => { mockFerreteria(); });

  it('filtra el listado por proveedor', async () => {
    renderView();
    await screen.findByText('lista_agosto.xlsx');
    fireEvent.change(screen.getByLabelText(/filtrar por proveedor/i), { target: { value: 'Metalúrgica Norte SRL' } });
    // Solo queda la fila de Metalúrgica (imp-2)
    expect(screen.getByText('lista_agosto.xlsx')).toBeDefined();
    expect(screen.queryByText('costos_julio.csv')).toBeNull();
    expect(screen.queryByText('abandonada.csv')).toBeNull();
  });

  it('filtra el listado por estado', async () => {
    renderView();
    await screen.findByText('abandonada.csv');
    fireEvent.change(screen.getByLabelText(/filtrar por estado/i), { target: { value: 'cancelado' } });
    // Solo imp-4 (cancelado)
    expect(screen.getByText('prueba_incompleta.csv')).toBeDefined();
    expect(screen.queryByText('costos_julio.csv')).toBeNull();
  });

  it('ordena por la cabecera Proveedor (asc/desc)', async () => {
    renderView();
    await screen.findByText('lista_agosto.xlsx');
    const header = screen.getByRole('columnheader', { name: /proveedor/i });
    fireEvent.click(header);
    // asc: "Insumos..." antes que "Metalúrgica..."
    let archivos = screen.getAllByText(/\.(csv|xlsx)$/).map(e => e.textContent);
    // La primera fila de datos debe ser de "Insumos del Sur SA"
    const filas = screen.getAllByRole('row').slice(1); // sin thead
    expect(filas[0].textContent).toContain('Insumos del Sur SA');
    fireEvent.click(header); // desc
    const filasDesc = screen.getAllByRole('row').slice(1);
    expect(filasDesc[0].textContent).toContain('Metalúrgica Norte SRL');
    void archivos;
  });
});

describe('HistorialImportacionCostosView — detalle', () => {
  beforeEach(() => { mockFerreteria(); });

  it('clickear una fila abre el detalle con la tabla única filtrable de esa importación', async () => {
    renderView();
    fireEvent.click(await screen.findByText('costos_julio.csv'));
    await waitFor(() => {
      expect((window as any).ferreteria.importacionCosto.getHistorialDetalle).toHaveBeenCalledWith('imp-1');
    });
    expect(await screen.findByText('Tornillo')).toBeDefined();
    expect(screen.getByText(/sin identificar — revisar en cola de revisión/i)).toBeDefined();
  });

  it('el detalle muestra las filas resuelto_manual (antes se filtraban y desaparecían)', async () => {
    renderView();
    fireEvent.click(await screen.findByText('costos_julio.csv'));
    // la fila d3 es resuelto_manual — debe aparecer con su producto y badge "Resuelto"
    expect(await screen.findByText('Bulón')).toBeDefined();
    expect(screen.getByText('Resuelto')).toBeDefined();
  });

  it('si hay filas sin_matchear y se pasa onVerPendientes, el botón lo invoca (ADR-054)', async () => {
    const onVerPendientes = vi.fn();
    render(<MemoryRouter><HistorialImportacionCostosView onVerPendientes={onVerPendientes} /></MemoryRouter>);
    fireEvent.click(await screen.findByText('costos_julio.csv'));
    await screen.findByText('Tornillo');
    const btn = screen.getByRole('button', { name: /pendientes en revisión/i });
    fireEvent.click(btn);
    expect(onVerPendientes).toHaveBeenCalled();
  });

  it('"Volver" regresa al listado', async () => {
    renderView();
    fireEvent.click(await screen.findByText('costos_julio.csv'));
    await screen.findByText('Tornillo');
    fireEvent.click(screen.getByText(/volver/i));
    expect(await screen.findByText('lista_agosto.xlsx')).toBeDefined();
  });
});
