export type CurrentSession = {
  userId: string;
  rolId: string;
  permisos: Set<string>;
};

export type SessionData = {
  id: string;
  nombreCompleto: string;
  rolId: string;
  rolNombre: string;
  permisos: string[];
  /** Días que le quedan a la contraseña antes de vencer (0..30, ADR-136). */
  passwordDiasRestantes: number;
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

let _session: CurrentSession | null = null;
let _sessionData: SessionData | null = null;

export function getSession(): CurrentSession | null {
  return _session;
}

export function getSessionData(): SessionData | null {
  return _sessionData;
}

export function setSession(session: CurrentSession, data: SessionData): void {
  _session = session;
  _sessionData = data;
}

export function clearSession(): void {
  _session = null;
  _sessionData = null;
}

export function setSessionData(data: SessionData): void {
  _sessionData = data;
}
