// ADR-067 — Normalización de términos para el match de sinónimos.
//
// Unificado con ADR-063: el normalizador canónico vive en `packages/shared`
// (`normalizar`, measure-aware) y se aplica a ambos lados de toda comparación. Este módulo
// sólo re-exporta con el nombre local para no tocar los imports existentes del feature.
export { normalizar as normalizarTermino } from '@ferreteria/shared';
