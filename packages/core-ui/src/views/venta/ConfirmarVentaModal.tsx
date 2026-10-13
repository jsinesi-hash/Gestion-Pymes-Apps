import { useState, useRef } from 'react';
import type { MedioPago, VentaPagoPayload } from './tipos';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

type PagoRow = {
  key: string;
  medio_pago: MedioPago;
  montoStr: string;
  recargoPct: number;
  numeroCheque?: string;
  banco?: string;
  fechaCheque?: string;
  titularCheque?: string;
};

type Totales = {
  totalCentavos: number;
};

type Props = {
  totales: Totales;
  formaPagoDefault: MedioPago;
  habilitaCcc: boolean;
  loading: boolean;
  onConfirmar: (pagos: VentaPagoPayload[], vuelto: number | null) => void;
  onVolver: () => void;
};

const MEDIOS: { value: MedioPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cuenta_corriente', label: 'Cta. Corriente' },
  { value: 'cheque', label: 'Cheque' },
];

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ConfirmarVentaModal({
  totales, formaPagoDefault, habilitaCcc, loading, onConfirmar, onVolver,
}: Readonly<Props>) {
  const keyRef = useRef(0);
  function nextKey() { return String(++keyRef.current); }

  const [rows, setRows] = useState<PagoRow[]>([
    { key: nextKey(), medio_pago: formaPagoDefault, montoStr: '', recargoPct: 0 },
  ]);

  useEscapeToClose(onVolver, !loading);

  const totalCentavos = totales.totalCentavos;

  function parseMonto(str: string): number {
    const n = Number.parseFloat(str.replace(',', '.'));
    return Number.isNaN(n) ? 0 : Math.round(n * 100);
  }

  const pagoTotalCentavos = rows.reduce((s, r) => s + parseMonto(r.montoStr), 0);
  const saldoPendienteCentavos = totalCentavos - pagoTotalCentavos;

  const efectivoMonto = rows
    .filter(r => r.medio_pago === 'efectivo')
    .reduce((s, r) => s + parseMonto(r.montoStr), 0);
  const otrosMonto = rows
    .filter(r => r.medio_pago !== 'efectivo')
    .reduce((s, r) => s + parseMonto(r.montoStr), 0);
  const necesarioEfectivo = Math.max(0, totalCentavos - otrosMonto);
  const vueltoCentavos = efectivoMonto > 0
    ? Math.max(0, efectivoMonto - necesarioEfectivo)
    : 0;
  const vueltoRedondeado = Math.round(vueltoCentavos / 100) * 100;

  const mediosDisponibles = habilitaCcc ? MEDIOS : MEDIOS.filter(m => m.value !== 'cuenta_corriente');

  // Un medio no puede repetirse (backend: MEDIO_PAGO_DUPLICADO): las opciones de cada fila
  // excluyen los medios ya usados por las demás filas, y sólo se puede agregar otra fila si
  // queda algún medio libre.
  function mediosLibresPara(key: string) {
    const usadosPorOtras = new Set(rows.filter(r => r.key !== key).map(r => r.medio_pago));
    return mediosDisponibles.filter(m => !usadosPorOtras.has(m.value));
  }
  const hayMedioLibre = mediosDisponibles.some(m => !rows.some(r => r.medio_pago === m.value));

  function addRow() {
    setRows(prev => {
      const usados = new Set(prev.map(r => r.medio_pago));
      const libre = mediosDisponibles.find(m => !usados.has(m.value));
      if (!libre) return prev;
      return [...prev, { key: nextKey(), medio_pago: libre.value, montoStr: '', recargoPct: 0 }];
    });
  }

  function removeRow(key: string) {
    setRows(prev => prev.filter(r => r.key !== key));
  }

  function updateRow(key: string, patch: Partial<PagoRow>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  }

  function handleConfirmar() {
    const pagos: VentaPagoPayload[] = rows.map(r => {
      const monto = parseMonto(r.montoStr);
      const recargo = r.medio_pago === 'tarjeta' && r.recargoPct > 0
        ? Math.round(monto * r.recargoPct / 100)
        : 0;
      const payload: VentaPagoPayload = {
        medio_pago: r.medio_pago,
        monto_centavos: monto,
        recargo_pct: r.recargoPct,
        recargo_centavos: recargo,
      };
      if (r.medio_pago === 'cheque') {
        if (r.numeroCheque) payload.numero_cheque = r.numeroCheque;
        if (r.banco) payload.banco = r.banco;
        if (r.fechaCheque) payload.fecha_cheque = r.fechaCheque;
        if (r.titularCheque) payload.titular_cheque = r.titularCheque;
      }
      return payload;
    });
    onConfirmar(pagos, vueltoRedondeado > 0 ? vueltoRedondeado : null);
  }

  const confirmDisabled = loading || saldoPendienteCentavos > 0;
  const hasAnyMonto = rows.some(r => r.montoStr !== '' && parseMonto(r.montoStr) > 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div className="panel" style={{ width: 460, maxWidth: '95vw', padding: 24 }}>
        <h3 style={{ margin: '0 0 16px' }}>Confirmar venta</h3>

        <div className="srow total" style={{ marginBottom: 16 }}>
          <span className="sl">Total productos</span>
          <span className="sv num" style={{ color: 'var(--accent)', fontWeight: 700 }}>
            $ {fmt(totalCentavos)}
          </span>
        </div>

        {rows.map((row, idx) => {
          const recargoCentavos = row.medio_pago === 'tarjeta' && row.recargoPct > 0
            ? Math.round(parseMonto(row.montoStr) * row.recargoPct / 100)
            : 0;

          return (
            <div key={row.key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: '0 0 140px' }}>
                  {idx === 0 && <div style={{ fontSize: 11, marginBottom: 4, color: 'var(--ink-3)' }}>Medio</div>}
                  <select
                    value={row.medio_pago}
                    onChange={e => updateRow(row.key, { medio_pago: e.target.value as MedioPago })}
                    className="input"
                    style={{ width: '100%' }}
                  >
                    {mediosLibresPara(row.key).map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  {idx === 0 && <div style={{ fontSize: 11, marginBottom: 4, color: 'var(--ink-3)' }}>Monto</div>}
                  <input
                    aria-label="Monto"
                    type="number"
                    min={0}
                    step={1}
                    value={row.montoStr}
                    onChange={e => updateRow(row.key, { montoStr: e.target.value })}
                    className="input num"
                    style={{ width: '100%' }}
                  />
                </div>
                {row.medio_pago === 'tarjeta' && (
                  <div style={{ flex: '0 0 80px' }}>
                    {idx === 0 && <div style={{ fontSize: 11, marginBottom: 4, color: 'var(--ink-3)' }}>Recargo %</div>}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={row.recargoPct}
                      onChange={e => updateRow(row.key, { recargoPct: Number.parseFloat(e.target.value) || 0 })}
                      className="input num"
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                {row.medio_pago === 'tarjeta' && recargoCentavos > 0 && (
                  <div style={{ flex: '0 0 auto', fontSize: 12, color: 'var(--ink-2)', paddingBottom: 8 }}>
                    +$ {fmt(recargoCentavos)}
                  </div>
                )}
                {rows.length > 1 && (
                  <button
                    type="button"
                    aria-label="Quitar"
                    onClick={() => removeRow(row.key)}
                    className="ia del"
                    style={{ marginBottom: 0 }}
                  >×</button>
                )}
              </div>
              {row.medio_pago === 'cheque' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <div style={{ flex: '0 0 120px' }}>
                    <div style={{ fontSize: 11, marginBottom: 4, color: 'var(--ink-3)' }}>N° Cheque</div>
                    <input
                      aria-label="N° Cheque"
                      type="text"
                      value={row.numeroCheque ?? ''}
                      onChange={e => updateRow(row.key, { numeroCheque: e.target.value })}
                      className="input"
                      style={{ width: '100%' }}
                      placeholder="000000"
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 11, marginBottom: 4, color: 'var(--ink-3)' }}>Banco</div>
                    <input
                      aria-label="Banco"
                      type="text"
                      value={row.banco ?? ''}
                      onChange={e => updateRow(row.key, { banco: e.target.value })}
                      className="input"
                      style={{ width: '100%' }}
                      placeholder="Nombre del banco"
                    />
                  </div>
                  <div style={{ flex: '0 0 130px' }}>
                    <div style={{ fontSize: 11, marginBottom: 4, color: 'var(--ink-3)' }}>Fecha cheque</div>
                    <input
                      aria-label="Fecha cheque"
                      type="date"
                      value={row.fechaCheque ?? ''}
                      onChange={e => updateRow(row.key, { fechaCheque: e.target.value })}
                      className="input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 11, marginBottom: 4, color: 'var(--ink-3)' }}>Titular</div>
                    <input
                      aria-label="Titular"
                      type="text"
                      value={row.titularCheque ?? ''}
                      onChange={e => updateRow(row.key, { titularCheque: e.target.value })}
                      className="input"
                      style={{ width: '100%' }}
                      placeholder="Nombre del titular"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          aria-label="Agregar medio"
          onClick={addRow}
          disabled={!hayMedioLibre}
          style={{ fontSize: 13, background: 'none', border: '1px dashed var(--line)', borderRadius: 8, padding: '6px 12px', cursor: hayMedioLibre ? 'pointer' : 'not-allowed', color: 'var(--ink-2)', marginBottom: 16, opacity: hayMedioLibre ? 1 : 0.5 }}
        >
          + Agregar medio de pago
        </button>

        {hasAnyMonto && saldoPendienteCentavos > 0 && (
          <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>
            Saldo pendiente: $ {fmt(saldoPendienteCentavos)}
          </div>
        )}

        {vueltoRedondeado > 0 && (
          <div style={{ color: 'var(--ok)', fontWeight: 600, marginBottom: 8 }}>
            Vuelto: $ {fmt(vueltoRedondeado)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn-secondary" onClick={onVolver} disabled={loading}>
            Volver
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirmar}
            disabled={confirmDisabled}
            style={{ justifyContent: 'center' }}
          >
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
