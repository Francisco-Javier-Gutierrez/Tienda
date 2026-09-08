import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';
import { VentaDetalle } from '../models/venta';
import { ImagenesService } from './imagenes.service';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly imagenes = inject(ImagenesService);

  private async crear(v: VentaDetalle): Promise<jsPDF> {
    const altoCalculado =
      (v.logoSuc ? 24 : 0) +
      68 +
      (v.estado === 'CANCELADA' ? 8 : 0) +
      v.items.length * 9 +
      (v.metodoPago === 'EFECTIVO' ? 10 : 0) +
      16;
    const alto = Math.max(130, Math.ceil(altoCalculado));
    const doc = new jsPDF({ unit: 'mm', format: [80, alto] });
    doc.setFont('courier', 'normal');

    let y = 7;
    if (v.logoSuc) {
      try {
        const ruta = this.imagenes.resolver(v.logoSuc);
        if (ruta) {
          const response = await fetch(ruta);
          if (!response.ok) throw new Error('Logo no disponible');
          const blob = await response.blob();
          const data = await this.blobDataUrl(blob);
          const formato = blob.type.includes('png') ? 'PNG' : blob.type.includes('webp') ? 'WEBP' : 'JPEG';
          doc.addImage(data, formato, 33, 4, 14, 14);
          y = 21;
        }
      } catch {
        /* El ticket sigue siendo válido si el logo remoto no está disponible. */
      }
    }

    const lineaDivisoria = () => {
      doc.setDrawColor(120, 120, 120);
      doc.setLineDashPattern([1.2, 1.2], 0);
      doc.line(4, y, 76, y);
      y += 4;
    };

    // Encabezado tienda
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.text(v.sucursal || v.nombreSuc || 'Tienda de abarrotes', 40, y, { align: 'center', maxWidth: 72 });
    y += 5;

    lineaDivisoria();

    // Título comprobante
    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.text('COMPROBANTE DE COMPRA', 40, y, { align: 'center' });
    y += 4.5;

    if (v.estado === 'CANCELADA') {
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.text('*** VENTA CANCELADA ***', 40, y, { align: 'center' });
      y += 5;
    }

    // Folio, fecha, hora y cajero
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Folio: ${v.id}`, 40, y, { align: 'center' });
    y += 4;
    doc.text(`${v.fecha} · ${v.hora}`, 40, y, { align: 'center' });
    y += 4;
    const nombreCajero = typeof v.cajero === 'object' && v.cajero !== null ? v.cajero.nombre : v.cajero;
    doc.text(`Cajero: ${nombreCajero || 'Cajero'}`, 40, y, { align: 'center' });
    y += 4.5;

    lineaDivisoria();

    // Artículos
    for (const item of v.items) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.text(`${item.cantidad} × ${item.nombre}`, 4, y, { maxWidth: 50 });
      doc.setFont('courier', 'bold');
      doc.text(this.moneda(item.subtotal), 76, y, { align: 'right' });
      y += 4;

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text(`  ${this.moneda(item.precioUnitario)} c/u`, 4, y);
      doc.setTextColor(0, 0, 0);
      y += 4.5;
    }

    lineaDivisoria();

    // Total
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL', 4, y);
    doc.text(this.moneda(v.total), 76, y, { align: 'right' });
    y += 5.5;

    // Métodos de pago
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.text(`Pago: ${v.metodoPago}`, 4, y);
    y += 4;
    if (v.metodoPago === 'EFECTIVO') {
      doc.text(`Recibido: ${this.moneda(v.montoRecibido || 0)}`, 4, y);
      y += 4;
      doc.text(`Cambio: ${this.moneda(v.cambio)}`, 4, y);
      y += 4;
    }

    lineaDivisoria();

    // Pie de página
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.text('Gracias por su compra', 40, y, { align: 'center' });
    y += 4;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.text('Comprobante no fiscal', 40, y, { align: 'center' });

    return doc;
  }

  async descargar(v: VentaDetalle): Promise<void> {
    const doc = await this.crear(v),
      nombre = `ticket-${v.id}.pdf`;
    if (Capacitor.isNativePlatform()) {
      const data = doc.output('datauristring').split(',')[1];
      await Filesystem.writeFile({ path: nombre, data, directory: Directory.Cache });
      return;
    }
    doc.save(nombre);
  }
  async compartir(v: VentaDetalle): Promise<void> {
    const doc = await this.crear(v),
      nombre = `ticket-${v.id}.pdf`;
    if (!Capacitor.isNativePlatform()) {
      doc.save(nombre);
      return;
    }
    const data = doc.output('datauristring').split(',')[1];
    const file = await Filesystem.writeFile({ path: nombre, data, directory: Directory.Cache });
    await Share.share({ title: `Comprobante ${v.id}`, files: [file.uri] });
  }
  imprimir(): void {
    window.print();
  }
  private blobDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  private moneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(valor));
  }
}
