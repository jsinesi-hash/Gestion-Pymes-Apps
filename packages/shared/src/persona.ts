// ADR-050 — cliente.razon_social se separó en nombre/apellido.
// nombreCompletoCliente es la única fuente de verdad para armar el nombre
// visible: no reconstruir esta concatenación ad-hoc en cada punto de lectura.

export type ClienteNombre = {
  nombre: string;
  apellido: string | null;
};

export function nombreCompletoCliente(c: ClienteNombre): string {
  const nombre = c.nombre.trim();
  const apellido = (c.apellido ?? '').trim();
  return apellido ? `${nombre} ${apellido}` : nombre;
}
