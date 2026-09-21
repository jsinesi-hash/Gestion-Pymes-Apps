import { useState, useEffect, useCallback } from 'react';
import { useCallIpc } from '../../hooks/useCallIpc';

type FeatureFlagInfo = { clave: string; valor: string; descripcion: string | null };

// ADR-061: pantalla de administración de feature flags. Auto-descubre lo que devuelve
// `parametros.listFlags()` — no hardcodea la lista de flags, así que un flag nuevo
// aparece acá sin tocar este archivo. Solo Supervisor (gateado por `config.fiscal`,
// igual que el backend).
export function FuncionalidadesView() {
  const callIpc = useCallIpc();
  const [flags, setFlags] = useState<FeatureFlagInfo[] | null>(null);

  const cargar = useCallback(async () => {
    const lista = await (globalThis as any).ferreteria.parametros.listFlags();
    setFlags(lista);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function toggle(flag: FeatureFlagInfo) {
    const nuevo = flag.valor === 'true' ? 'false' : 'true';
    const res = await callIpc(
      () => (globalThis as any).ferreteria.parametros.set({ clave: flag.clave, valor: nuevo }),
      { success: 'Funcionalidad actualizada.' },
    );
    if (!res.ok) return;
    setFlags(prev => prev?.map(f => f.clave === flag.clave ? { ...f, valor: nuevo } : f) ?? prev);
  }

  return (
    <div className="flex-col gap-4" style={{ maxWidth: 720 }}>
      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Funcionalidades</h2>

      <div className="card">
        <div className="card-title">Módulos y funciones</div>
        <div className="modal-body">
          <p className="text-sm text-muted" style={{ marginBottom: 8, lineHeight: 1.5 }}>
            Prendé o apagá funcionalidades del sistema. Los cambios se aplican al instante
            para todos los usuarios de esta terminal.
          </p>

          {flags === null && <p className="text-sm text-muted">Cargando…</p>}
          {flags !== null && flags.length === 0 && (
            <p className="text-sm text-muted">No hay funcionalidades para administrar.</p>
          )}
          {flags !== null && flags.length > 0 && (
            <div className="flex-col gap-3">
              {flags.map(flag => {
                const id = `func-${flag.clave}`;
                return (
                  <div
                    key={flag.clave}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={flag.valor === 'true'}
                      onChange={() => toggle(flag)}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label htmlFor={id} style={{ cursor: 'pointer' }}>{flag.descripcion ?? flag.clave}</label>
                      <span className="text-xs text-muted">{flag.clave}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
