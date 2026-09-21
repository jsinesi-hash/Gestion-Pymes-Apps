import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryStep } from './SummaryStep';
import type { ImportSummaryResult } from '../../../../main/ipc/importar';

const SUMMARY: ImportSummaryResult = {
  stats: { created: 1, updated: 1, error: 1 },
  rows: [
    { fila: 2, status: 'created', mensaje: 'Martillo creado', raw: { nombre: 'Martillo', rubro: 'Herramientas' } },
    { fila: 3, status: 'updated', mensaje: 'Pala actualizado', raw: { nombre: 'Pala', rubro: 'Jardín' } },
    { fila: 4, status: 'error', mensaje: 'rubro es obligatorio', raw: { nombre: 'Pinza', rubro: '' } },
  ],
};

beforeEach(() => {
  (URL as any).createObjectURL = vi.fn().mockReturnValue('blob:x');
  (URL as any).revokeObjectURL = vi.fn();
});

describe('SummaryStep — chips de filtro y tabla completa (ADR-051 C.4)', () => {
  it('las tarjetas de conteo son chips clickeables, no estáticas', () => {
    render(<SummaryStep summary={SUMMARY} onNueva={vi.fn()} />);
    fireEvent.click(screen.getByText(/errores \(1\)/i));
    expect(screen.queryByText('Martillo')).toBeNull();
    expect(screen.getByText('Pinza')).toBeDefined();
  });

  it('la tabla muestra las columnas de datos, no solo fila+mensaje', () => {
    render(<SummaryStep summary={SUMMARY} onNueva={vi.fn()} />);
    expect(screen.getByText('Martillo')).toBeDefined();
    expect(screen.getByText('Herramientas')).toBeDefined();
  });

  it('la descarga CSV usa el filtro activo', () => {
    render(<SummaryStep summary={SUMMARY} onNueva={vi.fn()} />);
    fireEvent.click(screen.getByText(/creadas \(1\)/i));
    const createObjectURL = URL.createObjectURL as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByText(/descargar filtro actual/i));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('ofrece un botón dedicado para descargar sólo los errores (PRICE-4)', () => {
    render(<SummaryStep summary={SUMMARY} onNueva={vi.fn()} />);
    const createObjectURL = URL.createObjectURL as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByText(/descargar errores/i));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('sin errores no muestra el botón de descargar errores', () => {
    const sinErrores: ImportSummaryResult = {
      stats: { created: 1, updated: 0, error: 0 },
      rows: [{ fila: 2, status: 'created', mensaje: 'ok', raw: { nombre: 'X' } }],
    };
    render(<SummaryStep summary={sinErrores} onNueva={vi.fn()} />);
    expect(screen.queryByText(/descargar errores/i)).toBeNull();
  });
});
