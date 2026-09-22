import { eq } from 'drizzle-orm';
import type { IpcMain } from 'electron';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { generateId, normalizarFavoritos, normalizarPantallaInicio } from '@ferreteria/shared';
import * as schema from '../db/schema';
import { getSession, getSessionData, setSessionData, getOriginId } from '@core/main';

type Db = BetterSQLite3Database<typeof schema>;

// Merge parcial: cualquier subconjunto de campos. Apariencia + inicio/favoritos comparten
// esta única ruta de escritura (ADR-080). Validación en el borde (defensa en profundidad,
// espíritu de SEC-2 acotado a este handler).
export type SavePreferenciasPayload = {
  usuario_id: string;
  tema?: 'claro' | 'oscuro';
  acento?: 'amber' | 'blue' | 'green' | 'violet' | 'brick';
  ui_font?: 'Hanken Grotesk' | 'Inter' | 'IBM Plex Sans' | 'Atkinson Hyperlegible' | 'Nunito' | 'Barlow Semi Condensed';
  densidad?: 'comfortable' | 'compact';
  skin?: 'actual' | 'maximizar' | 'confortable';
  pantalla_inicio?: string | null;
  favoritos?: string[];
};

// Estos defaults reflejan `DEFAULT_PREFS` de auth.ts (lo que ve un usuario SIN fila de
// preferencias), NO el default de columna del schema (acento 'blue'). Deliberado: cuando un
// favoritos-only/inicio-only save crea la primera fila del usuario, no debe cambiarle la
// apariencia que ya estaba viendo. Mantener en sync con auth.ts si cambian los defaults.
const DEFAULTS = {
  tema: 'claro' as const,
  acento: 'amber' as const,
  ui_font: 'Hanken Grotesk' as const,
  densidad: 'comfortable' as const,
  skin: 'actual' as const,
  pantalla_inicio: null as string | null,
  favoritos: '[]',
};

export function preferenciasGetHandler(db: Db, payload: { usuario_id: string }) {
  return (
    db.select().from(schema.usuario_preferencias)
      .where(eq(schema.usuario_preferencias.usuario_id, payload.usuario_id))
      .get() ?? null
  );
}

export function preferenciasGuardarHandler(db: Db, payload: SavePreferenciasPayload) {
  const session = getSession();
  if (!session) throw new Error('UNAUTHENTICATED');

  const now = new Date();
  const existing = db.select().from(schema.usuario_preferencias)
    .where(eq(schema.usuario_preferencias.usuario_id, payload.usuario_id)).get();

  // Validación en el borde (lanza si es inválido, antes de tocar la BD).
  const pantalla_inicio = payload.pantalla_inicio !== undefined
    ? normalizarPantallaInicio(payload.pantalla_inicio)
    : (existing?.pantalla_inicio ?? DEFAULTS.pantalla_inicio);
  const favoritosJson = payload.favoritos !== undefined
    ? JSON.stringify(normalizarFavoritos(payload.favoritos))
    : (existing?.favoritos ?? DEFAULTS.favoritos);

  const merged = {
    tema:     payload.tema     ?? existing?.tema     ?? DEFAULTS.tema,
    acento:   payload.acento   ?? existing?.acento   ?? DEFAULTS.acento,
    ui_font:  payload.ui_font  ?? existing?.ui_font  ?? DEFAULTS.ui_font,
    densidad: payload.densidad ?? existing?.densidad ?? DEFAULTS.densidad,
    skin:     payload.skin     ?? existing?.skin     ?? DEFAULTS.skin,
    pantalla_inicio,
    favoritos: favoritosJson,
  };

  if (existing) {
    db.update(schema.usuario_preferencias)
      .set({ ...merged, version: existing.version + 1, sync_state: 'pending', updated_at: now })
      .where(eq(schema.usuario_preferencias.usuario_id, payload.usuario_id)).run();
  } else {
    db.insert(schema.usuario_preferencias).values({
      id: generateId(), usuario_id: payload.usuario_id, ...merged,
      version: 1, origin_id: getOriginId(), sync_state: 'pending', updated_at: now,
    }).run();
  }

  // Mantener la sesión en memoria fresca para que whoami refleje el cambio tras un reload
  // del renderer (el sidebar/InicioRedirect ya se actualizan en caliente por su lado).
  const data = getSessionData();
  if (data && session.userId === payload.usuario_id) {
    setSessionData({
      ...data,
      preferencias: {
        tema: merged.tema, acento: merged.acento, ui_font: merged.ui_font, densidad: merged.densidad,
        skin: merged.skin,
        pantalla_inicio: merged.pantalla_inicio,
        favoritos: JSON.parse(merged.favoritos) as string[],
      },
    });
  }
}

export function registerPreferenciasHandlers(ipcMain: IpcMain, db: Db): void {
  ipcMain.handle('preferencias:get', async (_e, p) => preferenciasGetHandler(db, p));
  ipcMain.handle('preferencias:save', async (_e, p) => preferenciasGuardarHandler(db, p));
}
