import { useEffect } from 'react';

type Props = {
  totales: {
    subtotalCentavos: number;
    descuentoGlobalCentavos: number;
    totalCentavos: number;
    ajusteRedondeoCentavos: number;
  } | null;
  descuentoGlobalPct: number;
  onDescuentoGlobal: (pct: number) => void;
  canOverride: boolean;
  loading: boolean;
  linesCount: number;
  error: string | null;
  onClearError: () => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  cantidadEnEspera: number;
  onEspera: () => void;
  onAbrirEspera: () => void;
};

function fmt(centavos: number) {
  return (centavos / 100).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function errorMsg(e: string) {
  if (e === 'STOCK_INSUFICIENTE') return 'Sin stock suficiente';
  if (e === 'PRODUCTO_INACTIVO') return 'Producto inactivo';
  return e;
}

export function PosBottomBar({
  totales,
  descuentoGlobalPct,
  onDescuentoGlobal,
  canOverride,
  loading,
  linesCount,
  error,
  onClearError,
  onConfirmar,
  onCancelar,
  cantidadEnEspera,
  onEspera,
  onAbrirEspera,
}: Readonly<Props>) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'F9' && !loading && linesCount > 0) { e.preventDefault(); onEspera(); }
      if (e.key === 'F8' && cantidadEnEspera > 0) { e.preventDefault(); onAbrirEspera(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [loading, linesCount, onEspera, onAbrirEspera]);

  return (
    <div
      style={{
        borderTop: '1px solid var(--line)',
        background: 'var(--surface)',
        padding: '10px var(--pad)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {error && (
        <div
          className="alert-danger"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          {errorMsg(error)}
          <button
            type="button"
            onClick={onClearError}
            aria-label="✕"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {canOverride && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span className="text-muted">Desc. global %</span>
            <input
              type="number"
              value={descuentoGlobalPct}
              min={0}
              max={100}
              aria-label="Desc. global %"
              onChange={(e) => onDescuentoGlobal(Number.parseFloat(e.target.value) || 0)}
              className="input num"
              style={{ width: 64 }}
            />
          </label>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={onAbrirEspera}
            disabled={cantidadEnEspera === 0}
            className="btn-secondary"
            style={{ position: 'relative', fontSize: 13 }}
            title="Ventas en espera (F8)"
          >
            Ventas en espera
            {cantidadEnEspera > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: 'var(--accent)', color: '#fff',
                borderRadius: '50%', width: 18, height: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>
                {cantidadEnEspera}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onEspera}
            disabled={loading || linesCount === 0}
            className="btn-secondary"
            style={{ fontSize: 13 }}
            title="Poner en espera (F9)"
          >
            ⏸ Espera
          </button>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Total
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
            $ {totales ? fmt(totales.totalCentavos) : '0,00'}
          </div>
          {totales && totales.ajusteRedondeoCentavos !== 0 && (
            <div className="text-muted" style={{ fontSize: 11 }}>
              Redondeo: {totales.ajusteRedondeoCentavos > 0 ? '+' : ''}${' '}
              {fmt(totales.ajusteRedondeoCentavos)}
            </div>
          )}
        </div>
        {/* ADR-056 Lote 2: Cancelar vuelve el cart a cero (con confirmación en PosView, para
            no borrar por accidente). No registra nada. */}
        <button
          type="button"
          onClick={onCancelar}
          disabled={loading || linesCount === 0}
          className="btn-secondary"
          style={{ padding: '14px 22px', fontSize: 15, justifyContent: 'center' }}
        >
          Cancelar
        </button>
        {/* ADR-056 Lote 2: "Confirmar" consolida el antiguo "ACEPTAR" — dispara el flujo de
            confirmación de venta existente (ConfirmarVentaModal). No se duplica. */}
        <button
          type="button"
          onClick={onConfirmar}
          disabled={loading || linesCount === 0}
          className="btn-primary"
          style={{
            padding: '14px 28px',
            fontSize: 16,
            justifyContent: 'center',
            ...(linesCount === 0 ? { background: 'var(--line)', boxShadow: 'none' } : {}),
          }}
        >
          {loading ? 'Procesando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  );
}
