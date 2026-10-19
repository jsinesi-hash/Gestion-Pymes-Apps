import { resolverPrecio } from '@ferreteria/shared';
import type { PosLine } from '../../hooks/usePosSession';

type Props = {
  lines: PosLine[];
  onCantidad: (productoId: string, cantidad: number) => void;
  onDescuentoLinea: (productoId: string, pct: number) => void;
  onRemove: (productoId: string) => void;
  onPresentacion?: (productoId: string, presentacionId: string, factorAStock: number, unidadAbreviatura: string) => void;
  canOverride: boolean;
};

function formatPeso(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PosItemsTable({ lines, onCantidad, onDescuentoLinea, onRemove, onPresentacion, canOverride }: Readonly<Props>) {
  if (lines.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '14vh' }}>
        <span className="text-muted">Sin productos — escanee o busque un artículo</span>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {(['Producto', 'Cant.', 'P. Unit.', canOverride ? 'Desc. %' : null, 'Subtotal', ''] as const)
              .filter(Boolean).map(h => (
                <th key={h as string}>{h}</th>
              ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => {
            const lr = resolverPrecio({
              lineas: [{ precioListaCentavos: line.precioListaCentavos, ajustePct: line.ajustePct, descuentoLineaPct: line.descuentoLineaPct, cantidad: line.cantidad }],
              descuentoGlobalPct: 0,
            });
            const precioUnit = lr.lineas[0].precioUnitarioCentavos / 100;
            const subtotal = lr.lineas[0].subtotalCentavos / 100;

            return (
              <tr key={line.producto_id}>
                <td className="p-name">
                  {line.descripcion}
                  {/* ADR-056 Lote 3: badges alineados a los tokens/clases del design system
                      (antes usaban tokens inexistentes --color-warning/--color-success). */}
                  {line.precioOrigen === 'fallback' && (
                    <span className="badge-warn" style={{ fontSize: 10, marginLeft: 6, padding: '1px 8px', verticalAlign: 'middle' }}>
                      sin confirmar
                    </span>
                  )}
                  {line.precioOrigen === 'promocion' && (
                    <span className="tag" style={{ fontSize: 10, marginLeft: 6, color: 'var(--ok)', borderColor: 'var(--ok)', verticalAlign: 'middle' }}>
                      en promo
                    </span>
                  )}
                  {line.unidad_abreviatura && (
                    <span className="tag num" style={{ fontSize: 10, marginLeft: 6, verticalAlign: 'middle' }}>
                      {line.unidad_abreviatura}{line.factor_a_stock !== 1.0 ? ` ×${line.factor_a_stock}` : ''}
                    </span>
                  )}
                  {line.presentaciones && line.presentaciones.length > 1 && onPresentacion && (
                    <div style={{ marginTop: 2 }}>
                      <select
                        value={line.presentacion_id ?? ''}
                        onChange={e => {
                          const pp = line.presentaciones?.find(p => p.id === e.target.value);
                          if (pp) onPresentacion(line.producto_id, pp.id, pp.factor_a_stock, pp.unidad_abreviatura);
                        }}
                        style={{ fontSize: 11, padding: '1px 4px', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer' }}
                      >
                        {line.presentaciones.map(pp => (
                          <option key={pp.id} value={pp.id}>
                            {pp.unidad_abreviatura}{pp.factor_a_stock !== 1.0 ? ` ×${pp.factor_a_stock}` : ''}
                            {pp.es_default ? ' (default)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </td>
                <td>
                  <div className="qty-box">
                    <button
                      aria-label="Disminuir cantidad"
                      onClick={() => onCantidad(line.producto_id, line.cantidad - (line.permite_fraccion ? 0.5 : 1))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, padding: '0 2px', color: 'var(--ink-2)' }}>−</button>
                    <input
                      type="number"
                      aria-label="Cantidad"
                      value={line.cantidad}
                      min={1}
                      step={line.permite_fraccion ? 0.5 : 1}
                      className="num"
                      style={{
                        width: 48,
                        textAlign: 'center',
                        border: 'none',
                        background: 'transparent',
                        appearance: 'textfield',
                        MozAppearance: 'textfield',
                        WebkitAppearance: 'none',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        color: 'inherit',
                        padding: 0,
                      }}
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') return;
                        let val = Number.parseFloat(raw);
                        if (Number.isNaN(val) || val <= 0) {
                          onCantidad(line.producto_id, 1);
                          return;
                        }
                        if (!line.permite_fraccion) {
                          val = Math.round(val);
                        }
                        if (val < 1) val = 1;
                        onCantidad(line.producto_id, val);
                      }}
                      onBlur={e => { e.target.value = String(line.cantidad); }}
                    />
                    <button
                      aria-label="Aumentar cantidad"
                      onClick={() => onCantidad(line.producto_id, line.cantidad + (line.permite_fraccion ? 0.5 : 1))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, padding: '0 2px', color: 'var(--ink-2)' }}>+</button>
                  </div>
                </td>
                <td><span className="num">$ {formatPeso(precioUnit)}</span></td>
                {canOverride && (
                  <td>
                    <input type="number" value={line.descuentoLineaPct} min={0} max={100}
                      aria-label={`Desc. % ${line.descripcion}`}
                      data-desc-ultima={idx === lines.length - 1 ? 'true' : undefined}
                      onChange={e => onDescuentoLinea(line.producto_id, Number.parseFloat(e.target.value) || 0)}
                      className="input num" style={{ width: 60 }}
                    />
                  </td>
                )}
                <td><span className="num font-bold">$ {formatPeso(subtotal)}</span></td>
                <td>
                  <div className="row-act">
                    <button className="ia del" onClick={() => onRemove(line.producto_id)} aria-label={`Quitar ${line.descripcion}`}>×</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
