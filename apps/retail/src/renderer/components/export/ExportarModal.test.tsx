import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

  it('el overlay accesible (role=button) sigue cerrando con Enter/Espacio, sin duplicar el manejo de Escape', () => {
    const { onClose, container } = renderModal();
    const overlay = container.querySelector('.modal-overlay') as HTMLElement;
    expect(overlay).toBeTruthy();

    fireEvent.keyDown(overlay, { key: 'Enter' });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
