import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DireccionGeo, type DireccionGeoValue } from '@core/ui';
import { formatDocumento, validarDocumento, validarTelefono, validarCodigoPostal } from '@core/ui';
import { useCallIpc } from '@core/ui';

// ADR-082 (SEC-2): campos del form que pueden mostrar un error inline. Sus inputs llevan
// un `id` igual a la clave, para poder enfocar el control cuando el backend rechaza por él.
const CAMPOS_ERROR = new Set(['numero_documento', 'nombre', 'apellido', 'telefono', 'telefono_adicional', 'codigo_postal']);

type FormState = {
  tipo_documento: 'DNI' | 'CUIT' | 'CUIL';
  numero_documento: string;
  nombre: string;
  apellido: string;
  nombre_fantasia: string;
  condicion_fiscal: 'Responsable Inscripto' | 'Monotributo' | 'Consumidor Final' | 'Exento';
  telefono: string;
  telefono_adicional: string;
  email: string;
  habilita_cuenta_corriente: boolean;
  calle: string;
  numero: string;
  aclaracion: string;
  direccion: DireccionGeoValue;
  lista_precio_id: string;
};

const initialForm: FormState = {
  tipo_documento: 'DNI',
  numero_documento: '',
  nombre: '',
  apellido: '',
  nombre_fantasia: '',
  condicion_fiscal: 'Consumidor Final',
  telefono: '',
  telefono_adicional: '',
  email: '',
  habilita_cuenta_corriente: false,
  calle: '',
  numero: '',
  aclaracion: '',
  direccion: { localidad_id: '', localidad: '', provincia: '', codigo_postal: '' },
  lista_precio_id: '',
};

export function ClienteForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const modoEdicion = !!id;

  const callIpc = useCallIpc();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (globalThis as any).ferreteria.cliente.get(id).then((c: any) => {
      if (!c) return;
      setForm({
        tipo_documento:            c.tipo_documento            ?? 'DNI',
        numero_documento:          c.numero_documento          ?? '',
        nombre:                    c.nombre                    ?? '',
        apellido:                  c.apellido                  ?? '',
        nombre_fantasia:           c.nombre_fantasia           ?? '',
        condicion_fiscal:          c.condicion_fiscal          ?? 'Consumidor Final',
        telefono:                  c.telefono                  ?? '',
        telefono_adicional:        c.telefono_adicional        ?? '',
        email:                     c.email                     ?? '',
        habilita_cuenta_corriente: c.habilita_cuenta_corriente ?? false,
        calle:                     c.calle                     ?? '',
        numero:                    c.numero                    ?? '',
        aclaracion:                c.aclaracion                ?? '',
        direccion: {
          localidad_id:  c.localidad_id  ?? '',
          localidad:     c.localidad     ?? '',
          provincia:     c.provincia     ?? '',
          codigo_postal: c.codigo_postal ?? '',
        },
        lista_precio_id:           c.lista_precio_id           ?? '',
      });
    });
  }, [id]);

  const [listas, setListas] = useState<{ id: string; nombre: string }[]>([]);
  useEffect(() => {
    (globalThis as any).ferreteria.precios.lista.list()
      .then((rows: { id: string; nombre: string; activo: boolean }[]) => setListas(rows.filter(r => r.activo)))
      .catch(() => {});
  }, []);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  function handleTipoDocumento(tipo: FormState['tipo_documento']) {
    const reformateado = formatDocumento(tipo, form.numero_documento);
    setForm(f => ({ ...f, tipo_documento: tipo, numero_documento: reformateado }));
    setErrors(e => { const n = { ...e }; delete n.tipo_documento; delete n.numero_documento; return n; });
  }

  function handleNumeroDocumento(raw: string) {
    const formateado = formatDocumento(form.tipo_documento, raw);
    setField('numero_documento', formateado);
  }

  function handleNumeroLocal(raw: string) {
    setField('numero', raw.replace(/\D/g, ''));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs.nombre = 'El nombre es obligatorio.';
    if (!form.apellido.trim()) errs.apellido = 'El apellido es obligatorio.';

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
      tipo_documento:            form.tipo_documento,
      numero_documento:          form.numero_documento.trim(),
      nombre:                    form.nombre.trim(),
      apellido:                  form.apellido.trim(),
      condicion_fiscal:          form.condicion_fiscal,
      nombre_fantasia:           form.nombre_fantasia.trim()    || undefined,
      telefono:                  form.telefono.trim()            || undefined,
      telefono_adicional:        form.telefono_adicional.trim() || undefined,
      email:                     form.email.trim()              || undefined,
      habilita_cuenta_corriente: form.habilita_cuenta_corriente,
      calle:                     form.calle.trim()              || undefined,
      numero:                    form.numero.trim()             || undefined,
      aclaracion:                form.aclaracion.trim()         || undefined,
      localidad_id:              form.direccion.localidad_id    || undefined,
      localidad:                 form.direccion.localidad       || undefined,
      provincia:                 form.direccion.provincia       || undefined,
      codigo_postal:             form.direccion.codigo_postal   || undefined,
      lista_precio_id:           form.lista_precio_id ? form.lista_precio_id : (modoEdicion ? null : undefined),
    };
    // ERR-1: callIpc traduce y muestra el error por toast; sólo navegamos si salió bien.
    const r = await callIpc<{ id: string }>(
      () => (globalThis as any).ferreteria.cliente.upsert(payload),
      { success: modoEdicion ? 'Cliente actualizado' : 'Cliente creado' },
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
    navigate(`/clientes/${r.data.id}`);
  }

  return (
    <div className="flex-col gap-4" style={{ maxWidth: 800 }}>
      <div className="detail-head">
        <button className="back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Volver
        </button>
        <h1>{modoEdicion ? 'Editar cliente' : 'Nuevo cliente'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-col gap-4">
        <div className="card">
          <div className="card-title">Identificación</div>
          <div className="form-row">
            <label className="form-label">
              Tipo de documento *{' '}
              <select className="input" value={form.tipo_documento} onChange={(e) => handleTipoDocumento(e.target.value as FormState['tipo_documento'])}>
                <option value="DNI">DNI</option>
                <option value="CUIT">CUIT</option>
                <option value="CUIL">CUIL</option>
              </select>
            </label>
            <label className="form-label">
              Número de documento *{' '}
              <input
                id="numero_documento"
                className={`input${errors.numero_documento ? ' error' : ''}`}
                value={form.numero_documento}
                onChange={(e) => handleNumeroDocumento(e.target.value)}
                placeholder={form.tipo_documento === 'DNI' ? '12345678' : '20-12345678-9'}
              />
              {errors.numero_documento && <span className="field-error">{errors.numero_documento}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">
              Nombre *{' '}
              <input
                id="nombre"
                className={`input${errors.nombre ? ' error' : ''}`}
                value={form.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                placeholder="Juan Carlos"
              />
              {errors.nombre && <span className="field-error">{errors.nombre}</span>}
            </label>
            <label className="form-label">
              Apellido *{' '}
              <input
                id="apellido"
                className={`input${errors.apellido ? ' error' : ''}`}
                value={form.apellido}
                onChange={(e) => setField('apellido', e.target.value)}
                placeholder="García"
              />
              {errors.apellido && <span className="field-error">{errors.apellido}</span>}
            </label>
            <label className="form-label">
              Nombre fantasía{' '}
              <input className="input" value={form.nombre_fantasia} onChange={(e) => setField('nombre_fantasia', e.target.value)} placeholder="Opcional" />
            </label>
          </div>
          <div className="form-row">
            <label className="form-label" style={{ maxWidth: 220 }}>
              Condición fiscal *{' '}
              <select className="input" value={form.condicion_fiscal} onChange={(e) => setField('condicion_fiscal', e.target.value as any)}>
                <option value="Consumidor Final">Consumidor Final</option>
                <option value="Monotributo">Monotributo</option>
                <option value="Responsable Inscripto">Resp. Inscripto</option>
                <option value="Exento">Exento</option>
              </select>
            </label>
            <label className="form-label" style={{ maxWidth: 260 }}>
              Lista de precios{' '}
              <select className="input" value={form.lista_precio_id} onChange={(e) => setField('lista_precio_id', e.target.value)}>
                <option value="">(Predeterminada)</option>
                {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Contacto</div>
          <div className="form-row">
            <label className="form-label">
              Teléfono
              <input id="telefono" className={`input${errors.telefono ? ' error' : ''}`} value={form.telefono} onChange={(e) => setField('telefono', e.target.value)} placeholder="11-1234-5678" />
              {errors.telefono && <span className="field-error">{errors.telefono}</span>}
            </label>
            <label className="form-label">
              Teléfono adicional
              <input id="telefono_adicional" className={`input${errors.telefono_adicional ? ' error' : ''}`} value={form.telefono_adicional} onChange={(e) => setField('telefono_adicional', e.target.value)} placeholder="11-9999-8888" />
              {errors.telefono_adicional && <span className="field-error">{errors.telefono_adicional}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="form-label">
              Email
              <input className="input" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="cliente@email.com" />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Domicilio</div>
          <div className="form-row">
            <label className="form-label" style={{ flex: 2 }}>
              Calle
              <input className="input" value={form.calle} onChange={(e) => setField('calle', e.target.value)} placeholder="Av. Corrientes" />
            </label>
            <label className="form-label" style={{ maxWidth: 110 }}>
              Número
              <input className="input" value={form.numero} onChange={(e) => handleNumeroLocal(e.target.value)} placeholder="1234" />
            </label>
            <label className="form-label">
              Aclaración
              <input className="input" value={form.aclaracion} onChange={(e) => setField('aclaracion', e.target.value)} placeholder="Depto 3B" />
            </label>
          </div>
          <DireccionGeo
            value={form.direccion}
            onChange={(v) => setField('direccion', v)}
          />
          {errors.codigo_postal && <span className="field-error">{errors.codigo_postal}</span>}
        </div>

        <div className="card">
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.habilita_cuenta_corriente}
              onChange={(e) => setField('habilita_cuenta_corriente', e.target.checked)}
            />
            <span>Habilitar cuenta corriente</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {(() => { const innerLabel = modoEdicion ? 'Guardar cambios' : 'Crear cliente'; return saving ? 'Guardando...' : innerLabel; })()}
          </button>
        </div>
      </form>
    </div>
  );
}
