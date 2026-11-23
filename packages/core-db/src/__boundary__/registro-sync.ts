// packages/core-db/src/__boundary__/registro-sync.ts
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { CAMPOS_SYNC } from './sync-fields';

/**
 * Tipo de cada tabla para el motor de sync (ADR-150 §3, baranda B2 de ADR-091/092).
 * - `maestro`: se edita; en el hub se resuelve por last-write-wins + log de conflictos (ADR-012).
 * - `libro`: solo se inserta (movimientos); en el hub, insertar si no existe.
 * - `local`: estado de la terminal; no sincroniza (geo de referencia, outbox de avisos, códigos de
 *   recuperación, parámetros hasta que F1 separe los del negocio).
 * `proyectadas`: columnas de una tabla `maestro` que no viajan y se recalculan desde su libro (ADR-151).
 * `locales`: columnas de una tabla `maestro` que no viajan y son de cada terminal (F3 PR1, ADR-159): el
 * último acceso de un usuario cambia en cada caja donde entra y no es un dato del negocio.
 */
export type TipoSync = 'maestro' | 'libro' | 'local';

export interface EntradaSync {
  readonly tipo: TipoSync;
  readonly proyectadas?: readonly string[];
  readonly locales?: readonly string[];
}

/** Columnas de una tabla que no viajan al hub ni se pisan al bajar: proyectadas y locales. */
export function columnasQueNoViajan(entrada: EntradaSync): Set<string> {
  return new Set([...(entrada.proyectadas ?? []), ...(entrada.locales ?? [])]);
}

export type RegistroSync = Readonly<Record<string, EntradaSync>>;

/** Une el registro del núcleo con el de una app. Una tabla declarada dos veces es un error de arranque. */
export function combinarRegistros(...registros: RegistroSync[]): RegistroSync {
  const out: Record<string, EntradaSync> = {};
  for (const r of registros) {
    for (const [tabla, entrada] of Object.entries(r)) {
      if (tabla in out) throw new Error(`REGISTRO_SYNC_DUPLICADO: ${tabla}`);
      out[tabla] = entrada;
    }
  }
  return out;
}

/**
 * Devuelve los problemas del registro frente al esquema compuesto de una app (vacío = OK). Puro:
 * recorre el objeto de esquema que la app le pasa a Drizzle e ignora lo que no es tabla.
 * Problemas: `sin_registro:<t>`, `registro_sin_tabla:<t>`, `sin_campos_sync:<t>` (maestro/libro sin
 * id texto + campos de sync), `proyectada_inexistente:<t>.<col>`, `proyectada_fuera_de_maestro:<t>` y los
 * equivalentes de `locales` (`local_inexistente`, `local_fuera_de_maestro`, `local_y_proyectada`).
 */
export function verificarRegistroSync(schema: Record<string, unknown>, registro: RegistroSync): string[] {
  const problemas: string[] = [];
  const vistas = new Set<string>();
  for (const v of Object.values(schema)) {
    if (!is(v, SQLiteTable)) continue;
    const cfg = getTableConfig(v);
    vistas.add(cfg.name);
    const entrada = registro[cfg.name];
    if (!entrada) {
      problemas.push(`sin_registro:${cfg.name}`);
      continue;
    }
    const cols = new Map(cfg.columns.map((c) => [c.name, c]));
    if (entrada.tipo !== 'local') {
      const ok = cols.get('id')?.getSQLType() === 'text' && CAMPOS_SYNC.every((c) => cols.has(c));
      if (!ok) problemas.push(`sin_campos_sync:${cfg.name}`);
    }
    if (entrada.proyectadas?.length) {
      if (entrada.tipo !== 'maestro') problemas.push(`proyectada_fuera_de_maestro:${cfg.name}`);
      else for (const c of entrada.proyectadas) if (!cols.has(c)) problemas.push(`proyectada_inexistente:${cfg.name}.${c}`);
    }
    if (entrada.locales?.length) {
      if (entrada.tipo !== 'maestro') problemas.push(`local_fuera_de_maestro:${cfg.name}`);
      else for (const c of entrada.locales) {
        if (!cols.has(c)) problemas.push(`local_inexistente:${cfg.name}.${c}`);
        else if (entrada.proyectadas?.includes(c)) problemas.push(`local_y_proyectada:${cfg.name}.${c}`);
      }
    }
  }
  for (const tabla of Object.keys(registro)) if (!vistas.has(tabla)) problemas.push(`registro_sin_tabla:${tabla}`);
  return problemas.sort();
}

/**
 * Registro de las tablas del núcleo. Es función y no constante a propósito: las apps arman su
 * esquema con `export * from '@core/db'`, y lo que exporta este paquete termina en el objeto que
 * recibe Drizzle (ver el comentario de `src/index.ts`).
 */
export function registroSyncCore(): RegistroSync {
  return {
    // config — PR7 de F1 separa las claves del negocio (sincronizan) de las de la terminal.
    parametros_sistema: { tipo: 'local' },
    configuracion_negocio: { tipo: 'maestro' },
    // sync — cola de cambios e interruptor de aplicación: estado de la terminal (ADR-150 §4 y §6).
    sync_outbox: { tipo: 'local' },
    sync_aplicando: { tipo: 'local' },
    sync_recibido_en_espera: { tipo: 'local' },
    // geo — catálogo de referencia sembrado en cada instalación (ADR-024).
    provincia: { tipo: 'local' },
    departamento: { tipo: 'local' },
    localidad: { tipo: 'local' },
    // seguridad
    rol: { tipo: 'maestro' },
    permiso: { tipo: 'maestro' },
    rol_permiso: { tipo: 'maestro' },
    rol_permiso_override: { tipo: 'maestro' },
    usuario: { tipo: 'maestro', locales: ['ultimo_acceso'] },
    usuario_preferencias: { tipo: 'maestro' },
    recuperacion_password: { tipo: 'local' }, // códigos de un solo uso (ADR-137)
    // personas, fiscal, precios
    cliente: { tipo: 'maestro' },
    proveedor: { tipo: 'maestro' },
    impuesto: { tipo: 'maestro' },
    lista_precio: { tipo: 'maestro' },
    // crédito — el saldo se proyecta desde el libro (ADR-151)
    cuenta_corriente_cliente: { tipo: 'maestro', proyectadas: ['saldo_centavos', 'fecha_ultimo_movimiento'] },
    movimiento_cuenta_corriente: { tipo: 'libro' },
    // ventas — la venta cambia de estado (en espera, confirmada, anulada): es maestro. El comprobante
    // también, porque el fiscal (R2) le va a actualizar estado y CAE. La caja por terminal tiene un solo
    // escritor (ADR-155 §2); su monto esperado pasa a proyectado solo en modo compartido (F2).
    venta: { tipo: 'maestro' },
    comprobante: { tipo: 'maestro' },
    caja: { tipo: 'maestro' },
    movimiento_caja: { tipo: 'libro' },
    venta_pago: { tipo: 'libro' },
  };
}
