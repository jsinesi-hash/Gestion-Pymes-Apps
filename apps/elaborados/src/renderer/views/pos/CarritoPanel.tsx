import type { ReactNode } from 'react';
import { formatPesos } from '@core/ui';
import type { Cotizacion, LineaCarrito } from './tipos';

type Props = {
  lineas: LineaCarrito[];
  cotizacion: Cotizacion | null;
  cotizando: boolean;
  errorCotizacion: string | null;
  descuentoGlobalPct: number;
  onCantidad: (key: string, n: number) => void;
  onQuitar: (key: string) => void;
  onDescuentoLinea: (key: string, pct: number) => void;
  onDescuentoGlobal: (pct: number) => void;
  onCobrar: () => void;
  children?: ReactNode;
  puedeCobrar: boolean;
};

const num = (v: string) => (v === '' ? 0 : Number(v));

export function CarritoPanel(p: Props) {
  const { lineas, cotizacion: cot } = p;
  const bloqueos = cot?.bloqueos ?? [];
  const advertencias = cot?.advertencias ?? [];
  // La cotización es por posición: solo es confiable si cubre exactamente las líneas actuales.
  const cotAlineada = cot !== null && cot.lineas.length === lineas.length;
  const deshabilitado = !p.puedeCobrar || lineas.length === 0 || bloqueos.length > 0 || p.cotizando
    || p.errorCotizacion !== null || cot === null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {p.children}
      {lineas.length === 0 ? (
        <p>El carrito está vacío</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lineas.map((l, i) => (
            <div key={l.key} className="srow" style={{ alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{l.nombre}</div>
                {l.detalle && <div style={{ fontSize: 12, opacity: 0.7 }}>{l.detalle}</div>}
              </div>
              <button type="button" className="btn-secondary" aria-label="Menos" onClick={() => p.onCantidad(l.key, l.cantidad - 1)}>−</button>
              <span className="num">{l.cantidad}</span>
              <button type="button" className="btn-secondary" aria-label="Más" onClick={() => p.onCantidad(l.key, l.cantidad + 1)}>+</button>
              <input
                type="number" min={0} max={100} className="input" style={{ width: 64 }}
                aria-label="Descuento de línea" value={l.descuento_linea_pct}
                onChange={(e) => p.onDescuentoLinea(l.key, num(e.target.value))}
              />
              <span className="num" style={{ minWidth: 80, textAlign: 'right' }}>
                {cotAlineada && cot.lineas[i] ? formatPesos(cot.lineas[i].subtotal_centavos) : '—'}
              </span>
              <button type="button" className="btn-secondary" aria-label="Quitar" onClick={() => p.onQuitar(l.key)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {bloqueos.map((b) => (
        <div key={`b-${b.articulo_id}`} role="alert" style={{ color: 'var(--danger, #b3261e)' }}>
          Sin stock suficiente de {b.nombre}
        </div>
      ))}
      {advertencias.map((a) => (
        <div key={`a-${a.articulo_id}`} style={{ color: 'var(--warning, #a15c00)' }}>
          {a.nombre} quedará en negativo
        </div>
      ))}
      {p.errorCotizacion && <div role="alert" style={{ color: 'var(--danger, #b3261e)' }}>{p.errorCotizacion}</div>}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Descuento global %</span>
        <input
          type="number" min={0} max={100} className="input" style={{ width: 72 }}
          aria-label="Descuento global" value={p.descuentoGlobalPct}
          onChange={(e) => p.onDescuentoGlobal(num(e.target.value))}
        />
      </label>

      {cot && (
        <div>
          <div className="srow"><span className="sl">Subtotal</span><span className="sv num">{formatPesos(cot.subtotal_centavos)}</span></div>
          {cot.descuento_global_centavos > 0 && (
            <div className="srow"><span className="sl">Descuento global</span><span className="sv num">− {formatPesos(cot.descuento_global_centavos)}</span></div>
          )}
          {cot.ajuste_redondeo_centavos !== 0 && (
            <div className="srow"><span className="sl">Ajuste de redondeo</span><span className="sv num">{formatPesos(cot.ajuste_redondeo_centavos)}</span></div>
          )}
          <div className="srow total"><span className="sl">TOTAL</span><span className="sv num">{formatPesos(cot.total_centavos)}</span></div>
        </div>
      )}

      <button type="button" className="btn-primary" disabled={deshabilitado} onClick={p.onCobrar}>COBRAR</button>
    </div>
  );
}
