// Normalización canónica de texto para comparación/búsqueda (ADR-063 §3 / ADR-067).
// Única función de normalización compartida: la usan la expansión de sinónimos de la
// búsqueda (ADR-067) y el matching producto↔proveedor por similitud (ADR-063). Debe
// aplicarse a AMBOS lados de toda comparación para que coincidan.
//
// Unidades reconocidas para canonicalización de FORMATO: cuando una de estas va separada
// del número por espacio(s), se pega al número ("8 mm" → "8mm") para que tokenice igual que
// la forma ya pegada. NO se borra la unidad ni se infiere: solo se canoniza el formato.
// Extender con cautela: cada unidad nueva altera el matching de ADR-063/067 en AMBOS lados
// (búsqueda por similitud y matching producto↔proveedor). La `"` (pulgada) queda fuera a
// propósito: preservar fracciones/pulgadas es una divergencia descartada (mutilación simétrica).
const UNIDADES_FORMATO = ['mm', 'cm', 'm'];

// Pipeline: NFD → sin diacríticos (ñ→n incluida) → minúsculas → canonizar medidas
// (`6 × 40` / `6 x 40` → `6x40`) → pegar unidad separada por espacio (`8 mm` → `8mm`) →
// no-alfanuméricos a espacio (la `x` de medida y las unidades tipo mm/cm sobreviven porque
// son alfanuméricas) → colapsar espacios → trim.
export function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')        // marcas diacríticas
    .toLowerCase()
    .replace(/(\d)\s*[x×]\s*(\d)/g, '$1x$2') // canoniza medidas: 6 × 40 → 6x40
    // pega la unidad separada por espacio al número. El lookahead `(?![a-z])` evita comerse
    // palabras que empiezan con la unidad (`8 metros` NO → `8metros`; `mm` en `mmara` no matchea).
    .replace(new RegExp(`(\\d)\\s+(${UNIDADES_FORMATO.join('|')})(?![a-z])`, 'g'), '$1$2')
    .replace(/[^a-z0-9 ]/g, ' ')            // resto de no-alfanuméricos → espacio
    .replace(/\s+/g, ' ')
    .trim();
}
