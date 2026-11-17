import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@core/db';
import { setupCoreDb, loginAsAdmin, clearSession } from './testing/helpers';
import {
  clienteUpsertHandler, cajaAbrirHandler, ctacteRegistrarSaldoInicialHandler, ctacteRegistrarCobroHandler,
} from './index';
import {
  diferenciasDeCuentaCorriente, proyectarSaldoCuentaCorriente, recalcularSaldoCuentaCorriente,
} from './ctacte-proyeccion';

// ADR-151: el saldo de cuenta corriente es una proyección de su libro (cargos − pagos).
describe('proyección del saldo de cuenta corriente', () => {
  let db: ReturnType<typeof setupCoreDb>;
  let cuentaId: string;
  const cuenta = () => db.select().from(schema.cuenta_corriente_cliente)
    .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).get()!;

  beforeEach(() => {
    db = setupCoreDb();
    clearSession();
    loginAsAdmin(db);
    const cliente = clienteUpsertHandler(db, {
      tipo_documento: 'DNI', numero_documento: '30111222', nombre: 'Ana', apellido: 'Gómez',
      condicion_fiscal: 'Consumidor Final', habilita_cuenta_corriente: true,
    });
    cuentaId = db.select().from(schema.cuenta_corriente_cliente)
      .where(eq(schema.cuenta_corriente_cliente.cliente_id, cliente.id)).get()!.id;
    cajaAbrirHandler(db, { monto_inicial_centavos: 0 });
  });

  it('cargos menos pagos: coincide con el saldo que dejaron los handlers', () => {
    ctacteRegistrarSaldoInicialHandler(db, { cuentaId, monto_centavos: 10_000, tipo: 'cargo' });
    ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 3_000, forma_pago: 'efectivo' });
    ctacteRegistrarCobroHandler(db, { cuentaId, monto_centavos: 9_000, forma_pago: 'transferencia' }); // sobrepago
    expect(cuenta().saldo_centavos).toBe(-2_000);
    expect(proyectarSaldoCuentaCorriente(db, cuentaId)).toBe(-2_000);
    expect(diferenciasDeCuentaCorriente(db)).toEqual([]);
  });

  it('una cuenta sin movimientos proyecta 0', () => {
    expect(proyectarSaldoCuentaCorriente(db, cuentaId)).toBe(0);
  });

  it('recalcular corrige un saldo desfasado y lo informa; si cuadra no toca la fila', () => {
    ctacteRegistrarSaldoInicialHandler(db, { cuentaId, monto_centavos: 5_000, tipo: 'cargo' });
    const version = cuenta().version;
    expect(recalcularSaldoCuentaCorriente(db, cuentaId)).toEqual({ guardado: 5_000, proyectado: 5_000, corregido: false });
    expect(cuenta().version).toBe(version);

    db.update(schema.cuenta_corriente_cliente).set({ saldo_centavos: 1 })
      .where(eq(schema.cuenta_corriente_cliente.id, cuentaId)).run();
    expect(diferenciasDeCuentaCorriente(db)).toEqual([{ cuenta_id: cuentaId, guardado: 1, proyectado: 5_000 }]);
    expect(recalcularSaldoCuentaCorriente(db, cuentaId)).toEqual({ guardado: 1, proyectado: 5_000, corregido: true });
    expect(cuenta().saldo_centavos).toBe(5_000);
    expect(diferenciasDeCuentaCorriente(db)).toEqual([]);
  });
});
