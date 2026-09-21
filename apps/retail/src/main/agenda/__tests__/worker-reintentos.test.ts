import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin } from '../../ipc/__tests__/helpers';
import * as schema from '../../db/schema';
import { generateId } from '@ferreteria/shared';
import { drenarReintentos } from '../worker-reintentos';

function avisoEmailPendiente(db: ReturnType<typeof setupDb>, usuarioId: string, intentos = 0): string {
  const id = generateId();
  db.insert(schema.aviso).values({
    id, origen_tipo: 'cierre_caja', canal: 'email', destinatario_usuario_id: usuarioId,
    destinatario_contacto: 'x@y.com', payload: JSON.stringify({ titulo: 't', cuerpo: 'c' }),
    estado: 'pendiente', intentos, proximo_intento_at: new Date(Date.now() - 1000), generado_at: new Date(),
  }).run();
  return id;
}

describe('worker-reintentos', () => {
  it('reintenta un email fallido (stub) y programa backoff futuro', async () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const id = avisoEmailPendiente(db, admin.id, 0);

    const res = await drenarReintentos(db, new Date());
    expect(res.intentados).toBe(1);

    const a = db.select().from(schema.aviso).where(eq(schema.aviso.id, id)).get();
    expect(a!.estado).toBe('fallido');
    expect(a!.intentos).toBe(1);
    expect(a!.proximo_intento_at!.getTime()).toBeGreaterThan(Date.now());
  });

  it('descarta al superar aviso_reintentos_max', async () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    // reintentos_max default 5; arrancamos con 5 intentos ya hechos
    const id = avisoEmailPendiente(db, admin.id, 5);

    const res = await drenarReintentos(db, new Date());
    expect(res.descartados).toBe(1);
    const a = db.select().from(schema.aviso).where(eq(schema.aviso.id, id)).get();
    expect(a!.estado).toBe('descartado');
  });

  it('no toca avisos cuyo proximo_intento_at es futuro', async () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const id = generateId();
    db.insert(schema.aviso).values({
      id, origen_tipo: 'cierre_caja', canal: 'email', destinatario_usuario_id: admin.id,
      destinatario_contacto: 'x@y.com', payload: '{}', estado: 'fallido', intentos: 1,
      proximo_intento_at: new Date(Date.now() + 3600 * 1000), generado_at: new Date(),
    }).run();

    const res = await drenarReintentos(db, new Date());
    expect(res.intentados).toBe(0);
    const a = db.select().from(schema.aviso).where(eq(schema.aviso.id, id)).get();
    expect(a!.intentos).toBe(1);   // sin cambios
  });

  it('un in_app pendiente se envia y queda enviado (no reintenta)', async () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const id = generateId();
    db.insert(schema.aviso).values({
      id, origen_tipo: 'agenda_evento', canal: 'in_app', destinatario_usuario_id: admin.id,
      payload: '{}', estado: 'pendiente', intentos: 0,
      proximo_intento_at: new Date(Date.now() - 1000), generado_at: new Date(),
    }).run();

    await drenarReintentos(db, new Date());
    const a = db.select().from(schema.aviso).where(eq(schema.aviso.id, id)).get();
    expect(a!.estado).toBe('enviado');
  });
});
