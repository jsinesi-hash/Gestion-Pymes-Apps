export const ars = (pesos: number): string =>
  pesos.toFixed(2).replace('.', ',');

export const arsDecimal = (pesos: number): string =>
  pesos.toFixed(2);

export const fecha = (iso: string | Date): string => {
  const d = iso instanceof Date ? iso : new Date(iso);
  return d.toLocaleDateString('es-AR');
};

export const estadoStock = (n: number, umbral: number): string => {
  const stockBajo = n <= umbral && umbral > 0 ? 'bajo' : 'en stock';
  return n <= 0 ? 'sin stock' : stockBajo;
};
