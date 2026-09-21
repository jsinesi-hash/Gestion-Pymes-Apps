import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { VentasPanel } from './ventas/VentasPanel';
import { StockPanel } from './stock/StockPanel';
import { CajaPanel } from './caja/CajaPanel';
import { VentasTabView } from './ventas/VentasTabView';
import { ProductosTabView } from './productos/ProductosTabView';
import { CajaTabView } from './caja/CajaTabView';
import { ClientesTabView } from './clientes/ClientesTabView';
import { ProveedoresTabView } from './proveedores/ProveedoresTabView';
import { PeriodSelector } from './components/PeriodSelector';
import { usePeriod } from './hooks/usePeriod';
import { VistosRecientesPanel } from '../../components/VistosRecientesPanel';
import type { DashboardVentas, DashboardStock, DashboardCaja } from '../../../main/ipc/dashboard';

type TabId = 'resumen' | 'ventas' | 'productos' | 'caja' | 'clientes' | 'proveedores';

const TABS: { id: TabId; label: string }[] = [
  { id: 'resumen',     label: 'Resumen' },
  { id: 'ventas',      label: 'Ventas' },
  { id: 'productos',   label: 'Productos' },
  { id: 'caja',        label: 'Caja' },
  { id: 'clientes',    label: 'Clientes' },
  { id: 'proveedores', label: 'Proveedores' },
];

type PS<T> = { loading: boolean; data: T | null; error: boolean };
const init = <T,>(): PS<T> => ({ loading: true, data: null, error: false });

export function DashboardView() {
  const { can } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('resumen');

  const [ventas, setVentas] = useState<PS<DashboardVentas>>(init());
  const [stock,  setStock]  = useState<PS<DashboardStock>>(init());
  const [caja,   setCaja]   = useState<PS<DashboardCaja>>(init());
  const resumenLoaded = useRef(false);

  const { period, key: periodKey, setKey: setPeriodKey, customFrom, customTo, setCustomFrom, setCustomTo } = usePeriod('mes');

  useEffect(() => {
    if (!can('dashboard.ver')) return;
    if (activeTab !== 'resumen' || resumenLoaded.current) return;
    resumenLoaded.current = true;
    const f = (window as any).ferreteria.dashboard;
    Promise.allSettled([f.ventas(), f.stock(), f.caja()]).then(([v, s, c]) => {
      setVentas({ loading: false, data: v.status === 'fulfilled' ? v.value : null, error: v.status === 'rejected' });
      setStock ({ loading: false, data: s.status === 'fulfilled' ? s.value : null, error: s.status === 'rejected' });
      setCaja  ({ loading: false, data: c.status === 'fulfilled' ? c.value : null, error: c.status === 'rejected' });
    });
  }, [activeTab, can]);

  if (!can('dashboard.ver')) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p className="font-bold">Sin acceso</p>
        <p className="text-muted" style={{ marginTop: '0.5rem' }}>Esta vista requiere rol Supervisor.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.75rem 1.5rem 0', borderBottom: '1px solid var(--line)', flexShrink: 0, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '6px 6px 0 0',
              border: '1px solid var(--line)',
              borderBottom: activeTab === tab.id ? '1px solid var(--surface)' : '1px solid var(--line)',
              background: activeTab === tab.id ? 'var(--surface)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent-strong)' : 'inherit',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              marginBottom: -1,
              position: 'relative',
              zIndex: activeTab === tab.id ? 1 : 0,
            }}
          >
            {tab.label}
          </button>
        ))}

        {/* Selector de período (Ventas, Productos, Caja, Clientes y Proveedores) */}
        {(activeTab === 'ventas' || activeTab === 'productos' || activeTab === 'caja' || activeTab === 'clientes' || activeTab === 'proveedores') && (
          <div style={{ marginLeft: 'auto', paddingBottom: '0.4rem' }}>
            <PeriodSelector
              active={periodKey}
              onChange={setPeriodKey}
              customFrom={customFrom}
              customTo={customTo}
              onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
            />
          </div>
        )}
      </div>

      {/* Contenido del tab activo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
        {activeTab === 'resumen' && (
          <div className="flex-col gap-4">
            <VistosRecientesPanel />
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1rem' }}>
              <VentasPanel state={ventas} />
              <div className="flex-col gap-4" style={{ minWidth: 0 }}>
                <StockPanel state={stock} />
                <CajaPanel  state={caja} />
              </div>
            </div>
          </div>
        )}
        {activeTab === 'ventas'      && <VentasTabView      period={period} />}
        {activeTab === 'productos'   && <ProductosTabView   period={period} />}
        {activeTab === 'caja'        && <CajaTabView        period={period} />}
        {activeTab === 'clientes'    && <ClientesTabView    period={period} />}
        {activeTab === 'proveedores' && <ProveedoresTabView period={period} />}
      </div>
    </div>
  );
}
