import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin } from './helpers';
import * as schema from '../../db/schema';
import {
  rutinaCrearHandler, rutinaPausarHandler, rutinaReanudarHandler, rutinaEliminarHandler, rutinaListHandler,
  agendaCrearEventoHandler, agendaListarHandler, agendaCompletarHandler, agendaPosponerHandler, agendaDescartarHandler,
  avisoListarHandler, avisoReintentarHandler, avisoDescartarHandler, avisoBadgeHandler,
} from '../agenda';

// El despacho de avisos es best-effort async (ADR-047 §6): no bloquea al productor.
// En tests dejamos drenar la cola de tareas para observar el estado final.
const flush = () => new Promise((r) => setImmediate(r));

// El adapter de email real (ADR-048 Lote 2) resuelve su config vía import() dinamico de
// db/client — la primera vez, el transform en frio de vite-node puede tardar bastante
// mas que un tick. Poll acotado en vez de un sleep fijo (evita flakiness sin alargar de
// mas el resto de los tests que usan flush()).
async function esperarEstado(
  db: ReturnType<typeof setupDb>, avisoId: string, estado: string, timeoutMs = 3000,
) {
  const desde = Date.now();
  let fila = db.select().from(schema.aviso).where(eq(schema.aviso.id, avisoId)).get();
  while (fila?.estado !== estado && Date.now() - desde < timeoutMs) {
    await new Promise((r) => setTimeout(r, 20));
    fila = db.select().from(schema.aviso).where(eq(schema.aviso.id, avisoId)).get();
  }
  return fila;
}

describe('agenda IPC handlers', () => {
  it('rutina:crear crea rutina activa con proximo_disparo calculado', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const r = rutinaCrearHandler(db, {
      nombre: 'Pedido semanal', frecuencia_tipo: 'semanal', intervalo: 1, dia_semana: 1, hora: '09:00',
      fecha_inicio: new Date().toISOString(),
      destinatario: { tipo: 'usuario', id: admin.id }, canal_in_app: true, canal_email: false,
    });
    expect(r!.id).toBeTruthy();
    expect(r!.activa).toBe(true);
    expect(r!.proximo_disparo).toBeTruthy();
  });

  it('rutina pausar/reanudar/eliminar y list solo activas', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const r = rutinaCrearHandler(db, {
      nombre: 'R1', frecuencia_tipo: 'diaria', fecha_inicio: new Date().toISOString(),
      destinatario: { tipo: 'usuario', id: admin.id },
    })!;
    rutinaPausarHandler(db, { id: r.id });
    expect(db.select().from(schema.rutina).where(eq(schema.rutina.id, r.id)).get()!.activa).toBe(false);
    rutinaReanudarHandler(db, { id: r.id });
    expect(db.select().from(schema.rutina).where(eq(schema.rutina.id, r.id)).get()!.activa).toBe(true);
    rutinaEliminarHandler(db, { id: r.id });
    expect(rutinaListHandler(db)).toHaveLength(0);   // baja logica lo saca del listado
  });

  it('agenda:crearEvento manual encola aviso in_app y aparece en el listado', async () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const ev = agendaCrearEventoHandler(db, {
      titulo: 'Llamar a proveedor', fecha: new Date().toISOString(),
      destinatario: { tipo: 'usuario', id: admin.id },
    })!;
    expect(ev.origen).toBe('manual');
    expect(agendaListarHandler(db)).toHaveLength(1);
    await flush();   // deja completar el despacho best-effort
    const avisos = db.select().from(schema.aviso).where(eq(schema.aviso.agenda_evento_id, ev.id)).all();
    expect(avisos.length).toBe(1);
    expect(avisos[0].estado).toBe('enviado');   // in_app se despacha ok
  });

  it('agenda:completar / posponer / descartar cambian estado', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const mk = () => agendaCrearEventoHandler(db, {
      titulo: 'X', fecha: new Date().toISOString(), destinatario: { tipo: 'usuario', id: admin.id },
    })!;
    const e1 = mk(); agendaCompletarHandler(db, { id: e1.id });
    expect(db.select().from(schema.agenda_evento).where(eq(schema.agenda_evento.id, e1.id)).get()!.estado).toBe('completada');
    const e2 = mk(); agendaPosponerHandler(db, { id: e2.id, pospuesto_para: new Date(Date.now() + 86400000).toISOString() });
    expect(db.select().from(schema.agenda_evento).where(eq(schema.agenda_evento.id, e2.id)).get()!.estado).toBe('pospuesta');
    const e3 = mk(); agendaDescartarHandler(db, { id: e3.id });
    expect(db.select().from(schema.agenda_evento).where(eq(schema.agenda_evento.id, e3.id)).get()!.estado).toBe('descartada');
  });

  it('aviso:listar / descartar / badge', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    // evento atrasado (fecha en el pasado) -> cuenta como atrasada
    agendaCrearEventoHandler(db, {
      titulo: 'Vencida', fecha: new Date(Date.now() - 86400000).toISOString(),
      destinatario: { tipo: 'usuario', id: admin.id },
    });
    const badge = avisoBadgeHandler(db);
    expect(badge.atrasadas).toBe(1);
    expect(badge).toHaveProperty('avisos_fallidos');

    const avisos = avisoListarHandler(db);
    expect(avisos.length).toBeGreaterThanOrEqual(1);
    avisoDescartarHandler(db, { id: avisos[0].id });
    expect(db.select().from(schema.aviso).where(eq(schema.aviso.id, avisos[0].id)).get()!.estado).toBe('descartado');
  });

  it('aviso:reintentar reencola y re-despacha', async () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    db.update(schema.parametros_sistema).set({ valor: 'true' })
      .where(eq(schema.parametros_sistema.clave, 'notif_cierre_caja_email')).run();
    db.update(schema.usuario).set({ email: 'a@b.c' }).where(eq(schema.usuario.id, admin.id)).run();
    // creamos un evento con email -> el aviso email fallara (sin SMTP configurado)
    const ev = agendaCrearEventoHandler(db, {
      titulo: 'Con email', fecha: new Date().toISOString(),
      destinatario: { tipo: 'usuario', id: admin.id }, canal_in_app: false, canal_email: true,
    })!;
    // origen_tipo del aviso es 'agenda_evento', no matchea flag -> igual se crea email y falla
    const emailPendiente = db.select().from(schema.aviso).where(eq(schema.aviso.agenda_evento_id, ev.id)).get()!;
    const email = (await esperarEstado(db, emailPendiente.id, 'fallido'))!;   // deja fallar el despacho del email (SMTP_NO_CONFIGURADO)
    expect(email.estado).toBe('fallido');
    const after = await avisoReintentarHandler(db, { id: email.id });
    expect(after!.intentos).toBeGreaterThan(email.intentos);
  });
});
