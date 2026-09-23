import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { bridge } from '../bridge';

export type SessionData = {
  id: string;
  nombreCompleto: string;
  rolId: string;
  rolNombre: string;
  permisos: string[];
  preferencias: {
    tema: 'claro' | 'oscuro';
    acento: 'amber' | 'blue' | 'green' | 'violet' | 'brick';
    ui_font: 'Hanken Grotesk' | 'Inter' | 'IBM Plex Sans' | 'Atkinson Hyperlegible' | 'Nunito' | 'Barlow Semi Condensed';
    densidad: 'comfortable' | 'compact';
    skin: 'actual' | 'maximizar' | 'confortable';
    pantalla_inicio: string | null;
    favoritos: string[];
  };
};

export type LoginCreds = {
  nombreUsuario: string;
  password?: string;
  pin?: string;
};

type AuthContextValue = {
  session: SessionData | null;
  can: (codigo: string) => boolean;
  login: (creds: LoginCreds) => Promise<void>;
  logout: () => Promise<void>;
  actualizarPreferencias: (patch: Partial<SessionData['preferencias']>) => void;
};

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  can: () => false,
  login: async () => {},
  logout: async () => {},
  actualizarPreferencias: () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

function applyPreferences(prefs: SessionData['preferencias']): void {
  const html = document.documentElement;
  html.dataset.theme = prefs.tema;
  html.dataset.accent = prefs.acento;
  html.dataset.skin = prefs.skin;
  // ADR-086: la densidad se DERIVA del modo (el Modo reemplazó al control de Densidad).
  html.dataset.density = prefs.skin === 'maximizar' ? 'compact' : 'comfortable';
  html.style.setProperty('--ui-font', prefs.ui_font);
}

function rebuildMenu(): void {
  // El menú nativo se reconstruye por rol; no romper si el bridge no está (tests).
  const p = bridge().menu?.rebuild?.();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rehidratar sesión si el renderer recarga mientras main sigue corriendo
    // En entorno de prueba o si window.ferreteria no está disponible, no hacer nada
    const ferreteria = bridge();
    if (ferreteria?.auth?.whoami) {
      ferreteria.auth.whoami().then((data: SessionData | null) => {
        if (data) {
          setSession(data);
          applyPreferences(data.preferencias);
          rebuildMenu();
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  async function login(creds: LoginCreds): Promise<void> {
    const ferreteria = bridge();
    if (ferreteria?.auth?.login) {
      const data: SessionData = await ferreteria.auth.login(creds);
      setSession(data);
      applyPreferences(data.preferencias);
      rebuildMenu();
    }
  }

  async function logout(): Promise<void> {
    const ferreteria = bridge();
    if (ferreteria?.auth?.logout) {
      await ferreteria.auth.logout();
    }
    setSession(null);
    rebuildMenu();
  }

  function can(codigo: string): boolean {
    return session?.permisos.includes(codigo) ?? false;
  }

  function actualizarPreferencias(patch: Partial<SessionData['preferencias']>): void {
    setSession((prev) => (prev ? { ...prev, preferencias: { ...prev.preferencias, ...patch } } : prev));
  }

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ session, can, login, logout, actualizarPreferencias }}>
      {children}
    </AuthContext.Provider>
  );
}
