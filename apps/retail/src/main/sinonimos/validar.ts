import { normalizarTermino } from './normalizar';
import type { SinonimoGrupo } from './dataset';

// ADR-067 — Validador de grupos de sinónimos. Reutilizable por el seed (para no publicar
// un dataset roto) y por la futura importación CSV (Fase 4). Trabaja sobre la estructura
// de grupos ya parseada; la validación de columnas del CSV crudo la hace el parser al
// importar y produce `errores` de nivel archivo por separado.

export type ProblemaSinonimo = {
  nivel: 'error' | 'advertencia';
  grupo?: number;        // índice 1-based del grupo, si aplica
  termino?: string;
  mensaje: string;
};

export type ResultadoValidacion = {
  ok: boolean;           // true si no hay errores (las advertencias no bloquean)
  errores: ProblemaSinonimo[];
  advertencias: ProblemaSinonimo[];
};

// Columnas esperadas del CSV de sinónimos (para el parser de importación).
export const COLUMNAS_CSV_SINONIMOS = ['canonico', 'sinonimos', 'abreviaturas', 'rubro', 'nota'] as const;

export function validarSinonimos(grupos: SinonimoGrupo[]): ResultadoValidacion {
  const errores: ProblemaSinonimo[] = [];
  const advertencias: ProblemaSinonimo[] = [];

  // termino_norm → índices (1-based) de grupos donde aparece (para detectar ambigüedad)
  const aparicionesPorNorm = new Map<string, number[]>();

  grupos.forEach((g, i) => {
    const idx = i + 1;
    const canonicoNorm = normalizarTermino(g.canonico);

    if (!canonicoNorm) {
      errores.push({ nivel: 'error', grupo: idx, termino: g.canonico, mensaje: 'Canónico vacío o sin caracteres válidos.' });
    }

    const sinonimos = g.sinonimos ?? [];
    const abreviaturas = g.abreviaturas ?? [];

    // Grupo de un solo término (canónico sin ningún sinónimo/abreviatura): no aporta nada.
    if (sinonimos.length === 0 && abreviaturas.length === 0) {
      advertencias.push({ nivel: 'advertencia', grupo: idx, termino: g.canonico, mensaje: 'Grupo de un solo término (sin sinónimos ni abreviaturas): no expande nada.' });
    }

    // Términos del grupo (canónico + sinónimos + abreviaturas) para dedup interno y global.
    const vistosEnGrupo = new Set<string>();
    const todos = [g.canonico, ...sinonimos, ...abreviaturas];
    for (const t of todos) {
      const norm = normalizarTermino(t);
      if (!norm) {
        errores.push({ nivel: 'error', grupo: idx, termino: t, mensaje: 'Término vacío o sin caracteres válidos tras normalizar.' });
        continue;
      }
      if (vistosEnGrupo.has(norm)) {
        advertencias.push({ nivel: 'advertencia', grupo: idx, termino: t, mensaje: `Término duplicado dentro del grupo ("${norm}").` });
      } else {
        vistosEnGrupo.add(norm);
      }
      const arr = aparicionesPorNorm.get(norm) ?? [];
      if (arr[arr.length - 1] !== idx) arr.push(idx); // no contar dos veces el mismo grupo
      aparicionesPorNorm.set(norm, arr);
    }
  });

  // Mismo término en grupos distintos → expansión ambigua (une ambos grupos).
  for (const [norm, grupitos] of aparicionesPorNorm) {
    if (grupitos.length > 1) {
      advertencias.push({
        nivel: 'advertencia',
        termino: norm,
        mensaje: `El término "${norm}" aparece en ${grupitos.length} grupos (${grupitos.join(', ')}): la búsqueda los unirá.`,
      });
    }
  }

  return { ok: errores.length === 0, errores, advertencias };
}
