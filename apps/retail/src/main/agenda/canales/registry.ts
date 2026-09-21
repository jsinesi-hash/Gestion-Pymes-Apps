import type { CanalAdapter, Canal } from './tipos';
import { inAppAdapter } from './in-app';
import { emailAdapter } from './email';
import { whatsappAdapter } from './whatsapp';

const ADAPTERS: Record<Canal, CanalAdapter> = {
  in_app: inAppAdapter,
  email: emailAdapter,
  whatsapp: whatsappAdapter,
};

export function getAdapter(canal: string): CanalAdapter | null {
  return ADAPTERS[canal as Canal] ?? null;
}
