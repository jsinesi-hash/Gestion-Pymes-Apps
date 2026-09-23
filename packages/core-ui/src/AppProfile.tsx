import { createContext, useContext, type ReactNode } from 'react';
import type { Navegacion } from '@ferreteria/shared';

export type AppProfile = { nombreApp: string; navegacion: Navegacion };

const Ctx = createContext<AppProfile | null>(null);

export function AppProfileProvider({ value, children }: { value: AppProfile; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppProfile(): AppProfile {
  const v = useContext(Ctx);
  if (!v) throw new Error('APP_PROFILE_FALTANTE');
  return v;
}
