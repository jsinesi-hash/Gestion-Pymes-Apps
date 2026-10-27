import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { ExportarModal } from '@core/ui';
import { AuthContext } from '@core/ui';

const definicion = {
  entidad: 'productos',
  label: 'Productos',
  perfiles: [
    { id: 'basico', label: 'Básico', permiso: 'export.basico', defaultFormato: 'csv' as const },
  ],
};

function renderModal(onClose = vi.fn()) {
  const utils = render(
    <AuthContext.Provider value={{ can: () => true } as any}>
      <ExportarModal definicion={definicion as any} onClose={onClose} />
    </AuthContext.Provider>
  );
  return { onClose, ...utils };
}

beforeEach(() => {
  (window as any).ferreteria = { exportar: { ejecutar: vi.fn().mockResolvedValue(undefined) } };
});

describe('ExportarModal — cierre con Escape', () => {
  it('llama a onClose al presionar Escape', () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Revisión 2026-10-20 (P2): el overlay dejó de ser un `role="button"` (truco para acallar a
  // SonarCloud). El cierre por teclado es Escape (una sola vez, sin duplicar el manejo), por mouse
  // la × del encabezado o un click fuera, y el diálogo es modal con nombre accesible.
  it('el overlay ya no es un control: no hay role=button ni tabindex en él', () => {
    const { container } = renderModal();
    const overlay = container.querySelector('.modal-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay).not.toHaveAttribute('role');
    expect(overlay).not.toHaveAttribute('tabindex');
  });

  it('un click fuera del diálogo cierra una sola vez (mousedown + click en el overlay)', () => {
    const { onClose, container } = renderModal();
    const overlay = container.querySelector('.modal-overlay') as HTMLElement;
    fireEvent.mouseDown(overlay);
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('la × del encabezado cierra y el diálogo es modal con nombre accesible', () => {
    const { onClose } = renderModal();
    const dialogo = screen.getByRole('dialog', { name: /Exportar/ });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
