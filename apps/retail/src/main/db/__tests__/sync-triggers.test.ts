import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  aplicandoCambiosRecibidos,
  desinstalarTriggersSync,
  instalarTriggersSync,
  nombresTriggersSync,
} from '@core/db';
import * as schema from '../schema';
import { registroSyncRetail } from '../registro-sync';
import { createTestDb } from '../../ipc/__tests__/helpers';

// Captura de cambios (F1 PR3, ADR-150 §4 y §6) sobre la base de Retail migrada.
const registro = registroSyncRetail();
const hub = Object.entries(registro).filter(([, e]) => e.tipo !== 'local').map(([t]) => t);

function nuevaBase(): Database.Database {
  return createTestDb().$client as Database.Database;
}
function triggersInstalados(sqlite: Database.Database): string[] {
  return (sqlite.prepare("select name from sqlite_master where type = 'trigger' and name like 'sync_%' order by name").all() as { name: string }[]).map((r) => r.name);
}
function outbox(sqlite: Database.Database) {
  return sqlite.prepare('select tabla, fila_id, operacion, version, fila from sync_outbox order by seq').all() as {
    tabla: string; fila_id: string; operacion: string; version: number; fila: string;
  }[];
}
const insertarMarca = (sqlite: Database.Database, id: string, nombre: string) =>
  sqlite
    .prepare(
      "insert into marca (id, nombre, activo, usuario_creacion_id, fecha_creacion, origin_id, updated_at, sync_state) values (?, ?, 1, 'u1', 0, 'C1', 0, 'synced')",
    )
    .run(id, nombre);

describe('triggers de sync — Retail', () => {
  let sqlite: Database.Database;
  beforeEach(() => {
    sqlite = nuevaBase();
  });

  it('en standalone (base recién migrada) no hay triggers de captura', () => {
    expect(triggersInstalados(sqlite)).toEqual([]);
  });

  it('al instalarlos, toda tabla maestro/libro tiene su trigger de alta y de modificación, y todos compilan', () => {
    instalarTriggersSync(sqlite, schema, registro);
    expect(triggersInstalados(sqlite)).toEqual([...nombresTriggersSync(schema, registro)].sort());
    expect(triggersInstalados(sqlite)).toHaveLength(hub.length * 2);
    // Preparar (sin ejecutar) un INSERT y un UPDATE compila los triggers de la tabla: un error en el
    // cuerpo (columna inexistente, demasiados argumentos) aparece acá y no en producción.
    for (const t of hub) {
      expect(() => sqlite.prepare(`insert into "${t}" select * from "${t}" where 0`), t).not.toThrow();
      expect(() => sqlite.prepare(`update "${t}" set "id" = "id" where 0`), t).not.toThrow();
    }
  });

  it('es idempotente y se puede desinstalar', () => {
    instalarTriggersSync(sqlite, schema, registro);
    instalarTriggersSync(sqlite, schema, registro);
    expect(triggersInstalados(sqlite)).toHaveLength(hub.length * 2);
    desinstalarTriggersSync(sqlite, schema, registro);
    expect(triggersInstalados(sqlite)).toEqual([]);
  });

  it('un alta encola la fila completa y la deja pending', () => {
    instalarTriggersSync(sqlite, schema, registro);
    insertarMarca(sqlite, 'm1', 'Stanley');
    const [c] = outbox(sqlite);
    expect(c).toMatchObject({ tabla: 'marca', fila_id: 'm1', operacion: 'insert', version: 1 });
    expect(JSON.parse(c.fila)).toMatchObject({ id: 'm1', nombre: 'Stanley', origin_id: 'C1' });
    expect(sqlite.prepare("select sync_state from marca where id = 'm1'").get()).toEqual({ sync_state: 'pending' });
  });

  it('una modificación sube la versión si el handler no la subió, y la respeta si la subió', () => {
    insertarMarca(sqlite, 'm1', 'Stanley');
    instalarTriggersSync(sqlite, schema, registro);
    sqlite.prepare("update marca set nombre = 'Stanley Black' where id = 'm1'").run();
    sqlite.prepare("update marca set nombre = 'SB', version = 7 where id = 'm1'").run();
    expect(outbox(sqlite).map((c) => [c.operacion, c.version])).toEqual([['update', 2], ['update', 7]]);
    expect(JSON.parse(outbox(sqlite)[1].fila)).toMatchObject({ nombre: 'SB', version: 7 });
  });

  it('marcar synced o tocar solo updated_at no encola', () => {
    insertarMarca(sqlite, 'm1', 'Stanley');
    instalarTriggersSync(sqlite, schema, registro);
    sqlite.prepare("update marca set sync_state = 'synced', updated_at = 99 where id = 'm1'").run();
    expect(outbox(sqlite)).toEqual([]);
  });

  it('un cambio solo de columnas proyectadas (el saldo de stock) no encola; la fila nunca las lleva', () => {
    sqlite.pragma('foreign_keys = OFF'); // existencias sin producto: el test mira solo la captura
    sqlite.prepare("insert into existencias (id, producto_id, stock_fisico, stock_minimo, origin_id, updated_at) values ('e1', 'p1', 5, 2, 'C1', 0)").run();
    instalarTriggersSync(sqlite, schema, registro);
    sqlite.prepare("update existencias set stock_fisico = 4, ultima_fecha_movimiento = 10, updated_at = 10 where id = 'e1'").run();
    expect(outbox(sqlite)).toEqual([]);
    sqlite.prepare("update existencias set stock_minimo = 3 where id = 'e1'").run();
    const [c] = outbox(sqlite);
    expect(JSON.parse(c.fila)).toMatchObject({ stock_minimo: 3 });
    expect(JSON.parse(c.fila)).not.toHaveProperty('stock_fisico');
  });

  it('lo aplicado desde el hub no vuelve a la cola, y el interruptor queda apagado (también si falla)', () => {
    instalarTriggersSync(sqlite, schema, registro);
    aplicandoCambiosRecibidos(sqlite, () => insertarMarca(sqlite, 'm1', 'Del hub'));
    expect(outbox(sqlite)).toEqual([]);
    expect(() =>
      aplicandoCambiosRecibidos(sqlite, () => {
        insertarMarca(sqlite, 'm2', 'Falla');
        throw new Error('pagina rota');
      }),
    ).toThrow('pagina rota');
    expect(sqlite.prepare('select count(*) as n from sync_aplicando').get()).toEqual({ n: 0 });
    expect(sqlite.prepare("select count(*) as n from marca where id = 'm2'").get()).toEqual({ n: 0 });
    insertarMarca(sqlite, 'm3', 'Local');
    expect(outbox(sqlite).map((c) => c.fila_id)).toEqual(['m3']);
  });
});
