import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstadoPedidoCliente, PedidoCliente } from '../models/pedido-cliente';
import { ImagenesService } from '../services/imagenes.service';
import { PedidosClienteService } from '../services/pedidos-cliente.service';
import { DialogService } from '../services/dialog.service';

@Component({
  selector: 'app-pedido-detalle',
  templateUrl: './pedido-detalle.page.html',
  styleUrls: ['./pedido-detalle.page.scss'],
  standalone: false,
})
export class PedidoDetallePage implements OnInit {
  pedido: PedidoCliente | null = null;
  cargando = true;
  procesando = false;
  archivo: File | null = null;
  comprobanteImgError = false;
  private readonly api = inject(PedidosClienteService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);
  private readonly dialog = inject(DialogService);
  private readonly imagenes = inject(ImagenesService);
  ngOnInit(): void {
    void this.cargar();
  }
  imagen(ruta: string | null): string | null {
    return this.imagenes.resolver(ruta);
  }
  etiqueta(estado: EstadoPedidoCliente): string {
    return (
      {
        PENDIENTE_PAGO: 'Pendiente de pago',
        EN_REVISION: 'Pago en revisión',
        PAGADO: 'Pago aprobado',
        RECHAZADO: 'Pago rechazado',
        CANCELADO: 'Cancelado',
        EXPIRADO: 'Reserva expirada',
        LISTO: 'Listo para recoger',
        ENTREGADO: 'Entregado',
      } as Record<EstadoPedidoCliente, string>
    )[estado];
  }
  seleccionarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] || null;
    if (
      !archivo ||
      !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(archivo.type) ||
      archivo.size > 5 * 1024 * 1024
    ) {
      this.archivo = null;
      input.value = '';
      void this.feedback('Selecciona una imagen JPG, PNG, WEBP o un PDF de máximo 5 MB.', 'warning');
      return;
    }
    this.archivo = archivo;
  }
  async subir(): Promise<void> {
    if (!this.pedido || !this.archivo || this.procesando) return;
    this.procesando = true;
    try {
      this.pedido = await firstValueFrom(this.api.subirComprobante(this.pedido.id, this.archivo));
      this.archivo = null;
      await this.feedback('Pago enviado a revisión.', 'success');
    } catch (e: unknown) {
      await this.feedback(this.error(e, 'No pudimos subir el comprobante.'), 'danger');
    } finally {
      this.procesando = false;
    }
  }
  async confirmarCancelar(): Promise<void> {
    if (!this.pedido || this.procesando) return;
    const confirmado = await this.dialog.confirm({
      title: 'Cancelar pedido',
      message: 'Los productos reservados volverán al inventario. ¿Deseas continuar?',
      type: 'danger',
      icon: 'cancel',
      confirmText: 'Cancelar pedido',
      cancelText: 'Conservar',
    });
    if (confirmado) {
      void this.cancelar();
    }
  }
  async cancelar(): Promise<void> {
    if (!this.pedido) return;
    this.procesando = true;
    try {
      this.pedido = await firstValueFrom(this.api.cancelar(this.pedido.id));
      await this.feedback('Pedido cancelado. Los productos volvieron al inventario.', 'success');
    } catch (e: unknown) {
      await this.feedback(this.error(e, 'No pudimos cancelar el pedido.'), 'danger');
      await this.cargar();
    } finally {
      this.procesando = false;
    }
  }
  esImagenComprobante(): boolean {
    if (!this.pedido?.tieneComprobante) return false;
    const mime = this.pedido.comprobante?.mime?.toLowerCase() || '';
    if (mime.includes('pdf')) return false;
    if (mime.startsWith('image/')) return true;
    const url = (this.pedido.comprobanteUrl || this.pedido.comprobante?.nombre || '').toLowerCase();
    if (url.includes('.pdf')) return false;
    return true;
  }

  onComprobanteImgError(): void {
    this.comprobanteImgError = true;
  }

  async verComprobante(): Promise<void> {
    if (this.pedido?.comprobanteUrl) {
      window.open(this.pedido.comprobanteUrl, '_blank');
      return;
    }
    if (!this.pedido?.tieneComprobante) return;
    const ventana = window.open('', '_blank');
    if (ventana) ventana.opener = null;
    try {
      const blob = await firstValueFrom(this.api.obtenerComprobante(this.pedido.id));
      if (!(blob instanceof Blob) || blob.size === 0) throw new Error('COMPROBANTE_VACIO');
      const blobUrl = URL.createObjectURL(blob);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
      if (ventana && !ventana.closed) ventana.location.href = blobUrl;
      else {
        const enlace = document.createElement('a');
        enlace.href = blobUrl;
        enlace.target = '_blank';
        enlace.rel = 'noopener';
        enlace.click();
      }
    } catch (e: unknown) {
      if (ventana && !ventana.closed) ventana.close();
      await this.feedback(
        e instanceof Error && e.message === 'COMPROBANTE_VACIO'
          ? 'El comprobante recibido está vacío.'
          : this.error(e, 'No pudimos abrir el comprobante.'),
        'danger',
      );
    }
  }
  async copiarClabe(): Promise<void> {
    const clabe = this.pedido?.configuracionTransferencia?.clabe;
    if (!clabe) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(clabe);
      else if (!this.copiarTextoAlternativo(clabe)) throw new Error('COPY_NOT_AVAILABLE');
      await this.feedback('CLABE copiada.', 'success');
    } catch {
      await this.feedback('No pudimos copiar la CLABE.', 'warning');
    }
  }
  private async cargar(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      await this.router.navigateByUrl('/mis-pedidos');
      return;
    }
    this.cargando = true;
    this.comprobanteImgError = false;
    try {
      this.pedido = await firstValueFrom(this.api.detalle(id));
    } catch (e: unknown) {
      await this.feedback(this.error(e, 'No pudimos cargar el pedido.'), 'danger');
      await this.router.navigateByUrl('/mis-pedidos');
    } finally {
      this.cargando = false;
    }
  }
  private error(e: unknown, f: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : f;
  }
  private copiarTextoAlternativo(valor: string): boolean {
    const campo = document.createElement('textarea');
    campo.value = valor;
    campo.style.position = 'fixed';
    campo.style.opacity = '0';
    document.body.appendChild(campo);
    campo.select();
    const copiado = document.execCommand('copy');
    campo.remove();
    return copiado;
  }
  private async feedback(message: string, color: 'success' | 'warning' | 'danger'): Promise<void> {
    const t = await this.toast.create({ message, color, duration: 3200, position: 'top' });
    await t.present();
  }
}
