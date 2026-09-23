// Elaborados E1 (Task B4): la mecánica de comandos (tipo + filtro por texto) es genérica y
// vive acá; los comandos concretos de Retail (COMANDOS_ACCION/COMANDOS_NAV) y los buscadores
// se mudaron a renderer/shell/comandosRetail.ts. CommandPalette los recibe por props.

export type Comando = { label: string; to: string; permiso?: string; hint?: string };

// Normaliza para comparación: quita acentos y baja a minúsculas.
function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function filtrarPorTexto<T extends { label: string }>(items: T[], texto: string): T[] {
  const q = norm(texto.trim());
  if (!q) return items;
  return items.filter(i => norm(i.label).includes(q));
}
