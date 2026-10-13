import QRCode from 'qrcode';
import { crearImpresorHtml } from '@core/main';
import type { BrowserWindow as BrowserWindowType } from 'electron';
import type { IPrintService, ProductLabelData, LocationLabelData, PrintFormat } from './types';

type BrowserWindowFactory = () => BrowserWindowType;

export class ElectronPrintService implements IPrintService {
  constructor(private readonly createWindow: BrowserWindowFactory) {}

  async printProductLabel(data: ProductLabelData, format: PrintFormat): Promise<void> {
    const qrDataUrl = await QRCode.toDataURL(data.codigoQr);
    await this.printRawHtml(this.buildProductHtml(data, qrDataUrl, format));
  }

  async printLocationLabel(data: LocationLabelData, format: PrintFormat): Promise<void> {
    const qrDataUrl = await QRCode.toDataURL(data.codigoQr);
    await this.printRawHtml(this.buildLocationHtml(data, qrDataUrl));
  }

  async printRawHtml(html: string): Promise<void> {
    await crearImpresorHtml(this.createWindow)(html);
  }

  private buildProductHtml(data: ProductLabelData, qrDataUrl: string, format: PrintFormat): string {
    const size = format === 'label'
      ? 'width:62mm;height:29mm'
      : 'width:100mm;height:50mm;display:inline-block;margin:2mm';
    return `<!DOCTYPE html><html><body style="margin:0;padding:0">
      <div style="${size};display:flex;align-items:center;gap:4px;border:1px solid #ccc">
        <img src="${qrDataUrl}" style="width:25mm;height:25mm"/>
        <div style="font-size:8pt;font-family:sans-serif">
          <div style="font-weight:bold">${data.nombre}</div>
          <div>SKU: ${data.sku}</div>
          <div>$ ${data.precio}</div>
        </div>
      </div></body></html>`;
  }

  private buildLocationHtml(data: LocationLabelData, qrDataUrl: string): string {
    return `<!DOCTYPE html><html><body style="margin:0;padding:0">
      <div style="width:62mm;height:29mm;display:flex;align-items:center;gap:4px">
        <img src="${qrDataUrl}" style="width:25mm;height:25mm"/>
        <div style="font-size:8pt;font-family:sans-serif">
          <div style="font-weight:bold">${data.codigo}</div>
          <div>${data.descripcion}</div>
        </div>
      </div></body></html>`;
  }
}
