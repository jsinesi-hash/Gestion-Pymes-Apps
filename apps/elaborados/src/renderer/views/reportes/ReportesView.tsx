import { useState } from 'react';
import { ExportarButton } from '@core/ui';
import {
  useReporteVentasPeriodo, useReporteVentasProducto, useReporteStockAlertas, type Rango,
} from '../../hooks/useReporte';
import {
  exportVentasPeriodo, exportVentasMedio, exportVentasProducto, exportSabores, exportStockAlertas,
} from '../../../common/export-reportes';

const pesos = (centavos: number) => `$${(centavos / 100).toFixed(2)}`;
const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
  cuenta_corriente: 'Cuenta corriente', cheque: 'Cheque',
};

const pad = (n: number) => String(n).padStart(2, '0');
const aDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rangoInicial = (): Rango => {
  const hoy = new Date();
  return { desde: aDia(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: aDia(hoy) };
};

type Pestana = 'ventas' | 'productos' | 'stock';

export function ReportesView() {
  const [pestana, setPestana] = useState<Pestana>('ventas');
  const [rango, setRango] = useState<Rango>(rangoInicial);
  const rangoValido = !!rango.desde && !!rango.hasta && rango.desde <= rango.hasta;

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar" role="tablist" aria-label="Reportes">
        {([['ventas', 'Ventas'], ['productos', 'Productos y sabores'], ['stock', 'Stock']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={pestana === k}
            className={pestana === k ? 'btn-primary' : 'btn-secondary'} onClick={() => setPestana(k)}>{label}</button>
        ))}
        <div className="ml-auto" />
        {pestana !== 'stock' && (
          <>
            <label htmlFor="rep-desde">Desde</label>
            <input id="rep-desde" className="input" type="date" value={rango.desde}
              onChange={(e) => setRango((r) => ({ ...r, desde: e.target.value }))} />
            <label htmlFor="rep-hasta">Hasta</label>
            <input id="rep-hasta" className="input" type="date" value={rango.hasta}
              onChange={(e) => setRango((r) => ({ ...r, hasta: e.target.value }))} />
          </>
        )}
      </div>

      {pestana !== 'stock' && !rangoValido && (
        <div className="alert-danger" role="alert">Elegí un período válido: «Desde» no puede ser posterior a «Hasta».</div>
      )}
      {pestana === 'ventas' && rangoValido && <VentasTab rango={rango} />}
      {pestana === 'productos' && rangoValido && <ProductosTab rango={rango} />}
      {pestana === 'stock' && <StockTab />}
    </div>
  );
}

function Estado({ cargando, error }: { cargando: boolean; error: string | null }) {
  if (error) return <div className="alert-danger" role="alert">{error}</div>;
  if (cargando) return <div style={{ padding: '1rem', opacity: 0.5 }}>Cargando...</div>;
  return null;
}

function VentasTab({ rango }: { rango: Rango }) {
  const { datos, cargando, error } = useReporteVentasPeriodo(rango);
  const filtros = { ...rango };
  const r = datos?.resumen;
  const margenPct = r && r.neto_centavos > 0 ? (r.margen_centavos / r.neto_centavos) * 100 : 0;
  return (
    <div>
      <div className="toolbar">
        <div className="ml-auto" />
        <ExportarButton definicion={exportVentasPeriodo} filtrosActivos={filtros} />
        <ExportarButton definicion={exportVentasMedio} filtrosActivos={filtros} />
      </div>
      <Estado cargando={cargando} error={error} />
      {datos && r && (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '0.5rem 0 1rem' }}>
            <Kpi label="Ventas" valor={String(r.cantidad)} />
            <Kpi label="Total" valor={pesos(r.total_centavos)} />
            <Kpi label="Neto (sin IVA)" valor={pesos(r.neto_centavos)} />
            <Kpi label="Costo" valor={pesos(r.costo_centavos)} />
            <Kpi label="Margen" valor={`${pesos(r.margen_centavos)} (${margenPct.toFixed(1)}%)`} />
          </div>
          <div className="table-wrap">
            <table aria-label="Ventas por día">
              <thead><tr><th>Día</th><th className="c">Ventas</th><th className="c">Total</th><th className="c">Costo</th><th className="c">Margen</th></tr></thead>
              <tbody>
                {datos.por_dia.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin ventas en el período</td></tr>
                )}
                {datos.por_dia.map((d) => (
                  <tr key={d.dia}>
                    <td>{d.dia}</td><td className="c">{d.cantidad}</td><td className="c">{pesos(d.total_centavos)}</td>
                    <td className="c">{pesos(d.costo_centavos)}</td><td className="c">{pesos(d.margen_centavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table aria-label="Ventas por medio de pago">
              <thead><tr><th>Medio de pago</th><th className="c">Monto</th></tr></thead>
              <tbody>
                {datos.por_medio.map((m) => (
                  <tr key={m.medio_pago}><td>{MEDIOS[m.medio_pago] ?? m.medio_pago}</td><td className="c">{pesos(m.monto_centavos)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="kv" style={{ minWidth: '9rem' }}>
      <span className="k">{label}</span><span className="v" style={{ fontWeight: 600 }}>{valor}</span>
    </div>
  );
}

function ProductosTab({ rango }: { rango: Rango }) {
  const { datos, cargando, error } = useReporteVentasProducto(rango);
  const filtros = { ...rango };
  return (
    <div>
      <div className="toolbar">
        <div className="ml-auto" />
        <ExportarButton definicion={exportVentasProducto} filtrosActivos={filtros} />
        <ExportarButton definicion={exportSabores} filtrosActivos={filtros} />
      </div>
      <Estado cargando={cargando} error={error} />
      {datos && (
        <>
          <div className="table-wrap">
            <table aria-label="Ventas por producto">
              <thead><tr><th>Producto</th><th className="c">Unidades</th><th className="c">Importe</th></tr></thead>
              <tbody>
                {datos.productos.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin ventas en el período</td></tr>
                )}
                {datos.productos.map((p) => (
                  <tr key={p.producto_venta_id}><td>{p.descripcion}</td><td className="c">{p.unidades}</td><td className="c">{pesos(p.importe_centavos)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table aria-label="Sabores más pedidos">
              <thead><tr><th>Sabor</th><th className="c">Veces pedido</th><th className="c">Consumo</th></tr></thead>
              <tbody>
                {datos.sabores.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin sabores en el período</td></tr>
                )}
                {datos.sabores.map((s) => (
                  <tr key={s.descripcion}><td>{s.descripcion}</td><td className="c">{s.veces}</td><td className="c">{s.consumo}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StockTab() {
  const { datos, cargando, error } = useReporteStockAlertas();
  return (
    <div>
      <div className="toolbar">
        <div className="ml-auto" />
        <ExportarButton definicion={exportStockAlertas} />
      </div>
      <Estado cargando={cargando} error={error} />
      {datos && (
        <div className="table-wrap">
          <table aria-label="Alertas de stock">
            <thead><tr><th>Artículo</th><th className="c">Stock</th><th className="c">Mínimo</th><th className="c">Estado</th></tr></thead>
            <tbody>
              {datos.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin alertas de stock</td></tr>
              )}
              {datos.map((f) => (
                <tr key={f.articulo_id}>
                  <td>{f.nombre}</td>
                  <td className="c">{f.stock} {f.unidad}</td>
                  <td className="c">{f.stock_minimo ?? '—'}</td>
                  <td className="c">
                    <span className={`badge ${f.estado === 'negativo' ? 'off' : 'warn'}`}>
                      <span className="bd" />{f.estado === 'negativo' ? 'Negativo' : 'Bajo mínimo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
