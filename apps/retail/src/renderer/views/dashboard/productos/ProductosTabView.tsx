import { useEffect, useState, useRef } from 'react';
import type { Period } from '../hooks/usePeriod';
import type { AbcEntry, MargenCategoriaEntry } from '../../../../main/ipc/dashboard-rango';
import type { DashboardStock } from '../../../../main/ipc/dashboard';
import { StockPanel } from '../stock/StockPanel';
import { AbcResumen } from './AbcResumen';
import { MargenCategoriaChart } from './MargenCategoriaChart';

import { bridge } from '@core/ui';
type PS<T> = { loading: boolean; data: T | null; error: boolean };
const init = <T,>(): PS<T> => ({ loading: true, data: null, error: false });

type Props = { period: Period };

export function ProductosTabView({ period }: Props) {
  const [stock,     setStock]     = useState<PS<DashboardStock>>(init());
  const [abc,       setAbc]       = useState<PS<AbcEntry[]>>(init());
  const [margenCat, setMargenCat] = useState<PS<MargenCategoriaEntry[]>>(init());

  const stockLoaded = useRef(false);
  useEffect(() => {
    const f = bridge().dashboard;
    const { desde, hasta } = period;
    setAbc(init()); setMargenCat(init());

    if (!stockLoaded.current) {
      stockLoaded.current = true;
      f.stock().then((d: DashboardStock) => setStock({ loading: false, data: d, error: false }))
              .catch(() => setStock({ loading: false, data: null, error: true }));
    }

    Promise.allSettled([
      f.productosAbc({ desde, hasta }),
      f.productosMargenCategoria({ desde, hasta }),
    ]).then(([a, m]) => {
      setAbc      ({ loading: false, data: a.status === 'fulfilled' ? a.value : null, error: a.status === 'rejected' });
      setMargenCat({ loading: false, data: m.status === 'fulfilled' ? m.value : null, error: m.status === 'rejected' });
    });
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Stock alerts (existente, no depende del período) */}
      <StockPanel state={stock} />

      {/* ABC + Margen categoría en grid 2 columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.75rem' }}>CURVA ABC — {period.label}</div>
          {abc.loading && <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Cargando…</div>}
          {abc.error   && <div className="alert-danger">Error al cargar ABC</div>}
          {abc.data    && <AbcResumen data={abc.data} />}
        </div>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="text-muted text-xs" style={{ fontWeight: 700, marginBottom: '0.75rem' }}>MARGEN POR CATEGORÍA — {period.label}</div>
          {margenCat.loading && <div className="text-muted text-xs" style={{ opacity: 0.5 }}>Cargando…</div>}
          {margenCat.error   && <div className="alert-danger">Error al cargar margen</div>}
          {margenCat.data    && <MargenCategoriaChart data={margenCat.data} />}
        </div>
      </div>
    </div>
  );
}
