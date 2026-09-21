import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ImportarView } from './ImportarView';
import { AuthContext, type SessionData } from '../../context/AuthContext';

const mockSession = (permisos: string[]): SessionData => ({
  id: '1', nombreCompleto: 'Admin', rolId: 'sup', rolNombre: '',
  permisos,
  preferencias: { tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable', skin: 'actual', pantalla_inicio: null, favoritos: [] },
});

function renderWithAuth(permisos: string[]) {
  const session = mockSession(permisos);
  return render(
    <AuthContext.Provider value={{ session, can: (c) => permisos.includes(c), login: vi.fn(), logout: vi.fn(), actualizarPreferencias: vi.fn() }}>
      <MemoryRouter><ImportarView /></MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('ImportarView', () => {
  it('redirige si usuario no tiene import.masiva', () => {
    (window as any).ferreteria = undefined;
    renderWithAuth([]);
    expect(screen.queryByText(/importar csv/i)).toBeNull();
  });

  describe('con permiso import.masiva (UploadStep pide la plantilla)', () => {
    beforeEach(() => {
      (window as any).ferreteria = {
        importar: {
          plantilla: vi.fn().mockResolvedValue({
            csv: 'nombre,unidad_medida,precio_venta,iva_alicuota,rubro\nMartillo,u,3200,21,Ferretería\n',
            columnas: ['nombre', 'unidad_medida', 'precio_venta', 'iva_alicuota', 'rubro'],
            ejemplo: ['Martillo', 'u', '3200', '21', 'Ferretería'],
            obligatorias: ['nombre', 'unidad_medida', 'precio_venta', 'iva_alicuota', 'rubro'],
          }),
        },
      };
    });

    it('muestra tabs de entidad para supervisor', () => {
      renderWithAuth(['import.masiva']);
      expect(screen.getByRole('button', { name: /^Productos$/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /^Clientes$/i })).toBeDefined();
    });

    it('muestra el stepper con paso 1 activo', () => {
      renderWithAuth(['import.masiva']);
      expect(screen.getByText(/subir archivo/i)).toBeDefined();
    });

    it('cambiar entidad resetea el estado', () => {
      renderWithAuth(['import.masiva']);
      fireEvent.click(screen.getByRole('button', { name: /^Clientes$/i }));
      expect(screen.getByText(/subir archivo/i)).toBeDefined();
    });
  });
});
