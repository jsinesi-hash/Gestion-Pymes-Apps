import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { RolesPermisosView } from '../RolesPermisosView';

const mockMatriz = vi.fn();

const MATRIZ = {
  roles: [
    { id: 'r_op', nombre: 'OPERADOR' },
    { id: 'r_sup', nombre: 'SUPERVISOR' },
  ],
  permisos: [
    { codigo: 'venta.crear', descripcion: null, modulo: 'ventas' },
    { codigo: 'venta.anular', descripcion: null, modulo: 'ventas' },
    { codigo: 'usuario.administrar', descripcion: null, modulo: 'admin' },
  ],
  porRol: {
    r_op: ['venta.crear'],
    r_sup: ['venta.crear', 'venta.anular', 'usuario.administrar'],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).ferreteria = { permisos: { matriz: mockMatriz } };
});

describe('RolesPermisosView (ADR-087)', () => {
  it('muestra nombres amigables, columnas por rol y el badge de solo lectura', async () => {
    mockMatriz.mockResolvedValue(MATRIZ);
    render(<RolesPermisosView />);

    // etiquetas amigables (no los códigos crudos)
    expect(await screen.findByText('Vender (POS)')).toBeInTheDocument();
    expect(screen.getByText('Anular ventas')).toBeInTheDocument();
    expect(screen.getByText('Administrar usuarios')).toBeInTheDocument();

    // columnas de rol + badge solo lectura
    expect(screen.getByText('Solo lectura')).toBeInTheDocument();
    expect(screen.getAllByText('OPERADOR').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SUPERVISOR').length).toBeGreaterThan(0);
  });

  it('resume el conteo por rol (Operador 1/3, Supervisor 3/3)', async () => {
    mockMatriz.mockResolvedValue(MATRIZ);
    render(<RolesPermisosView />);
    await screen.findByText('Vender (POS)');

    expect(screen.getByText(/1/)).toBeInTheDocument();
    // los textos "/ 3 permisos" aparecen en ambas tarjetas
    expect(screen.getAllByText(/\/ 3 permisos/).length).toBe(2);
  });

  it('marca ✓ donde el rol tiene el permiso y — donde no (fila Anular ventas)', async () => {
    mockMatriz.mockResolvedValue(MATRIZ);
    render(<RolesPermisosView />);
    const celda = await screen.findByText('Anular ventas');
    const fila = celda.closest('tr')!;
    // OPERADOR no tiene venta.anular → hay un "—" en la fila; SUPERVISOR sí → hay un "✓"
    expect(within(fila).getByText('—')).toBeInTheDocument();
    expect(within(fila).getByText('✓')).toBeInTheDocument();
  });

  it('muestra error si el handler rechaza', async () => {
    mockMatriz.mockRejectedValue(new Error('FORBIDDEN'));
    render(<RolesPermisosView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('FORBIDDEN');
  });
});
