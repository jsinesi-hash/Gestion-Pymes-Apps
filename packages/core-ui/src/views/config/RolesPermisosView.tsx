import { bridge } from '../../bridge';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { etiquetaPermiso } from '@ferreteria/shared';
import { useAuth } from '../../auth/AuthContext';
import { traducirError } from '../../lib/errores';

// ADR-087 + ADR-147 (PERF-3 opción B): matriz roles × permisos editable. Cada casilla es un
// permiso de un rol; los cambios quedan pendientes hasta «Guardar cambios», que manda el conjunto
// completo de cada rol modificado a `permiso:actualizarRol`. El main valida las guardas (no dejar el
// sistema sin administrador) y registra cada cambio para que el seed no lo deshaga al reiniciar.

type Rol = { id: string; nombre: string };
type Permiso = { codigo: string; descripcion: string | null; modulo: string | null };
type Matriz = { roles: Rol[]; permisos: Permiso[]; porRol: Record<string, string[]> };
type Asignaciones = Record<string, Set<string>>;

const ADMINISTRAR = 'usuario.administrar';
const MOTIVO_PROPIO = 'No podés quitarle este permiso a tu propio rol: perderías el acceso a esta pantalla.';

function aSets(m: Matriz): Asignaciones {
  const out: Asignaciones = {};
  for (const r of m.roles) out[r.id] = new Set(m.porRol[r.id] ?? []);
  return out;
}

function diferencias(a: Asignaciones, b: Asignaciones): number {
  let n = 0;
  for (const rolId of Object.keys(a)) {
    const x = a[rolId] ?? new Set<string>(); const y = b[rolId] ?? new Set<string>();
    for (const c of x) if (!y.has(c)) n++;
    for (const c of y) if (!x.has(c)) n++;
  }
  return n;
}

export function RolesPermisosView() {
  const { session, actualizarSesion } = useAuth();
  const [data, setData] = useState<Matriz | null>(null);
  const [guardado, setGuardado] = useState<Asignaciones>({});
  const [actual, setActual] = useState<Asignaciones>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const m: Matriz = await bridge().permisos.matriz();
    setData(m);
    setGuardado(aSets(m));
    setActual(aSets(m));
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try { await cargar(); } catch (e) {
        if (vivo) setError(traducirError(e).mensaje);
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => { vivo = false; };
  }, [cargar]);

  const cambios = useMemo(() => diferencias(guardado, actual), [guardado, actual]);

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

  function alternar(rolId: string, codigo: string) {
    setAviso(null);
    setActual(prev => {
      const set = new Set(prev[rolId]);
      if (set.has(codigo)) set.delete(codigo); else set.add(codigo);
      return { ...prev, [rolId]: set };
    });
  }

  function descartar() {
    setError(null);
    setAviso(null);
    setActual(guardado);
  }

  async function guardar() {
    if (!data) return;
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      for (const r of data.roles) {
        if (diferencias({ [r.id]: guardado[r.id] }, { [r.id]: actual[r.id] }) === 0) continue;
        const res: { permisos: string[] } = await bridge().permisos.actualizarRol({ rolId: r.id, permisos: [...actual[r.id]] });
        if (r.id === session?.rolId) {
          actualizarSesion?.({ permisos: res.permisos });
          const p = bridge().menu?.rebuild?.();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
      }
      await cargar();
      setAviso('Cambios guardados. Los usuarios de otros roles los ven en su próximo ingreso.');
    } catch (e) {
      setError(traducirError(e).mensaje);
      // Lo que ya se guardó se refleja; lo que falló queda pendiente para corregirlo o descartarlo.
      try {
        const m: Matriz = await bridge().permisos.matriz();
        setData(m);
        setGuardado(aSets(m));
      } catch { /* se conserva lo último cargado */ }
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex-col gap-4">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Roles y permisos</h2>
        {data && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="text-sm" style={{ color: cambios ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
              {cambios === 0 ? 'Sin cambios sin guardar' : `${cambios} cambio${cambios > 1 ? 's' : ''} sin guardar`}
            </span>
            <button className="btn-secondary" onClick={descartar} disabled={cambios === 0 || guardando}>Descartar</button>
            <button className="btn-primary" onClick={guardar} disabled={cambios === 0 || guardando}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert-danger" role="alert">{error}</div>}
      {aviso && <div className="alert-ok" role="status">{aviso}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>Cargando…</div>
      ) : data && (
        <>
          <div className="row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {data.roles.map(r => (
              <div key={r.id} className="panel" style={{ padding: '0.6rem 0.9rem' }}>
                <div className="text-muted text-sm">{r.nombre}</div>
                <div className="num" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                  {actual[r.id]?.size ?? 0}
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
                      actual={actual}
                      guardado={guardado}
                      rolPropio={session?.rolId ?? null}
                      deshabilitado={guardando}
                      onAlternar={alternar}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-muted text-sm" style={{ margin: 0 }}>
            Los permisos son del rol: un cambio vale para todos los usuarios de ese rol. Tiene que
            quedar siempre al menos un usuario activo que pueda administrar usuarios.
          </p>
        </>
      )}
    </div>
  );
}

function FragmentoModulo({ modulo, permisos, roles, actual, guardado, rolPropio, deshabilitado, onAlternar }: Readonly<{
  modulo: string; permisos: Permiso[]; roles: Rol[]; actual: Asignaciones; guardado: Asignaciones;
  rolPropio: string | null; deshabilitado: boolean; onAlternar: (rolId: string, codigo: string) => void;
}>) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} className="text-muted text-sm"
          style={{ textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>
          {modulo}
        </td>
      </tr>
      {permisos.map(p => {
        const etiqueta = etiquetaPermiso(p.codigo);
        return (
          <tr key={p.codigo}>
            <td title={p.codigo}>{etiqueta}</td>
            {roles.map(r => {
              const marcado = actual[r.id]?.has(p.codigo) ?? false;
              const cambiado = marcado !== (guardado[r.id]?.has(p.codigo) ?? false);
              const bloqueado = p.codigo === ADMINISTRAR && r.id === rolPropio && marcado;
              return (
                <td key={r.id} className="c" title={bloqueado ? MOTIVO_PROPIO : undefined}
                  style={cambiado ? { background: 'var(--accent-soft, rgba(0,0,0,0.04))' } : undefined}>
                  <input
                    type="checkbox"
                    aria-label={`${r.nombre}: ${etiqueta}`}
                    checked={marcado}
                    disabled={bloqueado || deshabilitado}
                    onChange={() => onAlternar(r.id, p.codigo)}
                  />
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
