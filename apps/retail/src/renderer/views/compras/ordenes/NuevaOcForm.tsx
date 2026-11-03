import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCallIpc, bridge } from '@core/ui';

// ADR-085 (SEC-2): campos con input propio en este form; `tipo` va fijo en 'manual' y no
// tiene control editable, así que un rechazo por ese campo cae en la región general.
const CAMPOS_ERROR = new Set(['proveedor_id', 'observaciones']);

type Proveedor = { id: string; razon_social: string };

export function NuevaOcForm() {
  const navigate = useNavigate();
  const callIpc = useCallIpc();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [form, setForm] = useState({ proveedor_id: '', observaciones: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    bridge().compras.proveedor.list()
      .then((data: Proveedor[]) => setProveedores(data));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (!form.proveedor_id) {
      setFieldErrors({ proveedor_id: 'Seleccioná un proveedor.' });
      document.getElementById('proveedor_id')?.focus();
      return;
    }
    setSaving(true);
    const r = await callIpc<{ id: string }>(
      () => bridge().compras.oc.crear({
        proveedor_id:  form.proveedor_id,
        tipo:          'manual',
        observaciones: form.observaciones.trim() || undefined,
      }),
      { success: 'Orden de compra creada' },
    );
    setSaving(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): campo con input propio rutea el error inline + foco; el resto
      // (incluido `tipo`, sin control) va a la región general de error.
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setFieldErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      } else {
        setError(r.traducido.mensaje);
      }
      return;
    }
    navigate(`/compras/ordenes/${r.data.id}`);
  }

  return (
    <div className="flex-col gap-4" style={{ maxWidth: 600 }}>
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>Nueva orden de compra manual</h1>
      </div>

      <form onSubmit={handleSubmit} className="card flex-col gap-3">
        <div className="card-title">Datos de la OC</div>
        <label className="form-label">
          Proveedor *{' '}
          <select id="proveedor_id" className={`input${fieldErrors.proveedor_id ? ' error' : ''}`} value={form.proveedor_id}
            onChange={e => { setForm(f => ({ ...f, proveedor_id: e.target.value })); setError(''); setFieldErrors(prev => ({ ...prev, proveedor_id: '' })); }}>
            <option value="">— Seleccioná un proveedor —</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
          </select>
          {fieldErrors.proveedor_id && <span className="field-error">{fieldErrors.proveedor_id}</span>}
        </label>
        <label className="form-label">
          Observaciones{' '}
          <textarea id="observaciones" className={`input${fieldErrors.observaciones ? ' error' : ''}`} rows={2} value={form.observaciones}
            placeholder="Notas opcionales..."
            onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
            style={{ resize: 'vertical' }} />
          {fieldErrors.observaciones && <span className="field-error">{fieldErrors.observaciones}</span>}
        </label>
        {error && (
          <div className="alert-danger" role="alert">{error}</div>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creando...' : 'Crear OC y agregar ítems'}
          </button>
        </div>
      </form>
    </div>
  );
}
