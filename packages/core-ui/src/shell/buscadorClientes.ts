// Elaborados E1 (Task B5): buscador de clientes para la CommandPalette. Es genérico —usa
// bridge().cliente.list()— así que vive en el core y lo comparten las apps. La mecánica
// (tipo Buscador, filtrarPorTexto) también es del core.

import { nombreCompletoCliente } from '@ferreteria/shared';
import { bridge } from '../bridge';
import { filtrarPorTexto, type Comando } from './comandos';
import type { Buscador } from './CommandPalette';

type ClienteRow = {
  id: string;
  nombre?: string | null;
  apellido?: string | null;
  razon_social?: string | null;
  nombre_fantasia?: string | null;
};

function labelCliente(c: ClienteRow): string {
  if (c.nombre) return nombreCompletoCliente({ nombre: c.nombre, apellido: c.apellido ?? null });
  return c.razon_social || c.nombre_fantasia || '(sin nombre)';
}

// Clientes: la lista se carga una sola vez (cache de módulo) y se filtra en cliente.
// Gateado por `ctacte.cobrar` (el mismo permiso del IPC del lado main). Genérico: usa
// bridge().cliente.list().
let clientesCache: ClienteRow[] | null = null;
export const buscadorClientes: Buscador = {
  key: 'clientes',
  titulo: 'Clientes',
  permiso: 'ctacte.cobrar',
  async buscar(q) {
    if (q.trim() === '') return [];
    if (clientesCache === null) {
      try {
        clientesCache = (await Promise.resolve(bridge()?.cliente?.list?.())) ?? [];
      } catch {
        clientesCache = [];
      }
    }
    return filtrarPorTexto(
      (clientesCache ?? []).map((c): Comando => ({ label: labelCliente(c), to: `/clientes/${c.id}` })),
      q,
    );
  },
};
