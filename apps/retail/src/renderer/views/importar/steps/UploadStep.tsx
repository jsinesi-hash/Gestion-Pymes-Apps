import { useRef, useState, useEffect } from 'react';
import type { Entidad } from '../../../hooks/useImportar';

import { bridge } from '@core/ui';
const ENTITY_LABELS: Record<Entidad, string> = {
  productos: 'Productos', clientes: 'Clientes', proveedores: 'Proveedores',
  ubicaciones: 'Ubicaciones', stockInicial: 'Stock inicial',
};

const ENTIDAD_CANAL: Record<Entidad, string> = {
  productos: 'productos', clientes: 'clientes', proveedores: 'proveedores',
  ubicaciones: 'ubicaciones', stockInicial: 'stock-inicial',
};

const f = () => bridge();

type PlantillaInfo = { csv: string; columnas: string[]; ejemplo: string[]; obligatorias: string[]; orNote?: string };

type Props = { entidad: Entidad; onFile: (csv: string) => void; loading: boolean };

export function UploadStep({ entidad, onFile, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [plantilla, setPlantilla] = useState<PlantillaInfo | null>(null);

  useEffect(() => {
    setPlantilla(null);
    f().importar.plantilla({ entidad: ENTIDAD_CANAL[entidad] }).then(setPlantilla);
  }, [entidad]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    onFile(text);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const downloadTemplate = () => {
    if (!plantilla) return;
    const blob = new Blob([plantilla.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `plantilla-${entidad}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', gap: '1.1rem' }}>

      {/* 1) Mini-preview de columnas PRIMERO (ADR-051 C.1) */}
      {plantilla && (
        <div style={{ width: '100%', maxWidth: 640 }}>
          <p className="text-sm text-muted" style={{ marginBottom: 8 }}>
            Columnas esperadas para <strong>{ENTITY_LABELS[entidad]}</strong>:
          </p>
          <div className="table-wrap" style={{ border: '1px solid var(--line)', borderRadius: 10, maxHeight: 120 }}>
            <table style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  {plantilla.columnas.map(c => (
                    <th key={c}>
                      {c}{plantilla.obligatorias.includes(c) && <span style={{ color: 'var(--danger)' }}> *</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>
                  {plantilla.ejemplo.map((v, i) => <td key={plantilla.columnas[i]}>{v || '—'}</td>)}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
            <span><span style={{ color: 'var(--danger)' }}>*</span> obligatorio</span>
            <span>el resto es opcional</span>
            {plantilla.orNote && <span>{plantilla.orNote}</span>}
          </div>
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <button type="button" onClick={downloadTemplate} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>
              ↓ Descargar plantilla de {ENTITY_LABELS[entidad]}
            </button>
          </div>
        </div>
      )}

      {/* Selección de archivo por explorador — sin drag&drop (no funcionaba de forma
          confiable en Electron y no vale la pena mantener la afordancia rota). */}
      <div
        role="button"
        aria-label="Seleccionar archivo CSV"
        tabIndex={0}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !loading) inputRef.current?.click(); }}
        style={{ width: '100%', maxWidth: 640, border: '2px dashed var(--line)', borderRadius: 16, padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'center' }}
      >
        <div className="font-bold" style={{ fontSize: '1rem' }}>Hacé clic para elegir un archivo .csv</div>
        {loading && <div className="text-muted text-sm">Validando…</div>}
      </div>
      <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleInputChange} data-testid="file-input" />

      <p className="text-muted text-xs" style={{ maxWidth: 460, textAlign: 'center' }}>
        Las filas con errores se omiten; el resto se importa. Si falta una columna obligatoria completa, se avisa antes de procesar en vez de repetir el mismo error en cada fila.
      </p>
    </div>
  );
}
