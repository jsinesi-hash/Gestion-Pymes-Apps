import { useState } from 'react';
import { useAuth, useToast, traducirError, Modal } from '@core/ui';
import {
  useProveedores, TIPOS_DOC, CONDICIONES_FISCALES, type ProveedorRow, type ProveedorPayload,
} from '../../hooks/useProveedores';

export function ProveedoresView() {
  const { can } = useAuth();
  const { proveedores, loading, guardar, desactivar } = useProveedores();
  const toast = useToast();
  const [modal, setModal] = useState<{ proveedor: ProveedorRow | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <div style={{ padding: '2rem', opacity: 0.5 }}>Cargando...</div>;
  const puedeGestionar = can('proveedor.gestionar');

  async function handleDesactivar(p: ProveedorRow) {
    if (!globalThis.confirm(`¿Dar de baja a ${p.razon_social}? Sus compras anteriores se conservan.`)) return;
    setError(null);
    try {
      await desactivar(p.id);
      toast.success('Proveedor dado de baja');
    } catch (e) {
      setError(traducirError(e).mensaje);
    }
  }

  return (
    <div className="panel" style={{ flex: 1 }}>
      <div className="toolbar">
        <div className="ml-auto" />
        {puedeGestionar && <button className="btn-primary" onClick={() => setModal({ proveedor: null })}>+ Nuevo proveedor</button>}
      </div>
      {error && <div className="alert-danger" role="alert">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Código</th><th>Razón social</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {proveedores.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', opacity: 0.5 }}>Sin proveedores</td></tr>
            )}
            {proveedores.map((p) => (
              <tr key={p.id}>
                <td>{p.codigo ?? '—'}</td>
                <td>{p.razon_social}</td>
                <td>{p.persona_contacto ?? '—'}</td>
                <td>{p.telefono ?? '—'}</td>
                <td>{p.email ?? '—'}</td>
                <td>
                  {puedeGestionar && (
                    <>
                      <button className="btn-secondary btn-sm" onClick={() => setModal({ proveedor: p })}>Editar</button>{' '}
                      <button className="btn-secondary btn-sm" onClick={() => handleDesactivar(p)}>Dar de baja</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <ProveedorModal proveedor={modal.proveedor} onClose={() => setModal(null)} onGuardar={guardar} />}
    </div>
  );
}

function ProveedorModal({ proveedor, onClose, onGuardar }: {
  proveedor: ProveedorRow | null;
  onClose: () => void;
  onGuardar: (p: ProveedorPayload) => Promise<void>;
}) {
  const toast = useToast();
  const [razon, setRazon] = useState(proveedor?.razon_social ?? '');
  const [tipoDoc, setTipoDoc] = useState<ProveedorRow['tipo_documento']>(proveedor?.tipo_documento ?? 'CUIT');
  const [numDoc, setNumDoc] = useState(proveedor?.numero_documento && proveedor.numero_documento !== '0' ? proveedor.numero_documento : '');
  const [condicion, setCondicion] = useState<ProveedorRow['condicion_fiscal']>(proveedor?.condicion_fiscal ?? 'Responsable Inscripto');
  const [contacto, setContacto] = useState(proveedor?.persona_contacto ?? '');
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '');
  const [email, setEmail] = useState(proveedor?.email ?? '');
  const [domicilio, setDomicilio] = useState(proveedor?.domicilio ?? '');
  const [obs, setObs] = useState(proveedor?.observaciones ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!razon.trim()) return;
    setSaving(true); setError(null);
    try {
      await onGuardar({
        ...(proveedor ? { id: proveedor.id } : {}),
        razon_social: razon.trim(), tipo_documento: tipoDoc, numero_documento: numDoc.trim(), condicion_fiscal: condicion,
        telefono: telefono.trim(), email: email.trim(), persona_contacto: contacto.trim(),
        domicilio: domicilio.trim(), observaciones: obs.trim(),
      });
      toast.success(proveedor ? 'Proveedor actualizado' : 'Proveedor creado');
      onClose();
    } catch (err) {
      setError(traducirError(err).mensaje);
    } finally { setSaving(false); }
  }

  const campo = (id: string, label: string, valor: string, set: (v: string) => void, extra: Record<string, unknown> = {}) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" type="text" value={valor} onChange={(e) => set(e.target.value)} {...extra} />
    </div>
  );

  return (
    <Modal ariaLabel={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose} bloqueado={saving} as="form" onSubmit={handleSubmit}>
      <div className="modal-header"><span className="modal-title">{proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</span></div>
      <div className="modal-body">
        {campo('prov-razon', 'Razón social *', razon, setRazon, { required: true, maxLength: 160, autoFocus: true })}
        <div className="field">
          <label htmlFor="prov-tipo">Tipo de documento</label>
          <select id="prov-tipo" className="input" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value as ProveedorRow['tipo_documento'])}>
            {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {campo('prov-doc', 'Número de documento', numDoc, setNumDoc, { maxLength: 20 })}
        <div className="field">
          <label htmlFor="prov-cond">Condición fiscal</label>
          <select id="prov-cond" className="input" value={condicion} onChange={(e) => setCondicion(e.target.value as ProveedorRow['condicion_fiscal'])}>
            {CONDICIONES_FISCALES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {campo('prov-contacto', 'Persona de contacto', contacto, setContacto, { maxLength: 120 })}
        {campo('prov-tel', 'Teléfono', telefono, setTelefono, { maxLength: 40 })}
        {campo('prov-email', 'Email', email, setEmail, { maxLength: 120 })}
        {campo('prov-dom', 'Domicilio', domicilio, setDomicilio, { maxLength: 200 })}
        {campo('prov-obs', 'Observaciones', obs, setObs, { maxLength: 500 })}
        {error && <div className="alert-danger" role="alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={!razon.trim() || saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Modal>
  );
}
