import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useAuth, AuthProvider } from './AuthContext';

// Sonda que expone la sesión y un botón que actualiza favoritos.
function Sonda() {
  const { session, actualizarPreferencias } = useAuth();
  return (
    <div>
      <span data-testid="fav">{JSON.stringify(session?.preferencias.favoritos ?? null)}</span>
      <button onClick={() => actualizarPreferencias({ favoritos: ['/pos'] })}>go</button>
    </div>
  );
}

describe('AuthContext.actualizarPreferencias', () => {
  it('con sesión nula no rompe y no crea sesión', () => {
    render(<AuthProvider><Sonda /></AuthProvider>);
    // Sin bridge de auth, loading termina y session queda null.
    act(() => { screen.getByText('go').click(); });
    expect(screen.getByTestId('fav').textContent).toBe('null');
  });
});
