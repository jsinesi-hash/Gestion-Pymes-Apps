export type BarcodeTipo = 'code128' | 'qr';

export type PerfilEtiqueta = {
  id: string;
  nombre: string;
  tipo: 'hoja' | 'rollo';
  ancho_mm: number;
  alto_mm: number;
  cols?: number;
  filas?: number;
  margen_mm?: number;
  gap_mm?: number;
  barcode_tipo: BarcodeTipo;
};

export type EtiquetaItem = {
  producto_id: string;
  sku: string;
  nombre: string;
  precio_venta_lista_centavos: number;
  gtin_barcode: string | null;
};

export type CeldaLayout = {
  pagina: number;
  x_mm: number;
  y_mm: number;
  ancho_mm: number;
  alto_mm: number;
  item: EtiquetaItem;
};
