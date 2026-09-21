import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VistosRecientemente } from './VistosRecientemente';
import type { VistoReciente } from '../hooks/useVistosRecientes';

const P: VistoReciente = { tipo: 'producto', id: 'p1', etiqueta: 'Tornillo', ts: 2 };
const C: VistoReciente = { tipo: 'cliente', id: 'c1', etiqueta: 'Ana Gómez', ts: 1 };

describe('VistosRecientemente (ADR-081 / PERF-2)', () => {
  it('renderiza un chip por cada visto permitido', () => {
    render(<VistosRecientemente vistos={[P, C]} can={() => true} onAbrir={vi.fn()} />);
    expect(screen.getByText('Tornillo')).toBeInTheDocument();
    expect(screen.getByText('Ana Gómez')).toBeInTheDocument();
  });

  it('no renderiza items cuyo detalle el rol no puede abrir', () => {
    // rol sin ctacte.cobrar: los clientes se ocultan; los productos quedan
    const can = (codigo: string) => codigo === 'producto.consultar';
    render(<VistosRecientemente vistos={[P, C]} can={can} onAbrir={vi.fn()} />);
    expect(screen.getByText('Tornillo')).toBeInTheDocument();
    expect(screen.queryByText('Ana Gómez')).toBeNull();
  });

  it('no renderiza nada cuando la lista está vacía', () => {
    const { container } = render(<VistosRecientemente vistos={[]} can={() => true} onAbrir={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('no renderiza nada cuando todo queda filtrado por permiso', () => {
    const { container } = render(<VistosRecientemente vistos={[C]} can={() => false} onAbrir={vi.fn()} />);
    expect(container.textContent).toBe('');
  });

  it('un click en un chip llama onAbrir con el visto', () => {
    const onAbrir = vi.fn();
    render(<VistosRecientemente vistos={[P]} can={() => true} onAbrir={onAbrir} />);
    fireEvent.click(screen.getByText('Tornillo'));
    expect(onAbrir).toHaveBeenCalledWith(P);
  });
});
