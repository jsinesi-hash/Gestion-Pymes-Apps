// Formatea centavos a pesos ARS con símbolo "$".
// Ejemplo: 12550 → "$ 125,50"
export function formatCurrency(centavos: number): string {
  const pesos = centavos / 100;
  return `$ ${pesos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
