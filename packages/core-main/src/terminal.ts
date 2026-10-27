import fs from 'node:fs';
import path from 'node:path';
import { resolveTerminalConfig, type TerminalConfig } from '@ferreteria/shared';
import { aplicarConfigTerminal } from './context';

// Revisión 2026-10-20 (P2): `config.ts` estaba duplicado en Retail y Elaborados (idéntico salvo un
// comentario). Recibe la carpeta de datos del usuario por parámetro para no importar `electron`.

/**
 * Lee `<userData>/config.json`, lo normaliza con el valor por defecto y lo vuelve a escribir.
 * Un archivo ilegible cae al valor por defecto (C1) y se avisa: no se descarta en silencio.
 * NO toca el `origin_id` activo del proceso: para eso está `iniciarTerminal`.
 */
export function cargarConfigTerminal(userDataDir: string): TerminalConfig {
  const ruta = path.join(userDataDir, 'config.json');
  let existente: TerminalConfig | null = null;
  if (fs.existsSync(ruta)) {
    try {
      existente = JSON.parse(fs.readFileSync(ruta, 'utf-8')) as TerminalConfig;
    } catch (e) {
      console.warn(`[terminal] config.json ilegible en "${ruta}"; se usa el valor por defecto:`, e);
      existente = null;
    }
  }
  const config = resolveTerminalConfig(existente);
  fs.writeFileSync(ruta, JSON.stringify(config, null, 2), 'utf-8');
  return config;
}

/**
 * Carga la config de la terminal y aplica su `origin_id` al contexto del main (P0, ADR-115).
 * Debe llamarse al arrancar, antes de `runStartup` y de registrar handlers.
 */
export function iniciarTerminal(userDataDir: string): TerminalConfig {
  const config = cargarConfigTerminal(userDataDir);
  aplicarConfigTerminal(config);
  return config;
}
