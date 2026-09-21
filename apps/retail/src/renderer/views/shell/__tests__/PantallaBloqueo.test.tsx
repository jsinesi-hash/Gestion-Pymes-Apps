import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PantallaBloqueo } from '../PantallaBloqueo';
import { AuthContext } from '../../../context/AuthContext';

const sess = {
  id: 'u1',
  nombreCompleto: 'Ana Op',
  rolNombre: 'OPERADOR',
  rolId: 'r',
  permisos: [],
  preferencias: {} as any,
};

function wrap(ui: React.ReactNode, logout = vi.fn()) {
  return (
    <AuthContext.Provider value={{ session: sess as any, can: () => true, login: vi.fn(), logout, actualizarPreferencias: vi.fn() }}>
      {ui}
    </AuthContext.Provider>
  );
}

describe('PantallaBloqueo', () => {
  it('desbloquea con la contraseña correcta', async () => {
    (globalThis as any).ferreteria = { auth: { verifyPassword: vi.fn().mockResolvedValue(true) } };
    const onUnlock = vi.fn();
    render(wrap(<PantallaBloqueo onUnlock={onUnlock} />));
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: /desbloquear/i }));
    await waitFor(() => expect(onUnlock).toHaveBeenCalled());
  });

  it('muestra error con contraseña incorrecta', async () => {
    (globalThis as any).ferreteria = { auth: { verifyPassword: vi.fn().mockResolvedValue(false) } };
    const onUnlock = vi.fn();
    render(wrap(<PantallaBloqueo onUnlock={onUnlock} />));
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /desbloquear/i }));
    expect(await screen.findByText(/incorrecta/i)).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();
  });
});
