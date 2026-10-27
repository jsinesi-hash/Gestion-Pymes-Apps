import { useState, useCallback } from 'react';
import type { ImportPreviewResult, ImportSummaryResult, ImportRowResult, SummaryRowResult } from '../../main/ipc/importar';

import { bridge } from '@core/ui';
export type Entidad = 'productos' | 'clientes' | 'proveedores' | 'ubicaciones' | 'stockInicial';
export type ImportarEstado = 'idle' | 'validating' | 'preview' | 'confirming' | 'done';

type Canal = { validar: (p: unknown) => Promise<unknown>; confirmar: (p: unknown) => Promise<unknown> };

const f = () => bridge();

function canal(entidad: Entidad): Canal {
  const importar = f().importar as Record<Entidad, Canal>;
  return importar[entidad];
}

export function useImportar() {
  const [entidad, setEntidadState] = useState<Entidad>('productos');
  const [estado, setEstado] = useState<ImportarEstado>('idle');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [summary, setSummary] = useState<ImportSummaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setEntidad = useCallback((e: Entidad) => {
    setEntidadState(e);
    setEstado('idle');
    setPreview(null);
    setSummary(null);
    setError(null);
  }, []);

  const subirArchivo = useCallback(async (csv: string) => {
    setEstado('validating');
    setError(null);
    try {
      const result = await canal(entidad).validar({ csv }) as ImportPreviewResult;
      if (result.errorArchivo) {
        setError(result.errorArchivo);
        setEstado('idle');
        return;
      }
      setPreview(result);
      setEstado('preview');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al validar');
      setEstado('idle');
    }
  }, [entidad]);

  const confirmar = useCallback(async () => {
    if (!preview) return;
    setEstado('confirming');
    const validRows = preview.rows.filter(r => r.status !== 'error');
    const rechazadas: SummaryRowResult[] = preview.rows
      .filter(r => r.status === 'error')
      .map(r => ({ fila: r.fila, status: 'error' as const, mensaje: r.error ?? 'Fila rechazada (no se cargó)', raw: r.raw }));
    try {
      const result = await canal(entidad).confirmar({ rows: validRows }) as ImportSummaryResult;
      const merged: ImportSummaryResult = {
        rows: [...result.rows, ...rechazadas].sort((a, b) => a.fila - b.fila),
        stats: { ...result.stats, error: result.stats.error + rechazadas.length },
      };
      setSummary(merged);
      setEstado('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar');
      setEstado('preview');
    }
  }, [entidad, preview]);

  const reset = useCallback(() => {
    setEstado('idle');
    setPreview(null);
    setSummary(null);
    setError(null);
  }, []);

  const validarFila = useCallback(async (raw: Record<string, string>, fila: number): Promise<ImportRowResult> => {
    return f().importar.validarFila({ entidad, raw, fila });
  }, [entidad]);

  const editarFilaPreview = useCallback(async (fila: number, raw: Record<string, string>) => {
    if (!preview) return;
    const result = await validarFila(raw, fila);
    setPreview(prev => {
      if (!prev) return prev;
      const rows = prev.rows.map(r => (r.fila === fila ? result : r));
      const stats = { ok: 0, update: 0, error: 0 };
      rows.forEach(r => { stats[r.status]++; });
      return { ...prev, rows, stats };
    });
  }, [preview, validarFila]);

  return { entidad, setEntidad, estado, preview, summary, error, subirArchivo, confirmar, reset, validarFila, editarFilaPreview };
}
