import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { formatPesos } from '@core/ui';
import { PedidosPendientesPanel, hace } from './PedidosPendientesPanel';
import type { PedidoPendiente } from '../../hooks/usePedidosPendientes';

const ahora = Date.now();
const ped = (o: Partial<PedidoPendiente> = {}): PedidoPendiente => ({
  id: 'v1', alias: 'Marta', observaciones: 'Calle 1', en_espera_desde: new Date(ahora - 5 * 60_000),
  turno_creacion_id: null, cliente_id: 'c1', total: 1500.5, count_items: 3, vencida: false, ...o,
});
const props = (o: Partial<ComponentProps<typeof PedidosPendientesPanel>> = {}) => ({
  pedidos: [ped()], pedidoActualId: null, carritoVacio: true, onRetomar: vi.fn(), onDescartar: vi.fn(), onCerrar: vi.fn(), error: null, ...o,
});

describe('PedidosPendientesPanel', () => {
  it('lista alias, observaciones, ítems, total y antigüedad', () => {
    render(<PedidosPendientesPanel {...props()} />);
    expect(screen.getByRole('dialog', { name: 'Pedidos pendientes' })).toBeInTheDocument();
    expect(screen.getByText('Marta')).toBeInTheDocument();
    expect(screen.getByText('Calle 1')).toBeInTheDocument();
    expect(screen.getByText(/3 ítems/)).toBeInTheDocument();
    expect(screen.getByText(formatPesos(Math.round(1500.5 * 100)))).toBeInTheDocument();
    expect(screen.getByText(/hace 5 min/)).toBeInTheDocument();
  });

  it('muestra el badge Vencido', () => {
    render(<PedidosPendientesPanel {...props({ pedidos: [ped({ vencida: true })] })} />);
    expect(screen.getByText('Vencido')).toBeInTheDocument();
  });

  it('Retomar llama a onRetomar con el id', () => {
    const onRetomar = vi.fn();
    render(<PedidosPendientesPanel {...props({ onRetomar })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retomar' }));
    expect(onRetomar).toHaveBeenCalledWith('v1');
  });

  it('con carrito no vacío Retomar está deshabilitado y se lee la ayuda', () => {
    render(<PedidosPendientesPanel {...props({ carritoVacio: false })} />);
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeDisabled();
    expect(screen.getByText('Guardá o vaciá el carrito actual para retomar un pedido')).toBeInTheDocument();
  });

  it('Descartar pide confirmación; recién entonces llama a onDescartar; No cancela', () => {
    const onDescartar = vi.fn();
    render(<PedidosPendientesPanel {...props({ onDescartar })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onDescartar).not.toHaveBeenCalled();
    expect(screen.getByText('¿Descartar?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.queryByText('¿Descartar?')).not.toBeInTheDocument();
    expect(onDescartar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    expect(onDescartar).toHaveBeenCalledWith('v1');
  });

  it('el pedido actual muestra "En el carrito" sin acciones', () => {
    render(<PedidosPendientesPanel {...props({ pedidoActualId: 'v1' })} />);
    expect(screen.getByText('En el carrito')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retomar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
  });

  it('lista vacía, error y cierre', () => {
    const onCerrar = vi.fn();
    render(<PedidosPendientesPanel {...props({ pedidos: [], error: 'Falló', onCerrar })} />);
    expect(screen.getByText('No hay pedidos pendientes')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Falló');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });

  it('hace(): instantes, minutos, horas y días', () => {
    const t = new Date('2026-10-13T12:00:00Z');
    const antes = (ms: number) => new Date(t.getTime() - ms);
    expect(hace(antes(30_000), t)).toBe('hace instantes');
    expect(hace(antes(5 * 60_000), t)).toBe('hace 5 min');
    expect(hace(antes(2 * 3_600_000), t)).toBe('hace 2 h');
    expect(hace(antes(3 * 86_400_000), t)).toBe('hace 3 d');
    expect(hace(antes(5 * 60_000).toISOString(), t)).toBe('hace 5 min');
  });
});
