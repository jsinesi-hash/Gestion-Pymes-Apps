import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCallIpc } from '@core/ui';

// ADR-085 (SEC-2): campos del form que pueden mostrar un error inline. Sus inputs llevan
// un `id` igual a la clave, para poder enfocar el control cuando el backend rechaza por él.
const CAMPOS_ERROR = new Set(['razon_social', 'telefono', 'email', 'persona_contacto', 'domicilio', 'observaciones']);

type FormState = {
  razon_social: string;
  telefono: string;
  email: string;
  persona_contacto: string;
  domicilio: string;
  observaciones: string;
};

const initialForm: FormState = {
  razon_social: '', telefono: '', email: '', persona_contacto: '', domicilio: '', observaciones: '',
};

export function TransportistaForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modoEdicion = !!id;
  const callIpc = useCallIpc();

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (globalThis as any).ferreteria.transportista.get(id).then((t: any) => {
      if (!t) return;
      setForm({
        razon_social:     t.razon_social     ?? '',
        telefono:         t.telefono         ?? '',
        email:            t.email            ?? '',
        persona_contacto: t.persona_contacto ?? '',
        domicilio:        t.domicilio        ?? '',
        observaciones:    t.observaciones    ?? '',
      });
    });
  }, [id]);

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.razon_social.trim()) errs.razon_social = 'La razón social es obligatoria.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...(id ? { id } : {}),
      razon_social:     form.razon_social.trim(),
      telefono:         form.telefono.trim()         || undefined,
      email:            form.email.trim()            || undefined,
      persona_contacto: form.persona_contacto.trim() || undefined,
      domicilio:        form.domicilio.trim()        || undefined,
      observaciones:    form.observaciones.trim()    || undefined,
    };
    // ERR-1: callIpc traduce y muestra el error por toast; sólo navegamos si salió bien.
    const r = await callIpc<{ id: string }>(
      () => (globalThis as any).ferreteria.transportista.upsert(payload),
      { success: 'Transportista guardado' },
    );
    setSaving(false);
    if (!r.ok) {
      // ADR-085 (SEC-2): ruteo del error de validación del backend al campo del form.
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      }
      return;
    }
    navigate('/remitos/transportistas');
  }

  const submitLabel = modoEdicion ? 'Guardar cambios' : 'Crear transportista';

  return (
    <div className="flex-col gap-4" style={{ maxWidth: 700 }}>
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>{modoEdicion ? 'Editar transportista' : 'Nuevo transportista'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-col gap-4">
        <div className="card">
          <div className="card-title">Datos</div>
          <div className="form-row">
            <label className="form-label" style={{ flex: 2 }}>
              Razón social *{' '}
              <input
                id="razon_social"
                className={`input${errors.razon_social ? ' error' : ''}`}
                value={form.razon_social}
                onChange={e => set('razon_social', e.target.value)}
                placeholder="Transporte Rex"
              />
              {errors.razon_social && <span className="field-error">{errors.razon_social}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">
              Teléfono{' '}
              <input id="telefono" className={`input${errors.telefono ? ' error' : ''}`} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="11-1234-5678" />
              {errors.telefono && <span className="field-error">{errors.telefono}</span>}
            </label>
            <label className="form-label">
              Email{' '}
              <input id="email" className={`input${errors.email ? ' error' : ''}`} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contacto@transporte.com" />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">
              Persona de contacto{' '}
              <input id="persona_contacto" className={`input${errors.persona_contacto ? ' error' : ''}`} value={form.persona_contacto} onChange={e => set('persona_contacto', e.target.value)} placeholder="Nombre del contacto" />
              {errors.persona_contacto && <span className="field-error">{errors.persona_contacto}</span>}
            </label>
            <label className="form-label" style={{ flex: 2 }}>
              Domicilio{' '}
              <input id="domicilio" className={`input${errors.domicilio ? ' error' : ''}`} value={form.domicilio} onChange={e => set('domicilio', e.target.value)} placeholder="Ruta 8 km 45" />
              {errors.domicilio && <span className="field-error">{errors.domicilio}</span>}
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Observaciones</div>
          <div className="field">
            <textarea
              id="observaciones"
              className={`input${errors.observaciones ? ' error' : ''}`}
              rows={4}
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Notas internas sobre el transportista..."
              style={{ width: '100%', resize: 'vertical' }}
            />
            {errors.observaciones && <span className="field-error">{errors.observaciones}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
