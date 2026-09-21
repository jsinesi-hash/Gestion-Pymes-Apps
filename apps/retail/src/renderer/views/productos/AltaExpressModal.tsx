import { useState, useRef, useEffect } from 'react';
import { useCallIpc } from '../../hooks/useCallIpc';

// PROD-3 (ADR-079): alta rápida de producto desde puntos de captura (POS, OC) que no
// tienen el producto todavía. Sólo nombre + precio; el resto (categoría, unidad, IVA)
// lo resuelve `producto.quickCreate` en el main process.

export type ProductoCreado = { id: string; sku: string; nombre_corto: string };

type Props = {
  nombreInicial?: string;
  onCreado: (p: ProductoCreado) => void;
  onClose: () => void;
};

export function AltaExpressModal({ nombreInicial = '', onCreado, onClose }: Readonly<Props>) {
  const callIpc = useCallIpc();
  const [nombre, setNombre] = useState(nombreInicial);
  const [precio, setPrecio] = useState('');
  const [ean, setEan] = useState('');
  const [errNombre, setErrNombre] = useState<string | null>(null);
  const [errPrecio, setErrPrecio] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);
  const precioRef = useRef<HTMLInputElement>(null);

  useEffect(() => { (nombreInicial ? precioRef : nombreRef).current?.focus(); }, [nombreInicial]);

  function validarNombre(v: string): string | null {
    return v.trim() ? null : 'Ingresá un nombre.';
  }
  function validarPrecio(v: string): string | null {
    const n = Number.parseFloat(v.replace(',', '.'));
    if (!v.trim() || Number.isNaN(n)) return 'Ingresá un precio.';
    if (n <= 0) return 'Ingresá un precio mayor a 0.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const en = validarNombre(nombre);
    const ep = validarPrecio(precio);
    setErrNombre(en);
    setErrPrecio(ep);
    if (en) { nombreRef.current?.focus(); return; }
    if (ep) { precioRef.current?.focus(); return; }
    setSaving(true);
    const precioNum = Number.parseFloat(precio.replace(',', '.'));
    const res = await callIpc(
      () => (globalThis as any).ferreteria.catalogo.producto.quickCreate({
        nombre_corto: nombre.trim(),
        precio_venta_lista: precioNum,
        ...(ean.trim() ? { gtin_barcode: ean.trim() } : {}),
      }),
      { success: 'Producto creado' },
    );
    setSaving(false);
    if (res.ok) onCreado(res.data as ProductoCreado);
  }

  return (
    <div className="modal-overlay" role="button" tabIndex={0} aria-label="Cerrar" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <form className="modal" role="dialog" aria-modal="true" tabIndex={-1} style={{ width: 420 }} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <span className="modal-title">Alta rápida de producto</span>
          <button type="button" className="ia" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="ax-nombre">Nombre</label>
            <input id="ax-nombre" className="input" ref={nombreRef} value={nombre}
              onChange={e => setNombre(e.target.value)}
              onBlur={() => setErrNombre(validarNombre(nombre))} />
            {errNombre && <div className="field-error">{errNombre}</div>}
          </div>
          <div className="field">
            <label htmlFor="ax-precio">Precio de venta ($)</label>
            <input id="ax-precio" className="input num" ref={precioRef} inputMode="decimal" value={precio}
              onChange={e => setPrecio(e.target.value)}
              onBlur={() => setErrPrecio(validarPrecio(precio))} placeholder="0.00" />
            {errPrecio && <div className="field-error">{errPrecio}</div>}
          </div>
          <div className="field">
            <label htmlFor="ax-ean">Código de barras (opcional)</label>
            <input id="ax-ean" className="input num" value={ean} onChange={e => setEan(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creando…' : 'Crear producto'}
          </button>
        </div>
      </form>
    </div>
  );
}
