import { describe, it, expect } from 'vitest';
import { verificarRegistroSync } from '@core/db';
import * as schema from '../db/schema';
import { registroSyncElaborados } from '../db/registro-sync';

// B2 (ADR-091/092) con el registro de sync (ADR-150 §3): toda tabla del esquema compuesto declara
// si es `maestro`, `libro` o `local`; las que sincronizan tienen id texto + campos de sync.
describe('B2 — registro de sync de Elaborados', () => {
  it('sin problemas: toda tabla registrada y con los campos que su tipo exige', () => {
    expect(verificarRegistroSync(schema, registroSyncElaborados())).toEqual([]);
  });

  it('las tablas que no sincronizan son exactamente las documentadas', () => {
    // geo = catálogo de referencia; parametros_sistema = clave-valor (PR7 de F1 separa lo del
    // negocio); recuperacion_password = códigos locales (ADR-137);
    // sync_outbox/sync_aplicando = cola de cambios e interruptor de la terminal (ADR-150).
    const locales = Object.entries(registroSyncElaborados()).filter(([, e]) => e.tipo === 'local').map(([t]) => t).sort();
    expect(locales).toEqual(['departamento', 'localidad', 'parametros_sistema', 'provincia', 'recuperacion_password', 'sync_aplicando', 'sync_outbox']);
  });
});
