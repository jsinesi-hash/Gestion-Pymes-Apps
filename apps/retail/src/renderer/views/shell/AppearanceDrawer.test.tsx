import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthContext } from '../../context/AuthContext';
import { AppearanceDrawer } from './AppearanceDrawer';

const mockGet = vi.fn();
const mockSave = vi.fn();

function buildAuth() {
  return {
    session: {
      id: 'u1',
      nombreCompleto: 'Juan Perez',
      rolId: 'r1',
      rolNombre: '',
      permisos: [],
      preferencias: {
        tema: 'claro' as const,
        acento: 'amber' as const,
        ui_font: 'Hanken Grotesk' as const,
        densidad: 'comfortable' as const,
        pantalla_inicio: null,
        favoritos: [],
      },
    },
    can: () => false,
    login: async () => {},
    logout: async () => {},
    actualizarPreferencias: () => {},
  };
}

function renderDrawer() {
  return render(
    <AuthContext.Provider value={buildAuth() as any}>
      <AppearanceDrawer onClose={() => {}} />
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // La fila real que devuelve preferencias:get: `favoritos` es un string JSON (columna TEXT),
  // no un array. Reproducir eso es clave para el test de regresión.
  mockGet.mockResolvedValue({
    id: 'p1',
    usuario_id: 'u1',
    tema: 'claro',
    acento: 'amber',
    ui_font: 'Hanken Grotesk',
    densidad: 'comfortable',
    skin: 'actual',
    pantalla_inicio: null,
    favoritos: '[]',
  });
  // Mimetiza el handler: si llega `favoritos` que no es array, normalizarFavoritos() lanza.
  mockSave.mockImplementation(async (payload: any) => {
    if ('favoritos' in payload && !Array.isArray(payload.favoritos)) {
      throw new Error('FAVORITOS_INVALIDOS');
    }
  });
  (window as any).ferreteria = {
    preferencias: { get: mockGet, save: mockSave },
  };
});

describe('AppearanceDrawer', () => {
  it('marca el botón seleccionado al cambiar el tema (no reenvía favoritos al guardar)', async () => {
    renderDrawer();
    // Esperar a que preferencias:get resuelva y el estado local se hidrate con la fila completa.
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const oscuro = screen.getByRole('button', { name: /Oscuro/ });
    expect(oscuro).not.toHaveClass('on');

    fireEvent.click(oscuro);

    await waitFor(() => expect(oscuro).toHaveClass('on'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('oscuro');

    // El payload de guardado no debe arrastrar campos que no son de apariencia.
    const payload = mockSave.mock.calls.at(-1)![0];
    expect(payload).not.toHaveProperty('favoritos');
    expect(payload).not.toHaveProperty('pantalla_inicio');
    expect(payload).toMatchObject({ tema: 'oscuro', usuario_id: 'u1' });
  });

  it('cambia el Modo: aplica data-skin, deriva data-density y marca el botón (ADR-086)', async () => {
    renderDrawer();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const maximizar = screen.getByRole('button', { name: /Maximizar información/ });
    expect(maximizar).not.toHaveClass('on');

    fireEvent.click(maximizar);

    await waitFor(() => expect(maximizar).toHaveClass('on'));
    expect(document.documentElement.getAttribute('data-skin')).toBe('maximizar');
    // La densidad se deriva del modo: maximizar → compact.
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');

    const payload = mockSave.mock.calls.at(-1)![0];
    expect(payload).toMatchObject({ skin: 'maximizar', usuario_id: 'u1' });
    expect(payload).not.toHaveProperty('favoritos');
  });

  it('ya no muestra el control de Densidad (lo reemplazó el Modo)', async () => {
    renderDrawer();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(screen.getByText('Modo')).toBeInTheDocument();
    expect(screen.queryByText('Densidad')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confortable/ })).toBeInTheDocument();
  });
});
