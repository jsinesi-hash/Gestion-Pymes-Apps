import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin } from '../../ipc/__tests__/helpers';
import * as schema from '../../db/schema';
import { insertarAvisos, emitirAviso, despacharAviso, type ComandoAviso } from '../aviso-servicio';

function cmd(over: Partial<ComandoAviso> = {}): ComandoAviso {
  return {
    origen_tipo: 'cierre_caja', titulo: 'Caja cerrada', cuerpo: 'La caja C1 se cerro.',
    destinatario: { tipo: 'usuario', id: 'ADMIN' }, canales: ['in_app'], ...over,
  };
}

describe('aviso-servicio', () => {
  it('insertarAvisos crea una fila pendiente por canal, con payload snapshot', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const now = new Date();
    const ids = db.transaction((tx) =>
      insertarAvisos(tx, cmd({ destinatario: { tipo: 'usuario', id: admin.id }, canales: ['in_app'] }), now),
    );
    expect(ids).toHaveLength(1);
    const filas = db.select().from(schema.aviso).all();
    expect(filas).toHaveLength(1);
    expect(filas[0].estado).toBe('pendiente');
    expect(JSON.parse(filas[0].payload).titulo).toBe('Caja cerrada');
  });

  it('deduplica por dedupe_clave: segunda emision no inserta', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const c = cmd({ destinatario: { tipo: 'usuario', id: admin.id }, dedupe_clave: 'cierre-2026-07-21-C1' });
    db.transaction((tx) => insertarAvisos(tx, c, new Date()));
    db.transaction((tx) => insertarAvisos(tx, c, new Date()));
    expect(db.select().from(schema.aviso).all()).toHaveLength(1);
  });

  it('respeta flag notif_cierre_caja_email=false: no crea el aviso email', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const ids = db.transaction((tx) =>
      insertarAvisos(tx, cmd({ destinatario: { tipo: 'usuario', id: admin.id }, canales: ['in_app', 'email'] }), new Date()),
    );
    expect(ids).toHaveLength(1);   // solo in_app
    const canales = db.select().from(schema.aviso).all().map((a) => a.canal);
    expect(canales).toContain('in_app');
    expect(canales).not.toContain('email');
  });

  it('con el flag notif_cierre_caja_email=true si crea el aviso email (congela contacto)', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    db.update(schema.parametros_sistema).set({ valor: 'true' })
      .where(eq(schema.parametros_sistema.clave, 'notif_cierre_caja_email')).run();
    // el admin del seed puede no tener email; le ponemos uno
    db.update(schema.usuario).set({ email: 'admin@ferre.test' }).where(eq(schema.usuario.id, admin.id)).run();
    db.transaction((tx) =>
      insertarAvisos(tx, cmd({ destinatario: { tipo: 'usuario', id: admin.id }, canales: ['in_app', 'email'] }), new Date()),
    );
    const email = db.select().from(schema.aviso).where(eq(schema.aviso.canal, 'email')).get();
    expect(email).toBeDefined();
    expect(email!.destinatario_contacto).toBe('admin@ferre.test');
  });

  it('emitirAviso despacha in_app y lo deja enviado', async () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    await emitirAviso(db, cmd({ destinatario: { tipo: 'usuario', id: admin.id } }));
    const fila = db.select().from(schema.aviso).all()[0];
    expect(fila.estado).toBe('enviado');
    expect(fila.enviado_at).not.toBeNull();
  });

  it('despacharAviso de un email sin SMTP configurado lo deja fallido, sin lanzar', async () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    db.update(schema.parametros_sistema).set({ valor: 'true' })
      .where(eq(schema.parametros_sistema.clave, 'notif_cierre_caja_email')).run();
    const ids = db.transaction((tx) =>
      insertarAvisos(tx, cmd({ destinatario: { tipo: 'usuario', id: admin.id }, canales: ['email'] }), new Date()),
    );
    await despacharAviso(db, ids[0]);
    const fila = db.select().from(schema.aviso).where(eq(schema.aviso.id, ids[0])).get();
    expect(fila!.estado).toBe('fallido');
    expect(fila!.intentos).toBe(1);
    expect(fila!.ultimo_error).toBe('SMTP_NO_CONFIGURADO');
  });

  it('propaga severidad del comando a la fila aviso (default normal)', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const now = new Date();
    const idsNormal = db.transaction((tx) => insertarAvisos(tx, {
      origen_tipo: 'cierre_caja', titulo: 'T', cuerpo: 'C',
      destinatario: { tipo: 'usuario', id: admin.id }, canales: ['in_app'],
    }, now));
    const a1 = db.select().from(schema.aviso).where(eq(schema.aviso.id, idsNormal[0])).get();
    expect(a1!.severidad).toBe('normal');

    const idsAlerta = db.transaction((tx) => insertarAvisos(tx, {
      origen_tipo: 'cierre_caja', titulo: 'T', cuerpo: 'C', severidad: 'alerta',
      destinatario: { tipo: 'usuario', id: admin.id }, canales: ['in_app'],
      dedupe_clave: 'x-alerta',
    }, now));
    const a2 = db.select().from(schema.aviso).where(eq(schema.aviso.id, idsAlerta[0])).get();
    expect(a2!.severidad).toBe('alerta');
  });
});
