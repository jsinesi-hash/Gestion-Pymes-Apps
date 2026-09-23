export function fmtARS(centavos: number) {
  const signo = centavos < 0 ? '-' : '';
  return `${signo}$ ${(Math.abs(centavos) / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

export function badgeEstado(saldo: number, limite: number) {
  if (limite > 0 && saldo > limite) return { label: 'Excedido',   color: 'var(--danger)' };
  if (saldo < 0)                    return { label: 'A favor',    color: 'var(--ok)' };
  if (limite === 0)                 return { label: 'Sin límite', color: 'var(--ink-3)' };
  return                                   { label: 'OK',         color: 'var(--ink-3)' };
}
