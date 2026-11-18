// Emparejamiento y credenciales de las terminales (ADR-150 §2). Un administrador genera en el hub un
// código de un solo uso; la terminal lo canjea y recibe su origin_id, asignado acá (deja de elegirse a
// mano en config.json), y una credencial propia y revocable. Se guardan solo hashes.
import type * as BetterSqlite3 from 'better-sqlite3';
import { createHash, randomBytes, randomInt } from 'node:crypto';

export interface TerminalHub {
  readonly origin_id: string;
  readonly nombre: string;
  readonly emparejada_en: number;
  readonly revocada_en: number | null;
  readonly ultimo_contacto: number | null;
  readonly version_protocolo: number | null;
  readonly version_esquema: number | null;
}

export interface RegistroTerminales {
  generarCodigo(ahora?: number, minutos?: number): { codigo: string; vence_en: number };
  /** Canjea un código. `origin_id_propuesto` lo usa la terminal que ya tenía datos (la semilla, PR4). */
  emparejar(codigo: string, datos: { nombre: string; origin_id_propuesto?: string }, ahora?: number): { origin_id: string; credencial: string };
  /** Devuelve la terminal de la credencial (y registra el contacto), o null si no existe o está revocada. */
  autenticar(credencial: string, ahora?: number, versiones?: { protocolo: number; esquema: number }): { origin_id: string } | null;
  revocar(origin_id: string, ahora?: number): void;
  listar(): TerminalHub[];
}

/** Sin I, O, 0 ni 1: se dicta y se tipea sin confundir. 32 símbolos → 40 bits en 8 caracteres. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ORIGIN_VALIDO = /^[A-Za-z0-9]{1,8}$/; // el mismo formato que acepta la terminal (TERMINAL_VALIDA)
const VIGENCIA_CODIGO_MIN = 15;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const ahoraS = () => Math.floor(Date.now() / 1000);
const normalizarCodigo = (c: string) => c.replace(/[\s-]/g, '').toUpperCase();

export function abrirTerminales(sqlite: BetterSqlite3.Database): RegistroTerminales {
  const tomado = sqlite.prepare('SELECT 1 FROM hub_terminal WHERE origin_id = ?');

  function originLibre(propuesto: string | undefined): string {
    if (propuesto && ORIGIN_VALIDO.test(propuesto) && !tomado.get(propuesto)) return propuesto;
    for (let n = 1; ; n++) if (!tomado.get(`C${n}`)) return `C${n}`;
  }

  return {
    generarCodigo(ahora = ahoraS(), minutos = VIGENCIA_CODIGO_MIN) {
      const crudo = Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
      const vence_en = ahora + minutos * 60;
      sqlite.prepare('INSERT INTO hub_codigo (codigo_hash, creado_en, vence_en) VALUES (?, ?, ?)').run(sha256(crudo), ahora, vence_en);
      return { codigo: `${crudo.slice(0, 4)}-${crudo.slice(4)}`, vence_en };
    },

    emparejar(codigo, datos, ahora = ahoraS()) {
      return sqlite.transaction(() => {
        const hash = sha256(normalizarCodigo(codigo));
        const c = sqlite.prepare('SELECT vence_en, usado_en FROM hub_codigo WHERE codigo_hash = ?').get(hash) as
          { vence_en: number; usado_en: number | null } | undefined;
        if (!c) throw new Error('CODIGO_INVALIDO');
        if (c.usado_en != null) throw new Error('CODIGO_USADO');
        if (ahora > c.vence_en) throw new Error('CODIGO_VENCIDO');
        const nombre = String(datos.nombre ?? '').trim().slice(0, 60) || 'Terminal';
        const origin_id = originLibre(datos.origin_id_propuesto);
        const credencial = randomBytes(32).toString('base64url');
        sqlite.prepare('UPDATE hub_codigo SET usado_en = ?, origin_id = ? WHERE codigo_hash = ?').run(ahora, origin_id, hash);
        sqlite.prepare('INSERT INTO hub_terminal (origin_id, nombre, credencial_hash, emparejada_en) VALUES (?, ?, ?, ?)')
          .run(origin_id, nombre, sha256(credencial), ahora);
        return { origin_id, credencial };
      })();
    },

    autenticar(credencial, ahora = ahoraS(), versiones) {
      if (!credencial) return null;
      const t = sqlite.prepare('SELECT origin_id FROM hub_terminal WHERE credencial_hash = ? AND revocada_en IS NULL')
        .get(sha256(credencial)) as { origin_id: string } | undefined;
      if (!t) return null;
      sqlite.prepare(
        'UPDATE hub_terminal SET ultimo_contacto = ?, version_protocolo = COALESCE(?, version_protocolo), version_esquema = COALESCE(?, version_esquema) WHERE origin_id = ?',
      ).run(ahora, versiones?.protocolo ?? null, versiones?.esquema ?? null, t.origin_id);
      return { origin_id: t.origin_id };
    },

    revocar(origin_id, ahora = ahoraS()) {
      const r = sqlite.prepare('UPDATE hub_terminal SET revocada_en = ? WHERE origin_id = ? AND revocada_en IS NULL').run(ahora, origin_id);
      if (r.changes === 0 && !tomado.get(origin_id)) throw new Error('TERMINAL_INEXISTENTE');
    },

    listar() {
      return sqlite.prepare(
        'SELECT origin_id, nombre, emparejada_en, revocada_en, ultimo_contacto, version_protocolo, version_esquema FROM hub_terminal ORDER BY origin_id',
      ).all() as TerminalHub[];
    },
  };
}
