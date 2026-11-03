import { describe, it, expect, vi } from 'vitest';
import { crearEnviadorSmtp, type EnviadorSmtpDeps } from '../enviador-correo';
import type { SmtpConfig } from '../../agenda/canales/smtp-config';

// ADR-137: el enviador de correo de Retail para la recuperación de contraseña reutiliza la
// configuración SMTP (servidor en parametros_sistema, clave en safeStorage) de la agenda.
const CONFIG: SmtpConfig = { host: 'smtp.ejemplo.com', port: 465, secure: true, from: 'avisos@ejemplo.com', user: 'avisos@ejemplo.com' };

function armar(over: Partial<{ config: SmtpConfig; password: string | null; sendMail: ReturnType<typeof vi.fn> }> = {}) {
  const sendMail = over.sendMail ?? vi.fn().mockResolvedValue(undefined);
  const createTransport = vi.fn().mockReturnValue({ sendMail });
  let config = over.config ?? CONFIG;
  let password = over.password === undefined ? 'secreto' : over.password;
  const deps: EnviadorSmtpDeps = {
    getConfig: () => config,
    getPassword: () => password,
    createTransport: createTransport as never,
  };
  return {
    enviador: crearEnviadorSmtp(deps),
    sendMail,
    createTransport,
    setConfig: (c: SmtpConfig) => { config = c; },
    setPassword: (p: string | null) => { password = p; },
  };
}

describe('crearEnviadorSmtp — disponible', () => {
  it('true con servidor, remitente, usuario y clave', () => {
    expect(armar().enviador.disponible()).toBe(true);
  });
  it('false sin servidor', () => {
    expect(armar({ config: { ...CONFIG, host: '' } }).enviador.disponible()).toBe(false);
  });
  it('false sin remitente', () => {
    expect(armar({ config: { ...CONFIG, from: '' } }).enviador.disponible()).toBe(false);
  });
  it('false sin usuario', () => {
    expect(armar({ config: { ...CONFIG, user: '' } }).enviador.disponible()).toBe(false);
  });
  it('false sin clave guardada (safeStorage)', () => {
    expect(armar({ password: null }).enviador.disponible()).toBe(false);
  });
  it('lee la configuración en cada llamada: un cambio se nota sin reiniciar', () => {
    const a = armar({ config: { ...CONFIG, host: '' } });
    expect(a.enviador.disponible()).toBe(false);
    a.setConfig(CONFIG);
    expect(a.enviador.disponible()).toBe(true);
  });
});

describe('crearEnviadorSmtp — enviar', () => {
  const MENSAJE = { para: 'ana@ejemplo.com', asunto: 'Código', texto: 'Tu código es 123456' };

  it('arma el transporte con la configuración y la clave, y envía el mensaje', async () => {
    const a = armar();
    await a.enviador.enviar(MENSAJE);
    expect(a.createTransport).toHaveBeenCalledWith({
      host: 'smtp.ejemplo.com', port: 465, secure: true, auth: { user: 'avisos@ejemplo.com', pass: 'secreto' },
    });
    expect(a.sendMail).toHaveBeenCalledWith({
      from: 'avisos@ejemplo.com', to: 'ana@ejemplo.com', subject: 'Código', text: 'Tu código es 123456',
    });
  });

  it('sin configuración lanza SMTP_NO_CONFIGURADO y no crea el transporte', async () => {
    const a = armar({ config: { ...CONFIG, host: '' } });
    await expect(a.enviador.enviar(MENSAJE)).rejects.toThrow('SMTP_NO_CONFIGURADO');
    expect(a.createTransport).not.toHaveBeenCalled();
  });

  it('sin clave guardada lanza SMTP_NO_CONFIGURADO', async () => {
    const a = armar({ password: null });
    await expect(a.enviador.enviar(MENSAJE)).rejects.toThrow('SMTP_NO_CONFIGURADO');
  });

  it('propaga el error del servidor de correo (el núcleo decide qué responder)', async () => {
    const a = armar({ sendMail: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) });
    await expect(a.enviador.enviar(MENSAJE)).rejects.toThrow('ECONNREFUSED');
  });
});
