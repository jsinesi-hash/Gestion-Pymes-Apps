import type { CanalAdapter, AvisoParaEnviar, ResultadoEnvio } from './tipos';

// ADR-047 §8: stub "no disponible hasta R4" (WhatsApp nativo reabre OAuth/backend,
// descartado por ADR-023 hasta la nube).
export const whatsappAdapter: CanalAdapter = {
  canal: 'whatsapp',
  async enviar(_aviso: AvisoParaEnviar): Promise<ResultadoEnvio> {
    return { ok: false, error: 'WHATSAPP_NO_DISPONIBLE_HASTA_R4' };
  },
};
