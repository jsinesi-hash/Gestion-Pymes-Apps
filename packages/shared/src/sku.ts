// Extension point for future entity types (kits, servicios): agregar via ADR breve.
const SKU_TIPO = 'P';
const SKU_SEQ_LEN = 7;

// Luhn módulo-10 estándar sobre los 7 dígitos del secuencial.
// El prefijo tipo NO participa del cálculo.
export function checkDigit(secuencial: number): number {
  const digits = String(secuencial).padStart(SKU_SEQ_LEN, '0').split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    const posFromRight = (digits.length - 1) - i;
    if (posFromRight % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

export function formatSku(secuencial: number): string {
  const seq = String(secuencial).padStart(SKU_SEQ_LEN, '0');
  return `${SKU_TIPO}-${seq}-${checkDigit(secuencial)}`;
}

export class SkuParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkuParseError';
  }
}

// Valida formato + check digit antes de retornar.
// Lanzar SkuParseError sin consultar la DB si el string es inválido.
export function parseSku(s: string): { secuencial: number } {
  const match = /^P-(\d{7})-(\d)$/.exec(s);
  if (!match) throw new SkuParseError(`Formato de SKU inválido: "${s}"`);
  const secuencial = Number.parseInt(match[1], 10);
  const providedCd = Number.parseInt(match[2], 10);
  const expectedCd = checkDigit(secuencial);
  if (providedCd !== expectedCd) {
    throw new SkuParseError(`Check digit inválido en "${s}": esperado ${expectedCd}, recibido ${providedCd}`);
  }
  return { secuencial };
}
