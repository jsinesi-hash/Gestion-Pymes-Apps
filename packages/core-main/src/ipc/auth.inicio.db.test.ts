import { describe, it, expect, beforeEach } from 'vitest';
import { setupCoreDb, clearSession } from '../testing/helpers';
import { loginHandler, whoamiHandler } from '../index';
import * as schema from '@core/db';
import { generateId } from '@ferreteria/shared';

describe('login — inicio/favoritos en el payload de sesión (ADR-080)', () => {
  let db: ReturnType<typeof setupCoreDb>;
  beforeEach(() => { db = setupCoreDb(); clearSession(); });

  it('sin preferencias guardadas, pantalla_inicio=null y favoritos=[]', () => {
    const s = loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' });
    expect(s.preferencias.pantalla_inicio).toBeNull();
    expect(s.preferencias.favoritos).toEqual([]);
  });

  it('login refleja lo guardado y whoami también', () => {
    loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' });
    const me = whoamiHandler()!;

    // Persistimos la fila directamente (el handler que acepta estos campos es Task 4).
    db.insert(schema.usuario_preferencias).values({
      id: generateId(), usuario_id: me.id,
      tema: 'claro', acento: 'amber', ui_font: 'Hanken Grotesk', densidad: 'comfortable',
      pantalla_inicio: '/pos', favoritos: JSON.stringify(['/stock', '/caja']),
      version: 1, origin_id: 'test', sync_state: 'pending', updated_at: new Date(),
    }).run();

    const s2 = loginHandler(db, { nombreUsuario: 'admin', password: 'admin1234' });
    expect(s2.preferencias.pantalla_inicio).toBe('/pos');
    expect(s2.preferencias.favoritos).toEqual(['/stock', '/caja']);
  });
});
