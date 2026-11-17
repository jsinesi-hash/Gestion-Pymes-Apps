import { describe, it, expect } from 'vitest';
import type Database from 'better-sqlite3';
import { instalarTriggersSync, nombresTriggersSync } from '@core/db';
import * as schema from '../db/schema';
import { registroSyncElaborados } from '../db/registro-sync';
import { createTestDb } from './helpers';

// Captura de cambios (F1 PR3, ADR-150 §4 y §6) sobre la base de Elaborados migrada. El comportamiento
// de los triggers se prueba en Retail; acá, que existan y compilen para todo el esquema de la app.
const registro = registroSyncElaborados();
const hub = Object.entries(registro).filter(([, e]) => e.tipo !== 'local').map(([t]) => t);
const triggersInstalados = (sqlite: Database.Database) =>
  (sqlite.prepare("select name from sqlite_master where type = 'trigger' and (name like 'sync_ins_%' or name like 'sync_upd_%' or name like 'sync_del_%') order by name").all() as { name: string }[]).map((r) => r.name);

describe('triggers de sync — Elaborados', () => {
  it('en standalone no hay triggers; al instalarlos, cada tabla maestro/libro tiene los suyos y compilan', () => {
    const sqlite = createTestDb().$client as Database.Database;
    // La base de test trae la baranda sin borrado (sync_del_*); la captura no está.
    expect(triggersInstalados(sqlite).filter((n) => !n.startsWith('sync_del_'))).toEqual([]);
    instalarTriggersSync(sqlite, schema, registro);
    expect(triggersInstalados(sqlite)).toEqual([...nombresTriggersSync(schema, registro)].sort());
    expect(triggersInstalados(sqlite)).toHaveLength(hub.length * 3);
    for (const t of hub) {
      expect(() => sqlite.prepare(`insert into "${t}" select * from "${t}" where 0`), t).not.toThrow();
      expect(() => sqlite.prepare(`update "${t}" set "id" = "id" where 0`), t).not.toThrow();
    }
  });
});
