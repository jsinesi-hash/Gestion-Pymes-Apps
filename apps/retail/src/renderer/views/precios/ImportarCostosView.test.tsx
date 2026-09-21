import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ImportarCostosView } from './ImportarCostosView';
import { ImportacionCostoWizardProvider } from '../../context/ImportacionCostoWizardContext';

function mockFerreteria() {
  (window as any).ferreteria = {
    compras: { proveedor: { list: vi.fn().mockResolvedValue([{ id: 'p1', razon_social: 'Prov Uno', codigo: 'PROV-0001', activo: true }]) } },
    catalogo: { producto: { list: vi.fn().mockResolvedValue({ items: [], total: 0 }) } },
    importacionCosto: {
      parseArchivo: vi.fn(),
      revalidarFila: vi.fn(),
      buscarProductos: vi.fn().mockResolvedValue([]),
      confirmar: vi.fn(),
      cancelar: vi.fn().mockResolvedValue({ ok: true }),
      eliminar: vi.fn().mockResolvedValue({ ok: true }),
      getColaRevision: vi.fn(),
      resolverFila: vi.fn(),
      descartarFila: vi.fn(),
      actualizarFila: vi.fn(),
      seleccionarArchivo: vi.fn(),
    },
    dialog: { seleccionarArchivoImportCosto: vi.fn() },
  };
}

// followup ADR-051: el wizard vive en un Context montado por encima de la ruta — hay
// que envolver con el Provider igual que hace App.tsx, si no el hook explota.
function renderView() {
  return render(
    <MemoryRouter>
      <ImportacionCostoWizardProvider>
        <ImportarCostosView />
      </ImportacionCostoWizardProvider>
    </MemoryRouter>,
  );
}

describe('ImportarCostosView — paso 1', () => {
  beforeEach(() => { mockFerreteria(); });

  it('muestra la mini-preview de la plantilla ANTES que la zona de selección de archivo (ADR-051 A.1)', async () => {
    renderView();
    const formatoEsperado = await screen.findByText(/columnas esperadas/i);
    const selector = screen.getByRole('button', { name: /seleccionar archivo csv o xlsx/i });
    // eslint-disable-next-line no-bitwise
    const posicion = formatoEsperado.compareDocumentPosition(selector);
    // eslint-disable-next-line no-bitwise
    expect(posicion & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('la mini-preview muestra la cabecera esperada con los 3 identificadores y solo COSTO obligatorio', async () => {
    renderView();
    await screen.findByText(/columnas esperadas/i);
    expect(screen.getByText('COD_PRODUCTO_PROV')).toBeDefined();
    expect(screen.getByText('EAN')).toBeDefined();
    expect(screen.getByText('COD_INTERNO')).toBeDefined();
    expect(screen.getByText('DESCRIPCION')).toBeDefined();
    expect(screen.getByText('COSTO')).toBeDefined();
    expect(screen.getByText(/obligatorio/i)).toBeDefined();
  });

  it('el selector de proveedor no ocupa todo el ancho del panel', async () => {
    renderView();
    await screen.findByText(/columnas esperadas/i);
    const select = screen.getByRole('combobox');
    expect(select.parentElement?.getAttribute('style') ?? '').toMatch(/max-width/i);
  });

  it('no hay ninguna zona de arrastrar-y-soltar — solo selección por explorador (drag&drop sacado)', async () => {
    renderView();
    await screen.findByText(/columnas esperadas/i);
    expect(screen.queryByText(/arrastrá/i)).toBeNull();
    const selector = screen.getByRole('button', { name: /seleccionar archivo csv o xlsx/i });
    fireEvent.click(selector);
    expect((window as any).ferreteria.dialog.seleccionarArchivoImportCosto).toHaveBeenCalled();
  });
});

const PREVIEW_MOCK = {
  filas: [
    {
      fila_num: 2, codigo_proveedor_archivo: 'PT-001', gtin_archivo: null,
      producto_id: 'prod-1', nombre_producto: 'Tornillo 4x40',
      costo_anterior_centavos: 10000, costo_nuevo_centavos: 25000,
      estado: 'matched', matched_by: 'codigo_proveedor', motivo: null,
      datos: { COD_PRODUCTO_PROV: 'PT-001', COSTO: '250.00', EAN: '', DESCRIPCION: 'Tornillo' },
    },
    {
      fila_num: 3, codigo_proveedor_archivo: 'PT-002', gtin_archivo: null,
      producto_id: 'prod-2', nombre_producto: 'Soldadura',
      costo_anterior_centavos: 89000, costo_nuevo_centavos: null,
      estado: 'error_formato', matched_by: 'codigo_proveedor', motivo: 'Costo no es un número válido',
      datos: { COD_PRODUCTO_PROV: 'PT-002', COSTO: 'consultar', EAN: '', DESCRIPCION: 'Soldadura MIG' },
    },
    {
      fila_num: 4, codigo_proveedor_archivo: 'PT-450', gtin_archivo: '7798000009911',
      producto_id: null, nombre_producto: null,
      costo_anterior_centavos: null, costo_nuevo_centavos: 6500,
      estado: 'sin_matchear', matched_by: null, motivo: 'Sin identificar — revisar en Cola de Revisión',
      datos: { COD_PRODUCTO_PROV: 'PT-450', COSTO: '65', EAN: '7798000009911', DESCRIPCION: 'Bulón' },
    },
  ],
  total_matcheadas: 1,
  total_sin_match: 1,
};

async function llegarAlPreview() {
  (window as any).ferreteria.importacionCosto.parseArchivo.mockResolvedValue(PREVIEW_MOCK);
  (window as any).ferreteria.dialog.seleccionarArchivoImportCosto.mockResolvedValue('/tmp/costos.csv');
  const utils = renderView();
  await screen.findByText(/columnas esperadas/i);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'p1' } });
  fireEvent.click(screen.getByRole('button', { name: /seleccionar archivo csv o xlsx/i }));
  await screen.findByText('/tmp/costos.csv');
  fireEvent.click(screen.getByText('Siguiente →'));
  await screen.findByText(/identificados/i);
  return utils;
}

describe('ImportarCostosView — formato fijo, sin pantalla de mapeo (followup ADR-051)', () => {
  beforeEach(() => { mockFerreteria(); });

  it('"Siguiente" parsea directo, sin llamar a nada de configuración de columnas', async () => {
    await llegarAlPreview();
    expect((window as any).ferreteria.importacionCosto.parseArchivo).toHaveBeenCalledWith({
      filePath: '/tmp/costos.csv', proveedorId: 'p1',
    });
    expect(screen.queryByLabelText(/columna de costo/i)).toBeNull();
  });

  it('muestra el nombre y código del proveedor arriba una vez que se avanza del paso 1', async () => {
    await llegarAlPreview();
    expect(screen.getByText('Prov Uno')).toBeDefined();
    expect(screen.getByText('PROV-0001')).toBeDefined();
  });
});

describe('ImportarCostosView — consultar productos', () => {
  beforeEach(() => { mockFerreteria(); });

  it('abre un modal de búsqueda de productos con SKU, EAN, código de proveedor y descripción', async () => {
    (window as any).ferreteria.importacionCosto.buscarProductos.mockResolvedValue([
      { id: 'prod-9', sku: 'P-0000009-1', gtin_barcode: '7791111111111', nombre_corto: 'Martillo', codigo_proveedor: 'MART-99' },
    ]);
    await llegarAlPreview();
    fireEvent.click(screen.getByText('Consultar productos'));
    const modal = within(screen.getByRole('dialog', { name: /consultar productos/i }));
    fireEvent.change(modal.getByPlaceholderText(/nombre, sku o ean/i), { target: { value: 'Martillo' } });
    expect(await modal.findByText('P-0000009-1')).toBeDefined();
    expect(modal.getByText('7791111111111')).toBeDefined();
    expect(modal.getByText('MART-99')).toBeDefined();
    expect(modal.getByText('Martillo')).toBeDefined();
    // se busca scoped al proveedor de la carga
    expect((window as any).ferreteria.importacionCosto.buscarProductos).toHaveBeenCalledWith({
      proveedorId: 'p1', busqueda: 'Martillo',
    });
  });
});

describe('ImportarCostosView — paso 2 (preview editable)', () => {
  beforeEach(() => { mockFerreteria(); });

  it('muestra columnas en orden: Línea primero, datos en el medio, Estado al final', async () => {
    await llegarAlPreview();
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers[0]).toMatch(/línea/i);
    expect(headers[headers.length - 1]).toMatch(/estado/i);
    // cabeceras largas renombradas para ganar ancho (COD_PRODUCTO_PROV → COD_PROD_PROV)
    expect(headers).toEqual(expect.arrayContaining(['COD_PROD_PROV', 'COSTO', 'EAN', 'DESCRIPCION']));
  });

  it('muestra las 3 filas con sus 3 estados distintos', async () => {
    await llegarAlPreview();
    expect(screen.getByText('Tornillo 4x40')).toBeDefined();
    expect(screen.getByText(/costo no es un número válido/i)).toBeDefined();
    expect(screen.getByText(/sin identificar — revisar en cola de revisión/i)).toBeDefined();
  });

  it('chips de filtro: clickear "Error de formato" muestra solo esa fila', async () => {
    await llegarAlPreview();
    fireEvent.click(screen.getByRole('button', { name: /error de formato/i }));
    expect(screen.queryByText('Tornillo 4x40')).toBeNull();
    expect(screen.getByText(/costo no es un número válido/i)).toBeDefined();
  });

  it('editar la celda COSTO llama a revalidarFila y actualiza la fila con el resultado del backend', async () => {
    (window as any).ferreteria.importacionCosto.revalidarFila.mockResolvedValue({
      producto_id: 'prod-2', nombre_producto: 'Soldadura',
      costo_anterior_centavos: 89000, costo_nuevo_centavos: 30000,
      estado: 'matched', matched_by: 'codigo_proveedor', motivo: null,
      codigo_proveedor_archivo: 'PT-002', gtin_archivo: null, codigo_interno_archivo: null,
    });
    await llegarAlPreview();
    const celda = screen.getByText('consultar');
    celda.textContent = '300.00';
    fireEvent.blur(celda);
    expect((window as any).ferreteria.importacionCosto.revalidarFila).toHaveBeenCalledWith({
      proveedorId: 'p1',
      datos: { COD_PRODUCTO_PROV: 'PT-002', COSTO: '300.00', EAN: '', DESCRIPCION: 'Soldadura MIG' },
    });
    await screen.findByText('300.00');
    expect(screen.queryByText(/costo no es un número válido/i)).toBeNull();
  });

  it('editar el EAN de una fila sin_matchear la re-identifica (fix del bug reportado)', async () => {
    (window as any).ferreteria.importacionCosto.revalidarFila.mockResolvedValue({
      producto_id: 'prod-1', nombre_producto: 'Tornillo 4x40',
      costo_anterior_centavos: 10000, costo_nuevo_centavos: 6500,
      estado: 'matched', matched_by: 'gtin', motivo: null,
      codigo_proveedor_archivo: 'PT-450', gtin_archivo: '7791234567890', codigo_interno_archivo: null,
    });
    await llegarAlPreview();
    // la fila 4 (Bulón) es sin_matchear; corrijo su EAN por uno válido
    const celda = screen.getByText('7798000009911');
    celda.textContent = '7791234567890';
    fireEvent.blur(celda);
    await waitFor(() => {
      expect((window as any).ferreteria.importacionCosto.revalidarFila).toHaveBeenCalled();
    });
    // deja de estar sin identificar — ahora aparece el nombre del producto matcheado
    expect(await screen.findAllByText('Tornillo 4x40')).toBeDefined();
  });
});

describe('ImportarCostosView — advertencias (validación cruzada + duplicados)', () => {
  beforeEach(() => { mockFerreteria(); });

  async function llegarConPreview(preview: any) {
    (window as any).ferreteria.importacionCosto.parseArchivo.mockResolvedValue(preview);
    (window as any).ferreteria.dialog.seleccionarArchivoImportCosto.mockResolvedValue('/tmp/costos.csv');
    renderView();
    await screen.findByText(/columnas esperadas/i);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: /seleccionar archivo csv o xlsx/i }));
    await screen.findByText('/tmp/costos.csv');
    fireEvent.click(screen.getByText('Siguiente →'));
    await screen.findByText(/identificados/i);
  }

  it('muestra la advertencia de código cruzado que viene del backend', async () => {
    await llegarConPreview({
      filas: [{
        fila_num: 2, codigo_proveedor_archivo: 'OTRO', gtin_archivo: '7791234567890',
        codigo_interno_archivo: null, producto_id: 'prod-1', nombre_producto: 'Tornillo 4x40',
        costo_anterior_centavos: 10000, costo_nuevo_centavos: 25000, estado: 'matched',
        matched_by: 'gtin', motivo: null,
        advertencia: 'El código del producto no coincide con el guardado para este proveedor — ¿es la lista correcta?',
        datos: { EAN: '7791234567890', COD_PRODUCTO_PROV: 'OTRO', COSTO: '250' },
      }],
      total_matcheadas: 1, total_sin_match: 0,
    });
    expect(screen.getAllByText(/no coincide con el guardado/i).length).toBeGreaterThan(0);
  });

  it('marca como duplicado cuando dos filas apuntan al mismo producto', async () => {
    await llegarConPreview({
      filas: [
        {
          fila_num: 2, codigo_proveedor_archivo: 'PT-001', gtin_archivo: null, codigo_interno_archivo: null,
          producto_id: 'prod-1', nombre_producto: 'Tornillo 4x40', costo_anterior_centavos: 10000,
          costo_nuevo_centavos: 25000, estado: 'matched', matched_by: 'codigo_proveedor', motivo: null,
          advertencia: null, datos: { COD_PRODUCTO_PROV: 'PT-001', COSTO: '250' },
        },
        {
          fila_num: 3, codigo_proveedor_archivo: 'PT-001', gtin_archivo: null, codigo_interno_archivo: null,
          producto_id: 'prod-1', nombre_producto: 'Tornillo 4x40', costo_anterior_centavos: 10000,
          costo_nuevo_centavos: 30000, estado: 'matched', matched_by: 'codigo_proveedor', motivo: null,
          advertencia: null, datos: { COD_PRODUCTO_PROV: 'PT-001', COSTO: '300' },
        },
      ],
      total_matcheadas: 2, total_sin_match: 0,
    });
    expect(screen.getByText(/1 producto duplicado/i)).toBeDefined();
    expect(screen.getAllByText(/producto duplicado en el archivo/i).length).toBeGreaterThan(0);
  });
});

describe('ImportarCostosView — modal de confirmación (A.3)', () => {
  beforeEach(() => { mockFerreteria(); });

  it('clickear Confirmar abre el modal en vez de aplicar directo', async () => {
    await llegarAlPreview();
    fireEvent.click(screen.getByText(/confirmar \(1 productos\)/i));
    expect(await screen.findByText(/confirmar importación/i)).toBeDefined();
    expect((window as any).ferreteria.importacionCosto.confirmar).not.toHaveBeenCalled();
  });

  it('el modal muestra proveedor, cantidad e irreversibilidad', async () => {
    await llegarAlPreview();
    fireEvent.click(screen.getByText(/confirmar \(1 productos\)/i));
    await screen.findByText(/confirmar importación/i);
    const modal = within(screen.getByRole('dialog', { name: /confirmar importación/i }));
    expect(modal.getByText(/Prov Uno/)).toBeDefined();
    expect(modal.getByText(/1.*producto/i)).toBeDefined();
    expect(modal.getByText(/no se puede deshacer/i)).toBeDefined();
  });

  it('Cancelar en el modal vuelve al preview sin aplicar', async () => {
    await llegarAlPreview();
    fireEvent.click(screen.getByText(/confirmar \(1 productos\)/i));
    await screen.findByText(/confirmar importación/i);
    const modal = within(screen.getByRole('dialog', { name: /confirmar importación/i }));
    fireEvent.click(modal.getByRole('button', { name: /^cancelar$/i }));
    expect(screen.queryByText(/confirmar importación/i)).toBeNull();
    expect((window as any).ferreteria.importacionCosto.confirmar).not.toHaveBeenCalled();
  });

  it('Confirmar en el modal envía proveedorId, nombreArchivo y las filas editadas', async () => {
    (window as any).ferreteria.importacionCosto.confirmar.mockResolvedValue({ ok: true, importacion_id: 'imp-1', filas_actualizadas: 1, batches: [] });
    await llegarAlPreview();
    fireEvent.click(screen.getByText(/confirmar \(1 productos\)/i));
    await screen.findByText(/confirmar importación/i);
    const modal = within(screen.getByRole('dialog', { name: /confirmar importación/i }));
    fireEvent.click(modal.getByRole('button', { name: /^confirmar$/i }));
    await screen.findByText(/importación aplicada/i);
    expect((window as any).ferreteria.importacionCosto.confirmar).toHaveBeenCalledWith({
      proveedorId: 'p1', nombreArchivo: 'costos.csv', filas: expect.any(Array),
    });
  });
});

async function confirmarImportacion() {
  (window as any).ferreteria.importacionCosto.confirmar.mockResolvedValue({ ok: true, importacion_id: 'imp-1', filas_actualizadas: 1, batches: [] });
  fireEvent.click(screen.getByText(/confirmar \(1 productos\)/i));
  await screen.findByText(/confirmar importación/i);
  const modal = within(screen.getByRole('dialog', { name: /confirmar importación/i }));
  fireEvent.click(modal.getByRole('button', { name: /^confirmar$/i }));
  await screen.findByText(/importación aplicada/i);
}

describe('ImportarCostosView — paso 3 (resultado, A.5)', () => {
  beforeEach(() => { mockFerreteria(); });

  it('muestra chips Actualizados/Rechazados/Sin matchear y una tabla única con las 3 filas', async () => {
    await llegarAlPreview();
    await confirmarImportacion();
    expect(screen.getByText(/actualizados \(1\)/i)).toBeDefined();
    expect(screen.getByText(/rechazados \(1\)/i)).toBeDefined();
    expect(screen.getByText(/sin matchear \(1\)/i)).toBeDefined();
    expect(screen.getByText('Tornillo 4x40')).toBeDefined();
  });

  it('clickear el chip Rechazados filtra la tabla a solo esa fila', async () => {
    await llegarAlPreview();
    await confirmarImportacion();
    fireEvent.click(screen.getByText(/rechazados \(1\)/i));
    expect(screen.queryByText('Tornillo 4x40')).toBeNull();
    expect(screen.getByText(/costo no es un número válido/i)).toBeDefined();
  });

  it('la descarga CSV usa el filtro activo (parametrizada, no un botón fijo)', async () => {
    await llegarAlPreview();
    await confirmarImportacion();
    const createObjectURL = vi.fn().mockReturnValue('blob:x');
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = vi.fn();
    fireEvent.click(screen.getByText(/rechazados \(1\)/i));
    fireEvent.click(screen.getByText(/descargar/i));
    expect(createObjectURL).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain('PT-002');
    expect(text).not.toContain('PT-001');
  });

  it('no hay botón Atrás/Volver en el paso 3', async () => {
    await llegarAlPreview();
    await confirmarImportacion();
    expect(screen.queryByText(/^volver$/i)).toBeNull();
    expect(screen.queryByText(/^atrás$/i)).toBeNull();
  });
});

describe('ImportarCostosView — cancelar (followup ADR-051: instantáneo, sin IPC)', () => {
  beforeEach(() => { mockFerreteria(); });

  it('clickear Cancelar en el preview vuelve a selección sin llamar a ningún IPC', async () => {
    await llegarAlPreview();
    fireEvent.click(screen.getByText(/^cancelar$/i));
    expect(await screen.findByText(/columnas esperadas/i)).toBeDefined();
    // nada que cancelar en la base — nunca se persistió nada antes de Confirmar.
    expect((window as any).ferreteria.importacionCosto.cancelar).not.toHaveBeenCalled();
  });
});

/** Simula la navegación real: un solo Provider por encima, ImportarCostosView se
 * desmonta y remonta como lo haría al cambiar de ruta y volver (ver App.tsx). */
function WrapperConNavegacion() {
  const [otraPantalla, setOtraPantalla] = useState(false);
  return (
    <MemoryRouter>
      <ImportacionCostoWizardProvider>
        <button type="button" onClick={() => setOtraPantalla(o => !o)}>ir a otra pantalla</button>
        {otraPantalla ? <div>Otra pantalla del menú</div> : <ImportarCostosView />}
      </ImportacionCostoWizardProvider>
    </MemoryRouter>
  );
}

describe('ImportarCostosView — Previsualizar persiste al navegar (followup ADR-051)', () => {
  beforeEach(() => { mockFerreteria(); });

  it('navegar a otra pantalla y volver mantiene el paso Previsualizar y las filas, sin volver a parsear', async () => {
    (window as any).ferreteria.importacionCosto.parseArchivo.mockResolvedValue(PREVIEW_MOCK);
    (window as any).ferreteria.dialog.seleccionarArchivoImportCosto.mockResolvedValue('/tmp/costos.csv');
    render(<WrapperConNavegacion />);
    await screen.findByText(/columnas esperadas/i);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: /seleccionar archivo csv o xlsx/i }));
    await screen.findByText('/tmp/costos.csv');
    fireEvent.click(screen.getByText('Siguiente →'));
    await screen.findByText('Tornillo 4x40');

    // navega a "otra pantalla" (desmonta ImportarCostosView) y vuelve
    fireEvent.click(screen.getByText('ir a otra pantalla'));
    expect(await screen.findByText('Otra pantalla del menú')).toBeDefined();
    fireEvent.click(screen.getByText('ir a otra pantalla'));

    // sigue en Previsualizar, con la misma fila — no volvió al paso 1 ni se reseteó
    expect(await screen.findByText('Tornillo 4x40')).toBeDefined();
    expect((window as any).ferreteria.importacionCosto.parseArchivo).toHaveBeenCalledTimes(1);
  });

  it('no llama a cancelar ni a eliminar al desmontar (nada de auto-cancelado)', async () => {
    const utils = await llegarAlPreview();
    utils.unmount();
    expect((window as any).ferreteria.importacionCosto.cancelar).not.toHaveBeenCalled();
    expect((window as any).ferreteria.importacionCosto.eliminar).not.toHaveBeenCalled();
  });
});

describe('ImportarCostosView — sugerencias inline por similitud (paridad con Importar Catálogo)', () => {
  beforeEach(() => { mockFerreteria(); });

  const PREVIEW_CON_CANDIDATOS = {
    filas: [{
      fila_num: 1, codigo_proveedor_archivo: 'ZZZ', gtin_archivo: null, codigo_interno_archivo: null,
      producto_id: null, nombre_producto: null,
      costo_anterior_centavos: null, costo_nuevo_centavos: 12000,
      estado: 'sin_matchear', matched_by: null, motivo: 'Sin identificar — revisar en Cola de Revisión',
      advertencia: null,
      nombre_producto_archivo: 'Aceite multiuso 100 cm TF3',
      candidatos: [{ producto_id: 'prod-27', sku: 'P-0000027-9', nombre_corto: 'Aceite multiuso 100', score: 0.57 }],
      datos: { COD_PRODUCTO_PROV: 'ZZZ', COSTO: '120', DESCRIPCION: 'Aceite multiuso 100 cm TF3' },
    }],
    total_matcheadas: 0, total_sin_match: 1,
  };

  async function llegar(preview: any) {
    (window as any).ferreteria.importacionCosto.parseArchivo.mockResolvedValue(preview);
    (window as any).ferreteria.dialog.seleccionarArchivoImportCosto.mockResolvedValue('/tmp/costos.csv');
    renderView();
    await screen.findByText(/columnas esperadas/i);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: /seleccionar archivo csv o xlsx/i }));
    await screen.findByText('/tmp/costos.csv');
    fireEvent.click(screen.getByText('Siguiente →'));
    await screen.findByText(/identificados/i);
  }

  it('una fila sin identificar ofrece el candidato con botón Asignar, su SKU y su score', async () => {
    await llegar(PREVIEW_CON_CANDIDATOS);
    expect(screen.getByText('Aceite multiuso 100')).toBeDefined();
    expect(screen.getByRole('button', { name: /asignar/i })).toBeDefined();
    // el SKU se muestra como referencia para elegir el producto
    expect(screen.getByText('P-0000027-9')).toBeDefined();
    expect(screen.getByText('57%')).toBeDefined();
  });

  it('al Asignar, la fila pasa a identificada (badge ~sim) y Confirmar cuenta 1 producto', async () => {
    await llegar(PREVIEW_CON_CANDIDATOS);
    fireEvent.click(screen.getByRole('button', { name: /asignar/i }));
    expect(await screen.findByText('~sim')).toBeDefined();
    expect(screen.getByRole('button', { name: /confirmar \(1 productos\)/i })).toBeDefined();
    // ya no queda el botón Asignar (la fila salió de sin_matchear)
    expect(screen.queryByRole('button', { name: /asignar/i })).toBeNull();
  });

  const PREVIEW_MIXTO = {
    filas: [
      { fila_num: 1, codigo_proveedor_archivo: 'PT-001', gtin_archivo: null, codigo_interno_archivo: null,
        producto_id: 'prod-1', nombre_producto: 'Tornillo 4x40', costo_anterior_centavos: 10000, costo_nuevo_centavos: 25000,
        estado: 'matched', matched_by: 'codigo_proveedor', motivo: null, advertencia: null,
        nombre_producto_archivo: 'Tornillo', candidatos: [],
        datos: { COD_PRODUCTO_PROV: 'PT-001', COD_INTERNO: '', DESCRIPCION: 'Tornillo', COSTO: '250' } },
      { fila_num: 2, codigo_proveedor_archivo: 'ZZZ', gtin_archivo: null, codigo_interno_archivo: null,
        producto_id: null, nombre_producto: null, costo_anterior_centavos: null, costo_nuevo_centavos: 12000,
        estado: 'sin_matchear', matched_by: null, motivo: 'Sin identificar', advertencia: null,
        nombre_producto_archivo: 'Aceite multiuso 100 cm TF3',
        candidatos: [{ producto_id: 'prod-27', sku: 'P-0000027-9', nombre_corto: 'Aceite multiuso 100', score: 0.57 }],
        datos: { COD_PRODUCTO_PROV: 'ZZZ', COD_INTERNO: '', DESCRIPCION: 'Aceite multiuso 100 cm TF3', COSTO: '120' } },
      { fila_num: 3, codigo_proveedor_archivo: 'WWW', gtin_archivo: null, codigo_interno_archivo: null,
        producto_id: null, nombre_producto: null, costo_anterior_centavos: null, costo_nuevo_centavos: 5000,
        estado: 'sin_matchear', matched_by: null, motivo: 'Sin identificar', advertencia: null,
        nombre_producto_archivo: 'Cosa rara sin match', candidatos: [],
        datos: { COD_PRODUCTO_PROV: 'WWW', COD_INTERNO: '', DESCRIPCION: 'Cosa rara sin match', COSTO: '50' } },
    ],
    total_matcheadas: 1, total_sin_match: 2,
  };

  it('el filtro "Con sugerencia" muestra sólo las filas sin identificar que tienen candidatos', async () => {
    await llegar(PREVIEW_MIXTO);
    fireEvent.click(screen.getByRole('button', { name: /con sugerencia \(1\)/i }));
    // queda la fila con candidato…
    expect(screen.getByText('Aceite multiuso 100')).toBeDefined();
    // …y no la sin_matchear sin candidatos ni la matcheada
    expect(screen.queryByText('Cosa rara sin match')).toBeNull();
    expect(screen.queryByText('Tornillo 4x40')).toBeNull();
  });

  it('renombra las cabeceras largas: COD_PROD_PROV y SKU INT', async () => {
    await llegar(PREVIEW_MIXTO);
    expect(screen.getByRole('columnheader', { name: 'COD_PROD_PROV' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'SKU INT' })).toBeDefined();
    // no debe quedar la cabecera larga original
    expect(screen.queryByRole('columnheader', { name: 'COD_PRODUCTO_PROV' })).toBeNull();
  });
});
