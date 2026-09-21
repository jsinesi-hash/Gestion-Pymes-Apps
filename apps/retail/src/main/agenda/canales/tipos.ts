// ADR-047 §8: canales como adapters detrás de una interfaz (patron de ADR-015).

export type Canal = 'in_app' | 'email' | 'whatsapp';

export interface AvisoParaEnviar {
  id: string;
  canal: Canal;
  destinatario_usuario_id: string;
  destinatario_contacto: string | null;
  payload: { titulo: string; cuerpo: string; datos?: unknown };
}

export interface ResultadoEnvio {
  ok: boolean;
  error?: string;
}

export interface CanalAdapter {
  readonly canal: Canal;
  enviar(aviso: AvisoParaEnviar): Promise<ResultadoEnvio>;
}
