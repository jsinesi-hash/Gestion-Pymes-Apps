import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ejecutarComandoHub, type OpcionesHub } from './arranque';
import { abrirAlmacenHub } from './almacen';
import { listarRespaldos, respaldarHub, restaurarRespaldo, respaldoVencido } from './respaldo';
import { esquemaPrueba, registroPrueba } from './__fixtures__/esquema';

// F3 PR6 (análisis §3.8): en modo distribuido el backup completo es el del hub. El hub copia su base con la
// API de backup de SQLite (funciona con la base en uso), guarda las últimas N copias y se restaura desde la
// consola con el hub detenido, dejando antes una copia de la base que pisa.
const MIGRACIONES = path.resolve(__dirname, '__fixtures__/migraciones');

describe('backup del hub', () => {
  const carpetas: string[] = [];
  const cerrar: (() => Promise<void>)[] = [];
  afterEach(async () => {
    for (const c of cerrar.splice(0)) await c();
    for (const d of carpetas.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  function opciones(): OpcionesHub & { salida: string[] } {
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-backup-'));
    carpetas.push(carpeta);
    const salida: string[] = [];
    return { nombre: 'hub-prueba', schema: esquemaPrueba, registro: registroPrueba, migracionesApp: MIGRACIONES, carpeta, escribir: (l) => salida.push(l), salida };
  }
  const marca = (id: string, nombre: string) => ({ tabla: 'marca', fila: { id, nombre, activo: 1, version: 1, origin_id: 'C1', sync_state: 'pending', updated_at: 100 } });
  const marcasDe = (archivo: string) => {
    const db = new Database(archivo, { readonly: true });
    try { return (db.prepare('select nombre from marca order by nombre').all() as { nombre: string }[]).map((r) => r.nombre); } finally { db.close(); }
  };

  it('respalda la base en uso, guarda solo las últimas N y las lista de la más nueva a la más vieja', async () => {
    const o = opciones();
    const sqlite = new Database(path.join(o.carpeta, 'hub.db'));
    const hub = abrirAlmacenHub(sqlite, { schema: esquemaPrueba, registro: registroPrueba, migracionesApp: MIGRACIONES });
    hub.aplicarLote('C1', [marca('m1', 'Stanley')]);
    const t0 = new Date('2026-11-25T10:00:00');
    for (let i = 0; i < 4; i++) await respaldarHub(sqlite, o.carpeta, { retener: 3, ahora: new Date(t0.getTime() + i * 3_600_000) });
    sqlite.close();
    const lista = listarRespaldos(o.carpeta);
    expect(lista.map((r) => path.basename(r.archivo))).toEqual(['hub-20261125-130000.db', 'hub-20261125-120000.db', 'hub-20261125-110000.db']);
    expect(marcasDe(lista[0]!.archivo)).toEqual(['Stanley']);
    // Cada copia es un solo archivo (sin -wal ni -shm al lado), aunque la base del hub esté en WAL.
    expect(fs.readdirSync(path.join(o.carpeta, 'backups')).filter((f) => /-(wal|shm)$/.test(f))).toEqual([]);
  });

  it('dos copias en el mismo segundo no se pisan, y la de sufijo -2 es la más nueva', async () => {
    const o = opciones();
    const sqlite = new Database(path.join(o.carpeta, 'hub.db'));
    const ahora = new Date('2026-11-25T10:00:00');
    const primera = await respaldarHub(sqlite, o.carpeta, { ahora });
    const segunda = await respaldarHub(sqlite, o.carpeta, { ahora });
    sqlite.close();
    expect(path.basename(segunda)).toBe('hub-20261125-100000-2.db');
    expect(listarRespaldos(o.carpeta).map((r) => r.archivo)).toEqual([segunda, primera]);
  });

  it('respaldoVencido: sin copias o con la última de hace más de 24 h', async () => {
    const o = opciones();
    const sqlite = new Database(path.join(o.carpeta, 'hub.db'));
    expect(respaldoVencido(o.carpeta, new Date('2026-11-25T10:00:00'))).toBe(true);
    await respaldarHub(sqlite, o.carpeta, { ahora: new Date('2026-11-25T10:00:00') });
    sqlite.close();
    expect(respaldoVencido(o.carpeta, new Date('2026-11-25T20:00:00'))).toBe(false);
    expect(respaldoVencido(o.carpeta, new Date('2026-11-26T11:00:00'))).toBe(true);
  });

  it('comandos backup, backups y restaurar-backup: restaura y deja una copia de la base que pisa', async () => {
    const o = opciones();
    const h = await ejecutarComandoHub(['iniciar', '--puerto', '0', '--host', '127.0.0.1'], o);
    await h!.cerrar();
    const anotar = (nombre: string) => {
      const sqlite = new Database(path.join(o.carpeta, 'hub.db'));
      abrirAlmacenHub(sqlite, { schema: esquemaPrueba, registro: registroPrueba, migracionesApp: MIGRACIONES }).aplicarLote('C1', [marca(`id-${nombre}`, nombre)]);
      sqlite.close();
    };
    anotar('Antes');
    await ejecutarComandoHub(['backup'], o);
    const [copia] = listarRespaldos(o.carpeta);
    anotar('Después');

    await ejecutarComandoHub(['backups'], o);
    expect(o.salida.join('\n')).toContain(path.basename(copia!.archivo));

    await ejecutarComandoHub(['restaurar-backup', copia!.archivo, '--puerto', '1'], o);
    expect(marcasDe(path.join(o.carpeta, 'hub.db'))).toEqual(['Antes']);
    // La base que se pisó quedó guardada, con lo que tenía.
    const previa = fs.readdirSync(path.join(o.carpeta, 'backups')).find((f) => f.startsWith('hub-antes-de-restaurar-'))!;
    expect(marcasDe(path.join(o.carpeta, 'backups', previa))).toEqual(['Antes', 'Después']);
  });

  it('no restaura con el hub en marcha ni un archivo que no es una base del hub', async () => {
    const o = opciones();
    const h = await ejecutarComandoHub(['iniciar', '--puerto', '0', '--host', '127.0.0.1'], o);
    cerrar.push(() => h!.cerrar());
    await ejecutarComandoHub(['backup'], o);
    const [copia] = listarRespaldos(o.carpeta);
    await expect(ejecutarComandoHub(['restaurar-backup', copia!.archivo, '--puerto', String(h!.puerto)], o)).rejects.toThrow('HUB_EN_MARCHA');

    const falso = path.join(o.carpeta, 'otra.db');
    const db = new Database(falso);
    db.exec('create table x (a)');
    db.close();
    await expect(restaurarRespaldo(o.carpeta, falso, { puerto: 1 })).rejects.toThrow('RESPALDO_INVALIDO');
    await expect(restaurarRespaldo(o.carpeta, path.join(o.carpeta, 'no-existe.db'), { puerto: 1 })).rejects.toThrow('RESPALDO_INEXISTENTE');
  });
});
