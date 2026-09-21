import { useSearchParams } from 'react-router-dom';
import { ColaRevisionCostosView } from './ColaRevisionCostosView';
import { HistorialImportacionCostosView } from './HistorialImportacionCostosView';
import { HistorialCatalogosView } from './HistorialCatalogosView';

// ADR-054: pantalla unificada de 3 tabs (Revisión · Costos · Catálogos), Costos por
// default. Supersede parcialmente a ADR-051 (que dejó la Cola de Revisión como pantalla
// separada): la Cola se reubica acá como tab, SIN cambiar su semántica. El tab activo
// vive en el query param ?tab= (deep-linkable).
type Tab = 'revision' | 'costos' | 'catalogos';

// ADR-056 Lote 4: etiquetas renombradas (las claves internas y el deep-link ?tab= no
// cambian).
const TABS: { key: Tab; label: string }[] = [
  { key: 'revision', label: 'Revisión Costos' },
  { key: 'costos', label: 'Historial de Costos' },
  { key: 'catalogos', label: 'Historial de Catálogo' },
];

export function RevisionHistorialView() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'revision' || raw === 'catalogos' ? raw : 'costos';
  const setTab = (t: Tab) => setParams(t === 'costos' ? {} : { tab: t }, { replace: true });

  return (
    <div className="flex-col gap-4" style={{ height: '100%' }}>
      <div className="panel" role="tablist" aria-label="Revisión e Historial"
        style={{ flexDirection: 'row', gap: 4, flexShrink: 0, padding: 6, alignItems: 'center' }}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key} type="button" role="tab" aria-selected={active}
              onClick={() => setTab(t.key)}
              className={active ? 'btn-primary' : 'btn-secondary'}
              style={{ fontSize: 13, fontWeight: 700, padding: '7px 16px' }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'revision' && <ColaRevisionCostosView />}
      {tab === 'costos' && <HistorialImportacionCostosView onVerPendientes={() => setTab('revision')} />}
      {tab === 'catalogos' && <HistorialCatalogosView />}
    </div>
  );
}
