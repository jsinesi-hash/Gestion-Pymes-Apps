import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, setupDb, loginAsAdmin } from '../../ipc/__tests__/helpers';
import * as schema from '../schema';

describe('ADR-047 — schema agenda (migracion 0026)', () => {
  it('siembra los 9 parametros con sus defaults', () => {
    const db = createTestDb();
    const params = db.select().from(schema.parametros_sistema).all();
    const byClave = new Map(params.map((p) => [p.clave, p]));
    const esperados: Array<[string, string]> = [
      // ADR-060 (migración 0035): agenda viene encendida de fábrica en 1.1.x
      // (0026 la siembra en 'false', 0035 la flipa a 'true').
      ['agenda_habilitado', 'true'],
      ['agenda_ventana_proximos_dias', '14'],
      ['agenda_catchup_limite', '90'],
      ['aviso_reintentos_max', '5'],
      ['aviso_backoff_base_seg', '30'],
      ['aviso_retencion_dias', '90'],
      ['notif_cierre_caja_email', 'false'],
      ['notif_recepcion_email', 'false'],
      ['notif_bajo_minimo_email', 'false'],
    ];
    for (const [clave, valor] of esperados) {
      expect(byClave.get(clave), `falta ${clave}`).toBeDefined();
      expect(byClave.get(clave)!.valor, clave).toBe(valor);
    }
  });

  it('permite insertar rutina -> agenda_evento -> aviso respetando FKs', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const now = new Date();

    db.insert(schema.rutina).values({
      id: 'rut-1', nombre: 'Revisar proveedor X',
      frecuencia_tipo: 'semanal', intervalo: 1, dia_semana: 1, hora: '09:00',
      fecha_inicio: now, proximo_disparo: now,
      destinatario_tipo: 'usuario', destinatario_usuario_id: admin.id,
      canal_in_app: true, canal_email: false, activa: true, activo: true,
      usuario_creacion_id: admin.id, fecha_creacion: now,
      version: 1, origin_id: 'C1', sync_state: 'pending', updated_at: now,
    }).run();

    db.insert(schema.agenda_evento).values({
      id: 'ev-1', origen: 'rutina', rutina_id: 'rut-1',
      titulo: 'Revisar proveedor X', fecha: now, estado: 'pendiente',
      destinatario_tipo: 'usuario', destinatario_usuario_id: admin.id,
      canal_in_app: true, canal_email: false, activo: true,
      usuario_creacion_id: admin.id, fecha_creacion: now,
      version: 1, origin_id: 'C1', sync_state: 'pending', updated_at: now,
    }).run();

    db.insert(schema.aviso).values({
      id: 'av-1', agenda_evento_id: 'ev-1', origen_tipo: 'agenda_evento', origen_id: 'ev-1',
      canal: 'in_app', destinatario_usuario_id: admin.id,
      payload: JSON.stringify({ titulo: 'Revisar proveedor X', cuerpo: '...' }),
      estado: 'pendiente', intentos: 0, generado_at: now,
    }).run();

    expect(db.select().from(schema.rutina).all()).toHaveLength(1);
    expect(db.select().from(schema.agenda_evento).all()).toHaveLength(1);
    expect(db.select().from(schema.aviso).where(eq(schema.aviso.id, 'av-1')).get()?.canal).toBe('in_app');
  });

  it('aviso.severidad existe con default normal (migracion 0027)', () => {
    const db = createTestDb();
    const sqlite = (db as any).$client as import('better-sqlite3').Database;
    const columnas = sqlite.prepare("PRAGMA table_info('aviso')").all() as Array<{ name: string; dflt_value: string | null }>;
    const severidad = columnas.find((c) => c.name === 'severidad');
    expect(severidad, 'falta columna severidad').toBeDefined();
    expect(severidad!.dflt_value).toContain('normal');
  });

  it('aviso.dedupe_clave es UNIQUE pero admite multiples NULL', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const now = new Date();
    const base = {
      origen_tipo: 'test', canal: 'in_app' as const, destinatario_usuario_id: admin.id,
      payload: '{}', estado: 'pendiente' as const, intentos: 0, generado_at: now,
    };
    // dos avisos con dedupe null: conviven
    db.insert(schema.aviso).values({ id: 'a1', ...base }).run();
    db.insert(schema.aviso).values({ id: 'a2', ...base }).run();
    // dos con la misma dedupe_clave: la segunda viola el UNIQUE
    db.insert(schema.aviso).values({ id: 'a3', dedupe_clave: 'dup', ...base }).run();
    expect(() =>
      db.insert(schema.aviso).values({ id: 'a4', dedupe_clave: 'dup', ...base }).run(),
    ).toThrow();
  });
});
