import { useEffect, useState } from 'react';
import { useAuth, bridge, Modal } from '@core/ui';
import { ymdLocal, hoyYmd } from '@ferreteria/shared';
import { agendaApi, toDate, type Rutina, type FrecuenciaTipo } from '../../hooks/useAgenda';

const FRECUENCIAS: Array<{ valor: FrecuenciaTipo; label: string }> = [
  { valor: 'unica', label: 'Única vez' },
  { valor: 'diaria', label: 'Diaria' },
  { valor: 'semanal', label: 'Semanal' },
  { valor: 'mensual', label: 'Mensual' },
  { valor: 'cada_n_dias', label: 'Cada N días' },
];

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function ymd(v: Rutina['fecha_inicio']): string {
  const d = toDate(v);
  return d ? ymdLocal(d) : hoyYmd();
}

export function RutinaFormModal(props: Readonly<{ rutina: Rutina | null; onClose: () => void; onGuardado: () => void }>) {
  const { rutina, onClose, onGuardado } = props;
  const { session } = useAuth();
  const [roles, setRoles] = useState<Array<{ id: string; nombre: string }>>([]);

  const [nombre, setNombre] = useState(rutina?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(rutina?.descripcion ?? '');
  const [frecuencia, setFrecuencia] = useState<FrecuenciaTipo>(rutina?.frecuencia_tipo ?? 'semanal');
  const [intervalo, setIntervalo] = useState(rutina?.intervalo ?? 1);
  const [diaSemana, setDiaSemana] = useState(rutina?.dia_semana ?? 1);
  const [diaMes, setDiaMes] = useState(rutina?.dia_mes ?? 1);
  const [hora, setHora] = useState(rutina?.hora ?? '09:00');
  const [fechaInicio, setFechaInicio] = useState(ymd(rutina?.fecha_inicio ?? null));
  const [fechaFin, setFechaFin] = useState(rutina?.fecha_fin ? ymd(rutina.fecha_fin) : '');
  const [destTipo, setDestTipo] = useState<'usuario' | 'rol'>(rutina?.destinatario_tipo ?? 'usuario');
  const [destRol, setDestRol] = useState(rutina?.destinatario_rol ?? '');
  const [canalInApp, setCanalInApp] = useState(rutina?.canal_in_app ?? true);
  const [canalEmail, setCanalEmail] = useState(rutina?.canal_email ?? false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bridge()?.rol?.list?.()
      .then((rs: Array<{ id: string; nombre: string }>) => {
        setRoles(rs);
        if (!destRol && rs.length) setDestRol(rs[0].nombre);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (destTipo === 'usuario' && !session?.id) { setError('No hay sesión activa.'); return; }
    setProcesando(true); setError(null);
    const payload = {
      nombre: nombre.trim(), descripcion: descripcion.trim() || null,
      frecuencia_tipo: frecuencia,
      intervalo: frecuencia === 'cada_n_dias' ? intervalo : (frecuencia === 'semanal' || frecuencia === 'mensual' ? intervalo : 1),
      dia_semana: frecuencia === 'semanal' ? diaSemana : null,
      dia_mes: frecuencia === 'mensual' ? diaMes : null,
      hora: frecuencia === 'unica' ? hora : hora,
      fecha_inicio: new Date(`${fechaInicio}T${hora || '09:00'}:00`).toISOString(),
      fecha_fin: fechaFin ? new Date(`${fechaFin}T23:59:59`).toISOString() : null,
      destinatario: destTipo === 'usuario'
        ? { tipo: 'usuario' as const, id: session!.id }
        : { tipo: 'rol' as const, rol: destRol },
      canal_in_app: canalInApp, canal_email: canalEmail,
    };
    try {
      if (rutina) await agendaApi().rutina.editar({ id: rutina.id, ...payload });
      else await agendaApi().rutina.crear(payload);
      onGuardado();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setProcesando(false); }
  }

  return (
    <Modal ariaLabel={rutina ? 'Editar rutina' : 'Nueva rutina'} ancho={520} onClose={onClose} bloqueado={procesando}>
      <div className="modal-header"><span className="modal-title">{rutina ? 'Editar rutina' : 'Nueva rutina'}</span></div>
      <div className="modal-body" style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          Nombre
          <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          Descripción (opcional)
          <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            Frecuencia
            <select className="input" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as FrecuenciaTipo)}>
              {FRECUENCIAS.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            Hora
            <input className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        </div>

        {frecuencia === 'cada_n_dias' && (
          <label style={{ display: 'grid', gap: 4 }}>
            Cada cuántos días
            <input className="input" type="number" min={1} value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))} />
          </label>
        )}
        {frecuencia === 'semanal' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              Día de la semana
              <select className="input" value={diaSemana} onChange={(e) => setDiaSemana(Number(e.target.value))}>
                {DIAS_SEMANA.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              Cada cuántas semanas
              <input className="input" type="number" min={1} value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))} />
            </label>
          </div>
        )}
        {frecuencia === 'mensual' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              Día del mes (31 = último)
              <input className="input" type="number" min={1} max={31} value={diaMes} onChange={(e) => setDiaMes(Number(e.target.value))} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              Cada cuántos meses
              <input className="input" type="number" min={1} value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))} />
            </label>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            {frecuencia === 'unica' ? 'Fecha' : 'Desde'}
            <input className="input" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </label>
          {frecuencia !== 'unica' && (
            <label style={{ display: 'grid', gap: 4 }}>
              Hasta (opcional)
              <input className="input" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </label>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'grid', gap: 4 }}>
            Responsable
            <select className="input" value={destTipo} onChange={(e) => setDestTipo(e.target.value as 'usuario' | 'rol')}>
              <option value="usuario">Yo ({session?.nombreCompleto ?? 'usuario actual'})</option>
              <option value="rol">Un rol</option>
            </select>
          </label>
          {destTipo === 'rol' && (
            <label style={{ display: 'grid', gap: 4 }}>
              Rol
              <select className="input" value={destRol} onChange={(e) => setDestRol(e.target.value)}>
                {roles.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
              </select>
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={canalInApp} onChange={(e) => setCanalInApp(e.target.checked)} /> En la app
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={canalEmail} onChange={(e) => setCanalEmail(e.target.checked)} /> Email
          </label>
        </div>

        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={procesando}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={guardar} disabled={procesando}>{rutina ? 'Guardar' : 'Crear rutina'}</button>
      </div>
    </Modal>
  );
}
