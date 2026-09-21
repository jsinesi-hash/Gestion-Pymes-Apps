export interface IPrintService {
  printProductLabel(data: ProductLabelData, format: PrintFormat): Promise<void>;
  printLocationLabel(data: LocationLabelData, format: PrintFormat): Promise<void>;
  printRawHtml(html: string): Promise<void>;
}

export type PrintFormat = 'label' | 'a4';

export interface ProductLabelData {
  codigoQr: string;
  nombre: string;
  sku: string;
  precio: string;
}

export interface LocationLabelData {
  codigoQr: string;
  codigo: string;
  descripcion: string;
}
