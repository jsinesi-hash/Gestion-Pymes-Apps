import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

type Db = BetterSQLite3Database<typeof schema>;

const SYNC  = { version: 1, origin_id: 'system', sync_state: 'synced' as const };
const AUDIT = { usuario_creacion_id: 'system' };

// ── Impuestos ──────────────────────────────────────────────────────────────────
// Se chequea por nombre (no hay UNIQUE en el schema).
const IMPUESTOS = [
  { nombre: 'IVA 21%',   tipo: 'iva'    as const, alicuota: 21,   predeterminado: true  },
  { nombre: 'IVA 10.5%', tipo: 'iva'    as const, alicuota: 10.5, predeterminado: false },
  { nombre: 'Exento',    tipo: 'exento' as const, alicuota: 0,    predeterminado: false },
];

// ── Categorías raíz ────────────────────────────────────────────────────────────
const CATEGORIAS_RAIZ = [
  'Herramientas', 'Fijaciones', 'Pintura', 'Electricidad', 'Plomería',
];

const SUBCATEGORIAS: { nombre: string; padre: string }[] = [
  { nombre: 'Herramientas Manuales',   padre: 'Herramientas'  },
  { nombre: 'Herramientas Eléctricas', padre: 'Herramientas'  },
  { nombre: 'Tornillos y Bulones',     padre: 'Fijaciones'    },
  { nombre: 'Anclajes y Tarugos',      padre: 'Fijaciones'    },
  { nombre: 'Pinturas y Esmaltes',     padre: 'Pintura'       },
  { nombre: 'Accesorios de Pintura',   padre: 'Pintura'       },
  { nombre: 'Cables y Conductores',    padre: 'Electricidad'  },
  { nombre: 'Iluminación',             padre: 'Electricidad'  },
  { nombre: 'Caños y Conexiones',      padre: 'Plomería'      },
  { nombre: 'Llaves y Válvulas',       padre: 'Plomería'      },
];

// ── Marcas ─────────────────────────────────────────────────────────────────────
// marca.nombre es UNIQUE → onConflictDoNothing() es suficiente.
const MARCAS = ['Stanley', 'Bosch', 'Tramontina', 'Plavicon', 'Philips', 'Ferrum'];

// ── Unidades base ──────────────────────────────────────────────────────────────
// unidad.abreviatura es UNIQUE → onConflictDoNothing() es suficiente.
const DEFAULT_UNITS = [
  { nombre: 'Unidad',    abreviatura: 'u'      },
  { nombre: 'Unidad',    abreviatura: 'unidad' },
  { nombre: 'Unidad',    abreviatura: 'und'    },
  { nombre: 'Kilogramo', abreviatura: 'kg'     },
  { nombre: 'Litro',     abreviatura: 'lt'     },
  { nombre: 'Metro',     abreviatura: 'mt'     },
  { nombre: 'Metro',     abreviatura: 'metro'  },
];

export function runCatalogSeed(db: Db): void {
  const now  = new Date();
  const base = { ...SYNC, ...AUDIT, fecha_creacion: now, updated_at: now, activo: true };

  // ── Impuestos ─────────────────────────────────────────────────────────────
  for (const imp of IMPUESTOS) {
    const exists = db.select({ id: schema.impuesto.id })
      .from(schema.impuesto)
      .where(eq(schema.impuesto.nombre, imp.nombre))
      .get();
    if (!exists) {
      db.insert(schema.impuesto).values({ id: randomUUID(), ...imp, ...base }).run();
    }
  }

  // ── Unidades ──────────────────────────────────────────────────────────────
  for (const u of DEFAULT_UNITS) {
    db.insert(schema.unidad).values({ id: randomUUID(), ...u, ...base })
      .onConflictDoNothing().run();
  }

  // ── Categorías raíz ───────────────────────────────────────────────────────
  const raizIds: Record<string, string> = {};
  for (const nombre of CATEGORIAS_RAIZ) {
    const existing = db.select({ id: schema.categoria.id })
      .from(schema.categoria)
      .where(and(eq(schema.categoria.nombre, nombre), isNull(schema.categoria.categoria_padre_id)))
      .get();
    if (existing) {
      raizIds[nombre] = existing.id;
    } else {
      const id = randomUUID();
      db.insert(schema.categoria).values({ id, nombre, categoria_padre_id: null, ...base }).run();
      raizIds[nombre] = id;
    }
  }

  // ── Subcategorías ─────────────────────────────────────────────────────────
  for (const { nombre, padre } of SUBCATEGORIAS) {
    const padreId = raizIds[padre];
    if (!padreId) continue;
    const exists = db.select({ id: schema.categoria.id })
      .from(schema.categoria)
      .where(and(eq(schema.categoria.nombre, nombre), eq(schema.categoria.categoria_padre_id, padreId)))
      .get();
    if (!exists) {
      db.insert(schema.categoria).values({ id: randomUUID(), nombre, categoria_padre_id: padreId, ...base }).run();
    }
  }

  // ── Marcas ────────────────────────────────────────────────────────────────
  for (const nombre of MARCAS) {
    db.insert(schema.marca).values({ id: randomUUID(), nombre, ...base })
      .onConflictDoNothing().run();
  }
}
