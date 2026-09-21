import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DireccionGeo, type DireccionGeoValue } from '../../../components/DireccionGeo';
import { formatDocumento, validarDocumento, validarTelefono, validarCodigoPostal } from '../../../utils/documento';
import { useMotorPreciosV2Habilitado } from '../../../hooks/useMotorPrecios';
import { useCallIpc } from '../../../hooks/useCallIpc';

// ADR-082 (SEC-2): campos del form que pueden mostrar un error inline. Sus inputs llevan
// un `id` igual a la clave, para poder enfocar el control cuando el backend rechaza por él.
const CAMPOS_ERROR = new Set(['numero_documento', 'razon_social', 'telefono', 'telefono_adicional', 'codigo_postal']);

type FormState = {
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  razon_social: string;
  nombre_fantasia: string;
  condicion_fiscal: 'Responsable Inscripto' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  calle: string;
  numero: string;
  aclaracion: string;
  direccion: DireccionGeoValue;
  telefono: string;
  telefono_adicional: string;
  email: string;
  persona_contacto: string;
  observaciones: string;
  codigo: string;
  // ADR-063 Lote 4 — umbral opt-in de pre-selección por similitud (string; '' = desactivado).
  match_umbral_preseleccion: string;
  // ADR-049 §1 — defaults comerciales (strings para los inputs; se parsean al guardar).
  bonificacion_pct_default: string;
  costo_financiero_pct_default: string;
  flete_pct_default: string;
};

const initialForm: FormState = {
  tipo_documento: 'CUIT',
  numero_documento: '',
  razon_social: '',
  nombre_fantasia: '',
  condicion_fiscal: 'Responsable Inscripto',
  calle: '',
  numero: '',
  aclaracion: '',
  direccion: { localidad_id: '', localidad: '', provincia: '', codigo_postal: '' },
  telefono: '',
  telefono_adicional: '',
  email: '',
  persona_contacto: '',
  observaciones: '',
  codigo: '',
  match_umbral_preseleccion: '',
  bonificacion_pct_default: '0',
  costo_financiero_pct_default: '0',
  flete_pct_default: '0',
};

export function ProveedorForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modoEdicion = !!id;
  const motorV2 = useMotorPreciosV2Habilitado();
  const callIpc = useCallIpc();

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (globalThis as any).ferreteria.compras.proveedor.get(id).then((p: any) => {
      if (!p) return;
      setForm({
        tipo_documento:     p.tipo_documento    ?? 'CUIT',
        numero_documento:   p.numero_documento  ?? '',
        razon_social:       p.razon_social      ?? '',
        nombre_fantasia:    p.nombre_fantasia   ?? '',
        condicion_fiscal:   p.condicion_fiscal  ?? 'Responsable Inscripto',
        calle:              p.calle             ?? '',
        numero:             p.numero            ?? '',
        aclaracion:         p.aclaracion        ?? '',
        direccion: {
          localidad_id:  p.localidad_id  ?? '',
          localidad:     p.localidad     ?? '',
          provincia:     p.provincia     ?? '',
          codigo_postal: p.codigo_postal ?? '',
        },
        telefono:           p.telefono           ?? '',
        telefono_adicional: p.telefono_adicional ?? '',
        email:              p.email              ?? '',
        persona_contacto:   p.persona_contacto   ?? '',
        observaciones:      p.observaciones      ?? '',
        codigo:             p.codigo             ?? '',
        match_umbral_preseleccion:    p.match_umbral_preseleccion == null ? '' : String(p.match_umbral_preseleccion),
        bonificacion_pct_default:     (p.bonificacion_pct_default     ?? 0).toString(),
        costo_financiero_pct_default: (p.costo_financiero_pct_default ?? 0).toString(),
        flete_pct_default:            (p.flete_pct_default            ?? 0).toString(),
      });
    });
  }, [id]);

  function set(field: keyof Omit<FormState, 'direccion'>, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }

  function handleTipoDocumento(tipo: FormState['tipo_documento']) {
    const reformateado = formatDocumento(tipo, form.numero_documento);
    setForm(f => ({ ...f, tipo_documento: tipo, numero_documento: reformateado }));
    setErrors(e => { const n = { ...e }; delete n.tipo_documento; delete n.numero_documento; return n; });
  }

  function handleNumeroDocumento(raw: string) {
    const formateado = formatDocumento(form.tipo_documento, raw);
    set('numero_documento', formateado);
  }

  function handleNumeroLocal(raw: string) {
    set('numero', raw.replace(/\D/g, ''));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.razon_social.trim()) errs.razon_social = 'La razón social es obligatoria.';

    const errDoc = form.numero_documento.trim()
      ? validarDocumento(form.tipo_documento, form.numero_documento)
      : 'El número de documento es obligatorio.';
    if (errDoc) errs.numero_documento = errDoc;

    const errTel = validarTelefono(form.telefono);
    if (errTel) errs.telefono = errTel;

    const errTelAd = validarTelefono(form.telefono_adicional);
    if (errTelAd) errs.telefono_adicional = errTelAd;

    const errCp = validarCodigoPostal(form.direccion.codigo_postal);
    if (errCp) errs.codigo_postal = errCp;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const payload = {
      ...(id ? { id } : {}),
      tipo_documento:     form.tipo_documento,
      numero_documento:   form.numero_documento.trim(),
      razon_social:       form.razon_social.trim(),
      condicion_fiscal:   form.condicion_fiscal,
      nombre_fantasia:    form.nombre_fantasia.trim()    || undefined,
      calle:              form.calle.trim()              || undefined,
      numero:             form.numero.trim()             || undefined,
      aclaracion:         form.aclaracion.trim()         || undefined,
      localidad_id:       form.direccion.localidad_id    || undefined,
      localidad:          form.direccion.localidad       || undefined,
      provincia:          form.direccion.provincia       || undefined,
      codigo_postal:      form.direccion.codigo_postal   || undefined,
      telefono:           form.telefono.trim()           || undefined,
      telefono_adicional: form.telefono_adicional.trim() || undefined,
      email:              form.email.trim()              || undefined,
      persona_contacto:   form.persona_contacto.trim()   || undefined,
      observaciones:      form.observaciones.trim()      || undefined,
      codigo:             form.codigo.trim()             || undefined,
      match_umbral_preseleccion:    form.match_umbral_preseleccion.trim() === '' ? null : Math.max(0, Math.min(100, Math.round(Number(form.match_umbral_preseleccion)) || 0)),
      bonificacion_pct_default:     Number(form.bonificacion_pct_default)     || 0,
      costo_financiero_pct_default: Number(form.costo_financiero_pct_default) || 0,
      flete_pct_default:            Number(form.flete_pct_default)            || 0,
    };
    // ERR-1: callIpc traduce y muestra el error por toast; sólo navegamos si salió bien.
    const r = await callIpc<{ id: string }>(
      () => (globalThis as any).ferreteria.compras.proveedor.upsert(payload),
      { success: modoEdicion ? 'Proveedor actualizado' : 'Proveedor creado' },
    );
    setSaving(false);
    if (!r.ok) {
      // ADR-082 (SEC-2): ruteo del error de validación del backend al campo del form.
      const campo = r.traducido.campo;
      if (campo && CAMPOS_ERROR.has(campo)) {
        setErrors(prev => ({ ...prev, [campo]: r.traducido.mensaje }));
        document.getElementById(campo)?.focus();
      }
      return;
    }
    navigate(`/compras/proveedores/${r.data.id}`);
  }

  const submitLabel = modoEdicion ? 'Guardar cambios' : 'Crear proveedor';

  return (
    <div className="flex-col gap-4" style={{ maxWidth: 800 }}>
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>{modoEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-col gap-4">
        <div className="card">
          <div className="card-title">Identificación fiscal</div>
          {modoEdicion && (
            <div className="form-row">
              <label className="form-label">
                Código de proveedor{' '}
                <input
                  className="input"
                  value={form.codigo}
                  readOnly
                  title="El código se asigna automáticamente y no se edita."
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </label>
            </div>
          )}
          <div className="form-row">
            <label className="form-label">
              Tipo de documento *{' '}
              <select className="input" value={form.tipo_documento} onChange={e => handleTipoDocumento(e.target.value as FormState['tipo_documento'])}>
                <option value="CUIT">CUIT</option>
                <option value="DNI">DNI</option>
                <option value="CUIL">CUIL</option>
              </select>
            </label>
            <label className="form-label">
              Número de documento *{' '}
              <input
                id="numero_documento"
                className={`input${errors.numero_documento ? ' error' : ''}`}
                value={form.numero_documento}
                onChange={e => handleNumeroDocumento(e.target.value)}
                placeholder={form.tipo_documento === 'DNI' ? '12345678' : '20-12345678-9'}
              />
              {errors.numero_documento && <span className="field-error">{errors.numero_documento}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label" style={{ flex: 2 }}>
              Razón social *{' '}
              <input id="razon_social" className={`input${errors.razon_social ? ' error' : ''}`} value={form.razon_social} onChange={e => set('razon_social', e.target.value)} placeholder="Distribuidora SA" />
              {errors.razon_social && <span className="field-error">{errors.razon_social}</span>}
            </label>
            <label className="form-label">
              Nombre fantasía{' '}
              <input className="input" value={form.nombre_fantasia} onChange={e => set('nombre_fantasia', e.target.value)} placeholder="Nombre comercial" />
            </label>
          </div>
          <div className="form-row">
            <label className="form-label" style={{ maxWidth: 220 }}>
              Condición fiscal *{' '}
              <select className="input" value={form.condicion_fiscal} onChange={e => set('condicion_fiscal', e.target.value as any)}>
                <option value="Responsable Inscripto">Resp. Inscripto</option>
                <option value="Monotributo">Monotributo</option>
                <option value="Exento">Exento</option>
                <option value="Consumidor Final">Consumidor Final</option>
              </select>
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Contacto</div>
          <div className="form-row">
            <label className="form-label">
              Teléfono{' '}
              <input id="telefono" className={`input${errors.telefono ? ' error' : ''}`} value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="11-1234-5678" />
              {errors.telefono && <span className="field-error">{errors.telefono}</span>}
            </label>
            <label className="form-label">
              Teléfono adicional{' '}
              <input id="telefono_adicional" className={`input${errors.telefono_adicional ? ' error' : ''}`} value={form.telefono_adicional} onChange={e => set('telefono_adicional', e.target.value)} placeholder="11-9999-8888" />
              {errors.telefono_adicional && <span className="field-error">{errors.telefono_adicional}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">
              Email{' '}
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contacto@proveedor.com" />
            </label>
            <label className="form-label">
              Persona de contacto{' '}
              <input className="input" value={form.persona_contacto} onChange={e => set('persona_contacto', e.target.value)} placeholder="Nombre del contacto" />
            </label>
          </div>
        </div>

        {motorV2 && (
          <div className="card">
            <div className="card-title">Condiciones comerciales</div>
            <div className="text-muted text-xs" style={{ padding: '0 var(--pad) 8px' }}>
              Se aplican por defecto al costo neto de todos los productos de este proveedor.
              Se pueden sobrescribir por producto (excepción) en el detalle del producto.
            </div>
            <div className="form-row">
              <label className="form-label">
                Bonificación % por defecto{' '}
                <input className="input num" type="number" step="0.01"
                  value={form.bonificacion_pct_default}
                  onChange={e => set('bonificacion_pct_default', e.target.value)} />
              </label>
              <label className="form-label">
                Costo financiero % por defecto{' '}
                <input className="input num" type="number" step="0.01"
                  value={form.costo_financiero_pct_default}
                  onChange={e => set('costo_financiero_pct_default', e.target.value)} />
              </label>
              <label className="form-label">
                Flete % por defecto{' '}
                <input className="input num" type="number" step="0.01"
                  value={form.flete_pct_default}
                  onChange={e => set('flete_pct_default', e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label className="form-label">
                Umbral de pre-selección por similitud (0–100, vacío = desactivado){' '}
                <input className="input num" type="number" min="0" max="100" step="1"
                  placeholder="desactivado"
                  value={form.match_umbral_preseleccion}
                  onChange={e => set('match_umbral_preseleccion', e.target.value)} />
              </label>
            </div>
            <div className="form-help" style={{ fontSize: 12, color: 'var(--ink-3)', padding: '0 var(--pad) var(--pad)' }}>
              En la Cola de Revisión de costos, los productos cuyo nombre se parezca al del archivo
              importado por encima de este porcentaje aparecen pre-marcados (podés destildarlos).
              Nunca se guarda nada sin tu confirmación.
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-title">Domicilio</div>
          <div className="form-row">
            <label className="form-label" style={{ flex: 2 }}>
              Calle{' '}
              <input className="input" value={form.calle} onChange={e => set('calle', e.target.value)} placeholder="Av. Corrientes" />
            </label>
            <label className="form-label" style={{ maxWidth: 110 }}>
              Número{' '}
              <input className="input" value={form.numero} onChange={e => handleNumeroLocal(e.target.value)} placeholder="1234" />
            </label>
            <label className="form-label">
              Aclaración{' '}
              <input className="input" value={form.aclaracion} onChange={e => set('aclaracion', e.target.value)} placeholder="Piso 2, Of. B" />
            </label>
          </div>
          <DireccionGeo
            value={form.direccion}
            onChange={v => setForm(f => ({ ...f, direccion: v }))}
          />
          {errors.codigo_postal && <span className="field-error">{errors.codigo_postal}</span>}
        </div>

        <div className="card">
          <div className="card-title">Observaciones</div>
          <div className="field" style={{ padding: '0 var(--pad) var(--pad)' }}>
            <textarea
              className="input"
              rows={4}
              value={form.observaciones}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Notas internas sobre el proveedor..."
              style={{ width: '100%', resize: 'vertical' }}
            />
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
