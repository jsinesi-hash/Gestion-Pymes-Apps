import { useState, useRef, useEffect, useCallback } from 'react';
import { useProductosSimilares } from '../../hooks/useProductosSimilares';
import { useBusquedaSimilaresHabilitado } from '../../hooks/useBusquedaSimilaresHabilitado';
import { AltaExpressModal } from '../productos/AltaExpressModal';

type Props = {
  onAdd: (productoId: string, presentacionId?: string | null, factorAStock?: number) => Promise<void>;
  disabled?: boolean;
  clienteId?: string | null;
};

const DEBOUNCE_MS = 300;

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PosScanBar({ onAdd, disabled, clienteId }: Readonly<Props>) {
  const [value, setValue] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [modoSimilitud, setModoSimilitud] = useState(false);
  const [buscoSinResultado, setBuscoSinResultado] = useState(false);
  const [showAlta, setShowAlta] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const similaresHabilitado = useBusquedaSimilaresHabilitado();
  const { items: similares } = useProductosSimilares(
    modoSimilitud ? value : '',
    clienteId ? { clienteId } : {},
  );

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Orden de presentación en caja: stock disponible primero, luego score desc.
  const similaresOrdenados = [...similares].sort(
    (a, b) => Number(b.stock_fisico > 0) - Number(a.stock_fisico > 0) || b.score - a.score,
  );

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); setBuscoSinResultado(false); return; }
    setSearching(true);
    try {
      const f = (globalThis as any).ferreteria;
      // Try presentation GTIN first
      const ppHit = await (f.presentacion?.buscarPorGtin?.({ gtin: query.trim() }) ?? Promise.resolve(null)).catch(() => null);
      if (ppHit) {
        await onAdd(ppHit.producto_id, ppHit.presentacion_id, ppHit.factor_a_stock);
        setValue('');
        setResults([]);
        setBuscoSinResultado(false);
        inputRef.current?.focus();
        return;
      }
      const exact = await f.catalogo.producto.list({ exactCodigo: query.trim(), activo: true, page: 1, pageSize: 1 });
      if (exact.items.length === 1) {
        await onAdd(exact.items[0].id);
        setValue('');
        setResults([]);
        setBuscoSinResultado(false);
        inputRef.current?.focus();
        return;
      }
      const found = await f.catalogo.producto.list({ busqueda: query.trim(), activo: true, page: 1, pageSize: 8 });
      setResults(found.items);
      setBuscoSinResultado(found.items.length === 0);
    } finally {
      setSearching(false);
    }
  }, [onAdd]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    // En modo similares no se escanea ni se busca por código: sólo texto libre (el hook debouncea).
    if (modoSimilitud) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); setBuscoSinResultado(false); return; }
    debounceRef.current = setTimeout(() => doSearch(v), DEBOUNCE_MS);
  }

  async function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || !value.trim() || modoSimilitud) return;
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await doSearch(value);
  }

  async function handleSelect(id: string) {
    await onAdd(id);
    setValue('');
    setResults([]);
    inputRef.current?.focus();
  }

  return (
    <div className="scan-wrap" style={{ position: 'relative', padding: 0, borderBottom: 'none' }}>
      <div className="scan-box" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
          <rect x="7" y="7" width="10" height="10" rx="1"/>
        </svg>
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={modoSimilitud ? 'Buscar similares por nombre (ej. pincel 3x8)…' : 'Escanear QR / EAN o buscar por nombre...'}
        />
        {searching && <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 8 }}>...</span>}
        {similaresHabilitado && (
          <button
            type="button"
            className={modoSimilitud ? 'btn-primary' : 'btn'}
            aria-pressed={modoSimilitud}
            title="Buscar productos por similitud de nombre (todas las marcas)"
            onClick={() => { setModoSimilitud(m => !m); setResults([]); }}
            style={{ flexShrink: 0, fontSize: 13 }}
          >
            Buscar similares
          </button>
        )}
      </div>

      {/* Dropdown búsqueda directa (modo apagado) */}
      {!modoSimilitud && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden', marginTop: 4 }}>
          {results.map((p: any) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'none', color: 'var(--ink)', cursor: 'pointer', borderBottom: '1px solid var(--line)', fontSize: 14 }}
            >
              <span style={{ fontWeight: 600 }}>{p.nombre_corto}</span>
              <span className="text-muted text-xs" style={{ marginLeft: 8 }}>{p.sku}</span>
            </button>
          ))}
          <button onClick={() => setResults([])} style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)' }}>
            Cerrar
          </button>
        </div>
      )}

      {/* Sin resultados: ofrecer alta express (PROD-3, ADR-079) */}
      {!modoSimilitud && buscoSinResultado && value.trim() && results.length === 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: 'var(--shadow)', marginTop: 4, padding: '10px 14px' }}>
          <span className="text-muted text-sm">Sin resultados. </span>
          <button type="button" className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowAlta(true)}>
            Crear producto «{value.trim()}»
          </button>
        </div>
      )}

      {showAlta && (
        <AltaExpressModal
          nombreInicial={value.trim()}
          onClose={() => setShowAlta(false)}
          onCreado={async (p) => {
            setShowAlta(false);
            await onAdd(p.id);
            setValue('');
            setResults([]);
            setBuscoSinResultado(false);
            inputRef.current?.focus();
          }}
        />
      )}

      {/* Dropdown similares (modo encendido) */}
      {modoSimilitud && value.trim() && similaresOrdenados.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: 'var(--shadow)', overflow: 'hidden', marginTop: 4 }}>
          {similaresOrdenados.map((s) => {
            const hayStock = s.stock_fisico > 0;
            return (
              <button
                key={s.producto_id}
                data-testid="similar-row"
                onClick={() => { if (hayStock) handleSelect(s.producto_id); }}
                disabled={!hayStock}
                title={hayStock ? 'Agregar a la venta' : 'Sin stock — referencia'}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'none', color: 'var(--ink)', cursor: hayStock ? 'pointer' : 'not-allowed', opacity: hayStock ? 1 : 0.5, borderBottom: '1px solid var(--line)', fontSize: 14 }}
              >
                <span style={{ fontWeight: 600, flex: 1 }}>{s.nombre_corto}</span>
                {s.marca_nombre && <span className="text-muted text-xs">{s.marca_nombre}</span>}
                <span className="num" style={{ minWidth: 90, textAlign: 'right' }}>$ {fmt(s.precio_final_centavos)}</span>
                <span className="num text-xs" style={{ minWidth: 60, textAlign: 'right', opacity: 0.8 }}>stock {s.stock_fisico}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
