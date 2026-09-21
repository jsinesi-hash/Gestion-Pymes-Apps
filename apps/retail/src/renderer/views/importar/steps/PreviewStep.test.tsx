import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewStep } from './PreviewStep';
import type { ImportPreviewResult } from '../../../../main/ipc/importar';

const PREVIEW: ImportPreviewResult = {
  stats: { ok: 1, update: 1, error: 1 },
  rows: [
    { fila: 2, status: 'ok', data: { nombre: 'Martillo' }, raw: { nombre: 'Martillo', unidad_medida: 'u', precio_venta: '3200', iva_alicuota: '21', rubro: 'Herramientas' } },
    { fila: 3, status: 'update', data: { nombre: 'Pala' }, matchKey: 'EAN 123', raw: { nombre: 'Pala', unidad_medida: 'u', precio_venta: '5200', iva_alicuota: '21', rubro: 'Jardín' } },
    { fila: 4, status: 'error', error: 'rubro es obligatorio', raw: { nombre: 'Pinza', unidad_medida: 'u', precio_venta: '2100', iva_alicuota: '21', rubro: '' } },
  ],
};

function setup(overrides: Partial<React.ComponentProps<typeof PreviewStep>> = {}) {
  const onConfirm = vi.fn();
  const onBack = vi.fn();
  const onEditarFila = vi.fn();
  render(
    <PreviewStep preview={PREVIEW} onConfirm={onConfirm} onBack={onBack} onEditarFila={onEditarFila} loading={false} {...overrides} />
  );
  return { onConfirm, onBack, onEditarFila };
}

describe('PreviewStep — columnas y edición (ADR-051 C.3)', () => {
  it('columnas en orden: Línea primero, datos del archivo en el medio, Estado al final', () => {
    setup();
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers[0]).toMatch(/línea/i);
    expect(headers[headers.length - 1]).toMatch(/estado/i);
    expect(headers).toEqual(expect.arrayContaining(['nombre', 'unidad_medida', 'precio_venta', 'iva_alicuota', 'rubro']));
  });

  it('editar una celda llama a onEditarFila con la fila y el raw actualizado', () => {
    const { onEditarFila } = setup();
    const celda = screen.getByText('Herramientas');
    celda.textContent = 'Jardín';
    fireEvent.blur(celda);
    expect(onEditarFila).toHaveBeenCalledWith(2, {
      nombre: 'Martillo', unidad_medida: 'u', precio_venta: '3200', iva_alicuota: '21', rubro: 'Jardín',
    });
  });

  it('chips de filtro: clickear "Error" muestra solo esa fila', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /✕ error/i }));
    expect(screen.queryByText('Martillo')).toBeNull();
    expect(screen.getByText('Pinza')).toBeDefined();
  });

  it('chip "Todos" vuelve a mostrar las 3 filas', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /✕ error/i }));
    fireEvent.click(screen.getByRole('button', { name: /^todos/i }));
    expect(screen.getByText('Martillo')).toBeDefined();
    expect(screen.getByText('Pala')).toBeDefined();
    expect(screen.getByText('Pinza')).toBeDefined();
  });
});

describe('PreviewStep — modal de confirmación (ADR-051 C.3)', () => {
  it('clickear "Confirmar importación" abre el modal en vez de confirmar directo', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByText(/confirmar importación/i));
    expect(screen.getByText(/se van a (crear|procesar)/i)).toBeDefined();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirmar en el modal llama a onConfirm', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByText(/confirmar importación/i));
    fireEvent.click(screen.getByRole('button', { name: /^confirmar$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('cancelar en el modal no confirma', () => {
    const { onConfirm } = setup();
    fireEvent.click(screen.getByText(/confirmar importación/i));
    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText(/se van a (crear|procesar)/i)).toBeNull();
  });
});
