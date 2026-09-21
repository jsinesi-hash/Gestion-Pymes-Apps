import { useState, useMemo } from 'react';

export type RangeKey = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'custom';

export type Period = {
  key: RangeKey;
  desde: Date;
  hasta: Date;
  desde_anterior: Date;
  hasta_anterior: Date;
  label: string;
  label_anterior: string;
};

export function calcPeriod(key: RangeKey, customFrom?: Date, customTo?: Date): Period {
  const now = new Date();

  if (key === 'hoy') {
    const desde = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const hasta = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const desde_anterior = new Date(desde.getTime() - 86400000);
    const hasta_anterior = new Date(hasta.getTime() - 86400000);
    return { key, desde, hasta, desde_anterior, hasta_anterior, label: 'Hoy', label_anterior: 'Ayer' };
  }

  if (key === 'semana') {
    const dow = now.getDay(); // 0=Dom
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    const desde = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    const hasta = new Date(desde.getTime() + 6 * 86400000);
    hasta.setHours(23, 59, 59, 999);
    const desde_anterior = new Date(desde.getTime() - 7 * 86400000);
    const hasta_anterior = new Date(hasta.getTime() - 7 * 86400000);
    return { key, desde, hasta, desde_anterior, hasta_anterior, label: 'Esta semana', label_anterior: 'Semana anterior' };
  }

  if (key === 'mes') {
    const desde = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const hasta = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const desde_anterior = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const hasta_anterior = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { key, desde, hasta, desde_anterior, hasta_anterior, label: 'Este mes', label_anterior: 'Mes anterior' };
  }

  if (key === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3);
    const desde = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0, 0);
    const hasta = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    const desde_anterior = new Date(now.getFullYear(), q * 3 - 3, 1, 0, 0, 0, 0);
    const hasta_anterior = new Date(desde.getTime() - 1);
    hasta_anterior.setHours(23, 59, 59, 999);
    return { key, desde, hasta, desde_anterior, hasta_anterior, label: 'Este trimestre', label_anterior: 'Trimestre anterior' };
  }

  // custom
  const desde = customFrom ?? new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const hasta  = customTo   ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const diffMs = hasta.getTime() - desde.getTime();
  const desde_anterior = new Date(desde.getTime() - diffMs - 1);
  const hasta_anterior = new Date(desde.getTime() - 1);
  return { key, desde, hasta, desde_anterior, hasta_anterior, label: 'Personalizado', label_anterior: 'Período anterior' };
}

export function usePeriod(initial: RangeKey = 'mes') {
  const [key, setKey] = useState<RangeKey>(initial);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo,   setCustomTo]   = useState<Date | undefined>(undefined);

  const period = useMemo(
    () => calcPeriod(key, customFrom, customTo),
    [key, customFrom, customTo],
  );

  return { period, key, setKey, customFrom, setCustomFrom, customTo, setCustomTo };
}
