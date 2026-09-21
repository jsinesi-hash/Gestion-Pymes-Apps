import nodemailer from 'nodemailer';
import type { CanalAdapter, AvisoParaEnviar, ResultadoEnvio } from './tipos';
import type { SmtpConfig } from './smtp-config';
import { leerSmtpConfig } from './smtp-config';
import { leerPasswordSmtp } from '../../seguridad/smtp-secret';

export interface EmailAdapterDeps {
  getConfig: () => SmtpConfig | Promise<SmtpConfig>;
  getPassword: () => string | null;
  createTransport: typeof nodemailer.createTransport;
}

// Cuerpo texto plano legible desde el payload del cierre (ADR-048 §3: resumen, no detalle).
function formatearCuerpo(payload: AvisoParaEnviar['payload']): string {
  const d = (payload.datos ?? {}) as any;
  const lineas: string[] = [payload.cuerpo, ''];
  if (typeof d.total_vendido === 'number') lineas.push(`Total vendido: $${d.total_vendido}`);
  if (typeof d.n_ventas === 'number') lineas.push(`Ventas: ${d.n_ventas}`);
  if (typeof d.efectivo_esperado === 'number') lineas.push(`Efectivo esperado: $${d.efectivo_esperado}`);
  if (typeof d.efectivo_contado === 'number') lineas.push(`Efectivo contado: $${d.efectivo_contado}`);
  if (typeof d.diferencia === 'number') lineas.push(`Diferencia: $${d.diferencia}`);
  if (Array.isArray(d.desglose_por_medio_pago)) {
    lineas.push('', 'Por medio de pago:');
    for (const m of d.desglose_por_medio_pago) lineas.push(`  ${m.forma_pago}: $${m.ingresado} (${m.cantidad_operaciones})`);
  }
  if (d.bajo_minimo && d.bajo_minimo.total > 0) {
    lineas.push('', `Productos bajo minimo: ${d.bajo_minimo.total}`);
    for (const p of d.bajo_minimo.top) lineas.push(`  ${p.nombre_corto}: ${p.stock_fisico}/${p.stock_minimo}`);
    if (d.bajo_minimo.total > d.bajo_minimo.top.length) lineas.push(`  y ${d.bajo_minimo.total - d.bajo_minimo.top.length} mas`);
  }
  return lineas.join('\n');
}

export function crearEmailAdapter(deps: EmailAdapterDeps): CanalAdapter {
  return {
    canal: 'email',
    async enviar(aviso: AvisoParaEnviar): Promise<ResultadoEnvio> {
      try {
        const cfg = await deps.getConfig();
        if (!cfg.host || !cfg.from || !cfg.user) return { ok: false, error: 'SMTP_NO_CONFIGURADO' };
        const pass = deps.getPassword();
        if (!pass) return { ok: false, error: 'SMTP_SIN_CREDENCIAL' };
        if (!aviso.destinatario_contacto) return { ok: false, error: 'SMTP_SIN_DESTINATARIO' };
        const transport = deps.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass } });
        await transport.sendMail({ from: cfg.from, to: aviso.destinatario_contacto, subject: aviso.payload.titulo, text: formatearCuerpo(aviso.payload) });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  };
}

// Instancia default con deps reales (usada por el registry en runtime).
// db se resuelve PEREZOSAMENTE (import() dinamico dentro del closure, mismo patron que
// startup.ts) para NO abrir la BD real al importar este modulo en los tests. Se usa
// import() dinamico (no require) porque bajo vite-node (motor de vitest) un require()
// de un modulo .ts no se resuelve; import() si es interceptado por su resolver.
// Cualquier fallo al leer la config real (BD no disponible, entorno de test sin
// Electron `app` inicializado, etc.) se trata como "no configurado" — nunca se propaga
// el error crudo, para no filtrar detalles de infraestructura en `ultimo_error`.
export const emailAdapter: CanalAdapter = crearEmailAdapter({
  getConfig: async () => {
    try {
      const { db } = await import('../../db/client');
      return leerSmtpConfig(db);
    } catch {
      return { host: '', port: 587, secure: false, from: '', user: '' };
    }
  },
  getPassword: () => leerPasswordSmtp(),
  createTransport: nodemailer.createTransport,
});
