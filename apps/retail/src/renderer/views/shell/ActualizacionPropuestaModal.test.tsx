import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActualizacionPropuestaModal } from './ActualizacionPropuestaModal';

describe('ActualizacionPropuestaModal', () => {
  it('muestra la versión y los dos botones', () => {
    render(<ActualizacionPropuestaModal version="1.2.0" onInstalar={vi.fn()} onPosponer={vi.fn()} />);
    expect(screen.getByText(/1\.2\.0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar ahora/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ahora no/i })).toBeInTheDocument();
  });

  it('"Actualizar ahora" invoca onInstalar', () => {
    const onInstalar = vi.fn();
    render(<ActualizacionPropuestaModal version="1.2.0" onInstalar={onInstalar} onPosponer={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /actualizar ahora/i }));
    expect(onInstalar).toHaveBeenCalledTimes(1);
  });

  it('"Ahora no" invoca onPosponer', () => {
    const onPosponer = vi.fn();
    render(<ActualizacionPropuestaModal version="1.2.0" onInstalar={vi.fn()} onPosponer={onPosponer} />);
    fireEvent.click(screen.getByRole('button', { name: /ahora no/i }));
    expect(onPosponer).toHaveBeenCalledTimes(1);
  });
});
