import { traducirError } from '@core/ui';

// ADR-082 (SEC-2): rutea un error del backend al campo del formulario que lo generó.
// El main rechaza validaciones con `VALIDATION:<campo>:<detalle>`; `traducirError` extrae
// `campo` + un mensaje humano. Dado ese error crudo y un mapa `campo → id de input`, si el
// backend rechazó por un campo conocido enfoca su input y devuelve `{ campo, mensaje }`; en
// cualquier otro caso devuelve solo `{ mensaje }` (mensaje general traducido, para el alert).
export function rutearCampoError(
  err: unknown,
  campos: Record<string, string>,
): { campo?: string; mensaje: string } {
  const t = traducirError(err);
  if (t.campo && Object.hasOwn(campos, t.campo)) {
    document.getElementById(campos[t.campo])?.focus();
    return { campo: t.campo, mensaje: t.mensaje };
  }
  return { mensaje: t.mensaje };
}
