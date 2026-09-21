import { useEffect, useMemo, useState } from 'react';
import { etiquetaPermiso } from '@ferreteria/shared';

// ADR-087 (PERF-3 opción A): matriz RBAC de solo lectura. Muestra roles × permisos leyendo
// `permiso:matriz` del main. Los permisos se administran desde código (seed); esta pantalla
// sólo los exhibe con nombres amigables (`etiquetaPermiso`). No edita.

type Rol = { id: string; nombre: string };
type Permiso = { codigo: string; descripcion: string | null; modulo: string | null };
type Matriz = { roles: Rol[]; permisos: Permiso[]; porRol: Record<string, string[]> };

export function RolesPermisosView() {
  const [data, setData] = useState<Matriz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const m = await (window as any).ferreteria.permisos.matriz();
        if (vivo) setData(m);
      } catch (e: any) {
        if (vivo) setError(e?.message ?? 'No se pudo cargar la matriz de permisos.');
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // Set de códigos por rol para lookup O(1).
  const setsPorRol = useMemo(() => {
    const out: Record<string, Set<string>> = {};
    if (data) for (const r of data.roles) out[r.id] = new Set(data.porRol[r.id] ?? []);
    return out;
  }, [data]);

  // Permisos agrupados por módulo, preservando el orden que llega del main.
  const grupos = useMemo(() => {
    const out: { modulo: string; permisos: Permiso[] }[] = [];
    if (!data) return out;
    for (const p of data.permisos) {
      const modulo = p.modulo ?? 'otros';
      let g = out.find(x => x.modulo === modulo);
      if (!g) { g = { modulo, permisos: [] }; out.push(g); }
      g.permisos.push(p);
    }
    return out;
  }, [data]);

  return (
    <div className="flex-col gap-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Roles y permisos</h2>
        <span className="badge off" title="Los permisos se administran desde el código (seed)">
          <span className="bd" />Solo lectura
        </span>
      </div>

      {error && <div className="alert-danger" role="alert">{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando…</div>
      ) : data && (
        <>
          <div className="row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {data.roles.map(r => (
              <div key={r.id} className="panel" style={{ padding: '0.6rem 0.9rem' }}>
                <div className="text-muted text-sm">{r.nombre}</div>
                <div className="num" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                  {setsPorRol[r.id]?.size ?? 0}
                  <span className="text-muted text-sm" style={{ fontWeight: 400 }}> / {data.permisos.length} permisos</span>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Puede…</th>
                    {data.roles.map(r => <th key={r.id} className="c">{r.nombre}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(g => (
                    <FragmentoModulo
                      key={g.modulo}
                      modulo={g.modulo}
                      permisos={g.permisos}
                      roles={data.roles}
                      setsPorRol={setsPorRol}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-muted text-sm" style={{ margin: 0 }}>
            Los permisos se administran desde el código (seed). Esta pantalla los muestra en vivo
            desde <span className="num">rol_permiso</span>.
          </p>
        </>
      )}
    </div>
  );
}

function FragmentoModulo({ modulo, permisos, roles, setsPorRol }: Readonly<{
  modulo: string; permisos: Permiso[]; roles: Rol[]; setsPorRol: Record<string, Set<string>>;
}>) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} className="text-muted text-sm"
          style={{ textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>
          {modulo}
        </td>
      </tr>
      {permisos.map(p => (
        <tr key={p.codigo}>
          <td title={p.codigo}>{etiquetaPermiso(p.codigo)}</td>
          {roles.map(r => {
            const tiene = setsPorRol[r.id]?.has(p.codigo);
            return (
              <td key={r.id} className="c" aria-label={tiene ? 'permitido' : 'no permitido'}>
                {tiene
                  ? <span style={{ color: 'var(--ok, #2e7d52)', fontWeight: 700 }}>✓</span>
                  : <span className="text-muted">—</span>}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
