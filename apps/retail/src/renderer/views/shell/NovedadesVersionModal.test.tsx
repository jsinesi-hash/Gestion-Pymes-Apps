import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NovedadesVersionModal } from './NovedadesVersionModal';

describe('NovedadesVersionModal', () => {
  it('muestra el título y todas las notas', () => {
    render(
      <NovedadesVersionModal
        titulo="Novedades 1.1.0"
        notas={['Remitos', 'Presupuestos']}
        onContinuar={vi.fn()}
      />,
    );
    expect(screen.getByText('Novedades 1.1.0')).toBeInTheDocument();
    expect(screen.getByText('Remitos')).toBeInTheDocument();
    expect(screen.getByText('Presupuestos')).toBeInTheDocument();
  });

  it('"Continuar" invoca onContinuar', () => {
    const onContinuar = vi.fn();
    render(<NovedadesVersionModal titulo="x" notas={['a']} onContinuar={onContinuar} />);
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(onContinuar).toHaveBeenCalledTimes(1);
  });
});
