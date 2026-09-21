import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupDb, loginAsAdmin } from '../../ipc/__tests__/helpers';
import * as schema from '../../db/schema';
import { generateId } from '@ferreteria/shared';
import { ejecutarCatchUp, completarEventoRutina } from '../motor-rutinas';

function crearRutinaDiaria(db: ReturnType<typeof setupDb>, adminId: string, proximo: Date): string {
  const id = generateId();
  const now = new Date();
  db.insert(schema.rutina).values({
    id, nombre: 'Revisar proveedor X', frecuencia_tipo: 'diaria', intervalo: 1, hora: '09:00',
    fecha_inicio: new Date(proximo.getTime() - 86400000), proximo_disparo: proximo,
    destinatario_tipo: 'usuario', destinatario_usuario_id: adminId,
    canal_in_app: true, canal_email: false, activa: true, activo: true,
    usuario_creacion_id: adminId, fecha_creacion: now,
    version: 1, origin_id: 'C1', sync_state: 'pending', updated_at: now,
  }).run();
  return id;
}

describe('motor-rutinas', () => {
  it('catch-up materializa una rutina vencida: crea evento pendiente + aviso in_app', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const ayer = new Date(Date.now() - 86400000);
    crearRutinaDiaria(db, admin.id, ayer);

    const res = ejecutarCatchUp(db, new Date());
    expect(res.materializados).toBeGreaterThanOrEqual(1);

    const eventos = db.select().from(schema.agenda_evento).all();
    expect(eventos.length).toBeGreaterThanOrEqual(1);
    expect(eventos[0].origen).toBe('rutina');
    expect(db.select().from(schema.aviso).all().length).toBeGreaterThanOrEqual(1);
  });

  it('catch-up avanza el puntero de la rutina a una fecha futura', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const ayer = new Date(Date.now() - 86400000);
    const rutinaId = crearRutinaDiaria(db, admin.id, ayer);

    ejecutarCatchUp(db, new Date());
    const r = db.select().from(schema.rutina).where(eq(schema.rutina.id, rutinaId)).get();
    expect(r!.proximo_disparo!.getTime()).toBeGreaterThan(Date.now());
  });

  it('completar un evento de rutina avanza el puntero y marca completada', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const ayer = new Date(Date.now() - 86400000);
    const rutinaId = crearRutinaDiaria(db, admin.id, ayer);
    ejecutarCatchUp(db, new Date());

    const evento = db.select().from(schema.agenda_evento).all()[0];
    completarEventoRutina(db, evento.id, admin.id, new Date());

    const completadas = db.select().from(schema.agenda_evento)
      .where(eq(schema.agenda_evento.estado, 'completada')).all();
    expect(completadas.length).toBe(1);
    const r = db.select().from(schema.rutina).where(eq(schema.rutina.id, rutinaId)).get();
    expect(r!.proximo_disparo!.getTime()).toBeGreaterThan(Date.now());
  });

  it('catch-up no duplica: correr dos veces no crea eventos repetidos', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    const ayer = new Date(Date.now() - 86400000);
    crearRutinaDiaria(db, admin.id, ayer);

    const now = new Date();
    ejecutarCatchUp(db, now);
    const cont1 = db.select().from(schema.agenda_evento).all().length;
    ejecutarCatchUp(db, now);
    const cont2 = db.select().from(schema.agenda_evento).all().length;
    expect(cont2).toBe(cont1);
  });

  it('respeta agenda_catchup_limite: no materializa mas alla del piso', () => {
    const db = setupDb();
    const admin = loginAsAdmin(db);
    // rutina diaria con proximo_disparo hace 200 dias; limite default 90
    const hace200 = new Date(Date.now() - 200 * 86400000);
    crearRutinaDiaria(db, admin.id, hace200);

    const res = ejecutarCatchUp(db, new Date());
    // como mucho ~91 ocurrencias (desde el piso now-90d hasta hoy), nunca 200
    expect(res.materializados).toBeLessThanOrEqual(92);
    expect(res.materializados).toBeGreaterThanOrEqual(1);
  });
});
