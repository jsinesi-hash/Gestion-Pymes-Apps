import { describe, it, expect, vi } from 'vitest';
import { crearEmailAdapter } from '../canales/email';

const payloadAlerta = {
  titulo: 'Cierre con descuadre de $1.500 — turno 3',
  cuerpo: 'Resumen del cierre',
  datos: {
    diferencia: -1500, efectivo_esperado: 10000, efectivo_contado: 8500,
    total_vendido: 50000, n_ventas: 12,
    bajo_minimo: { total: 2, top: [{ nombre_corto: 'Tornillo', stock_fisico: 0, stock_minimo: 10 }] },
  },
};
function aviso(over = {}) {
  return { id: 'a1', canal: 'email' as const, destinatario_usuario_id: 'u1',
           destinatario_contacto: 'dueno@mail.com', payload: payloadAlerta, ...over };
}
function cfgOk() { return { host: 'smtp.x', port: 587, secure: false, from: 'a@x', user: 'u' }; }

it('sin host/from/user devuelve SMTP_NO_CONFIGURADO', async () => {
  const adapter = crearEmailAdapter({ getConfig: () => ({ host: '', port: 587, secure: false, from: '', user: '' }), getPassword: () => 'p', createTransport: () => ({ sendMail: vi.fn() }) as any });
  const res = await adapter.enviar(aviso());
  expect(res.ok).toBe(false);
  expect(res.error).toBe('SMTP_NO_CONFIGURADO');
});
it('sin contraseña devuelve SMTP_SIN_CREDENCIAL', async () => {
  const adapter = crearEmailAdapter({ getConfig: cfgOk, getPassword: () => null, createTransport: () => ({ sendMail: vi.fn() }) as any });
  expect((await adapter.enviar(aviso())).error).toBe('SMTP_SIN_CREDENCIAL');
});
it('sin destinatario_contacto devuelve SMTP_SIN_DESTINATARIO', async () => {
  const adapter = crearEmailAdapter({ getConfig: cfgOk, getPassword: () => 'p', createTransport: () => ({ sendMail: vi.fn() }) as any });
  expect((await adapter.enviar(aviso({ destinatario_contacto: null }))).error).toBe('SMTP_SIN_DESTINATARIO');
});
it('envía con asunto = titulo y cuerpo texto plano con el resumen y bajo minimo', async () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'x' });
  const adapter = crearEmailAdapter({ getConfig: cfgOk, getPassword: () => 'p', createTransport: () => ({ sendMail }) as any });
  const res = await adapter.enviar(aviso());
  expect(res.ok).toBe(true);
  const arg = sendMail.mock.calls[0][0];
  expect(arg.to).toBe('dueno@mail.com');
  expect(arg.from).toBe('a@x');
  expect(arg.subject).toBe(payloadAlerta.titulo);
  expect(arg.text).toContain('Tornillo');
  expect(arg.html).toBeUndefined();
});
it('un error de sendMail se captura y devuelve ok:false sin lanzar', async () => {
  const adapter = crearEmailAdapter({ getConfig: cfgOk, getPassword: () => 'p', createTransport: () => ({ sendMail: vi.fn().mockRejectedValue(new Error('ECONN')) }) as any });
  const res = await adapter.enviar(aviso());
  expect(res.ok).toBe(false);
  expect(res.error).toContain('ECONN');
});
