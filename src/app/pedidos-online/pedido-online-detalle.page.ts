import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstadoPedidoCliente, PedidoAdminDetalle } from '../models/pedido-cliente';
import { ImagenesService } from '../services/imagenes.service';
import { PedidosAdminService } from '../services/pedidos-admin.service';
import { DialogService } from '../services/dialog.service';

@Component({
  selector: 'app-pedido-online-detalle',
  templateUrl: './pedido-online-detalle.page.html',
  styleUrls: ['./pedido-online-detalle.page.scss'],
  standalone: false,
})
export class PedidoOnlineDetallePage implements OnInit {
  pedido: PedidoAdminDetalle | null = null;
  cargando = true;
  comprobanteImgError = false;
  accionEnCurso: string | null = null;
  private readonly api = inject(PedidosAdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastController);
  readonly imagenes = inject(ImagenesService);
  ngOnInit(): void {
    void this.cargar();
  }
  imagen(ruta: string | null): string | null {
    return this.imagenes.resolver(ruta);
  }
  onFotoError(foto: string | null | undefined): void {
    if (foto) {
      this.imagenes.marcarFallida(foto);
    }
  }
  onItemFotoError(foto: string | null | undefined): void {
    if (foto) {
      this.imagenes.marcarFallida(foto);
    }
  }
  onComprobanteImgError(): void {
    this.comprobanteImgError = true;
  }
  esImagenComprobante(): boolean {
    if (!this.pedido?.comprobante) return false;
    const mime = this.pedido.comprobante.mime?.toLowerCase() || '';
    if (mime.includes('pdf')) return false;
    if (mime.startsWith('image/')) return true;
    const url = (this.pedido.comprobanteUrl || this.pedido.comprobante.nombre || '').toLowerCase();
    if (url.includes('.pdf')) return false;
    return true;
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

  claseEstado(estado: EstadoPedidoCliente): string {
    switch (estado) {
      case 'EN_REVISION':
        return 'bg-amber-100 text-amber-800 border border-amber-300/60';
      case 'PAGADO':
        return 'bg-blue-100 text-blue-800 border border-blue-300/60';
      case 'LISTO':
        return 'bg-purple-100 text-purple-800 border border-purple-300/60';
      case 'ENTREGADO':
        return 'bg-tertiary-fixed text-tertiary border border-tertiary/20';
      case 'RECHAZADO':
      case 'CANCELADO':
      case 'EXPIRADO':
        return 'bg-error-container text-error border border-error/20';
      case 'PENDIENTE_PAGO':
      default:
        return 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30';
    }
  }

  puntoEstado(estado: EstadoPedidoCliente): string {
    switch (estado) {
      case 'EN_REVISION':
        return 'bg-amber-600';
      case 'PAGADO':
        return 'bg-blue-600';
      case 'LISTO':
        return 'bg-purple-600';
      case 'ENTREGADO':
        return 'bg-tertiary';
      case 'RECHAZADO':
      case 'CANCELADO':
      case 'EXPIRADO':
        return 'bg-error';
      case 'PENDIENTE_PAGO':
      default:
        return 'bg-outline';
    }
  }

  iconoEstado(estado: EstadoPedidoCliente): string {
    switch (estado) {
      case 'EN_REVISION':
        return 'pending_actions';
      case 'PAGADO':
        return 'verified';
      case 'LISTO':
        return 'inventory_2';
      case 'ENTREGADO':
        return 'task_alt';
      case 'RECHAZADO':
      case 'CANCELADO':
      case 'EXPIRADO':
        return 'cancel';
      case 'PENDIENTE_PAGO':
      default:
        return 'schedule';
    }
  }
  async confirmarAprobacion(): Promise<void> {
    if (!this.pedido || this.accionEnCurso) return;
    const confirmado = await this.dialog.confirm({
      title: 'Aprobar pago',
      message: 'Confirma que verificaste el comprobante y el monto recibido. Esta acción registrará la venta.',
      type: 'success',
      icon: 'verified',
      confirmText: 'Aprobar pago',
      cancelText: 'Volver',
    });
    if (confirmado) {
      void this.ejecutar('aprobar');
    }
  }
  async solicitarRechazo(): Promise<void> {
    if (!this.pedido || this.accionEnCurso) return;
    const motivo = await this.dialog.prompt({
      title: 'Rechazar pago',
      message: 'El motivo se mostrará al cliente y el inventario reservado será restaurado.',
      type: 'danger',
      icon: 'cancel',
      placeholder: 'Explica el motivo del rechazo...',
      minLength: 3,
      maxLength: 255,
      confirmText: 'Rechazar pago',
      cancelText: 'Volver',
      isTextarea: true,
    });
    if (motivo !== null) {
      void this.ejecutar('rechazar', motivo.trim());
    }
  }
  async ejecutar(accion: 'aprobar' | 'rechazar' | 'listo' | 'entregar', motivo = ''): Promise<void> {
    if (!this.pedido || this.accionEnCurso) return;
    this.accionEnCurso = accion;
    try {
      const id = this.pedido.id;
      this.pedido = await firstValueFrom(
        accion === 'aprobar'
          ? this.api.aprobar(id)
          : accion === 'rechazar'
            ? this.api.rechazar(id, motivo)
            : accion === 'listo'
              ? this.api.listo(id)
              : this.api.entregar(id),
      );
      await this.feedback(
        accion === 'aprobar'
          ? 'Pago aprobado y venta registrada.'
          : accion === 'rechazar'
            ? 'Pago rechazado e inventario restaurado.'
            : accion === 'listo'
              ? 'Pedido marcado como listo.'
              : 'Pedido marcado como entregado.',
        'success',
      );
    } catch (e: unknown) {
      await this.feedback(this.error(e, 'No fue posible actualizar el pedido.'), 'danger');
      await this.cargar();
    } finally {
      this.accionEnCurso = null;
    }
  }
  async verComprobante(): Promise<void> {
    if (this.pedido?.comprobanteUrl) {
      window.open(this.pedido.comprobanteUrl, '_blank');
      return;
    }
    if (!this.pedido?.comprobante) return;
    const ventana = window.open('', '_blank');
    if (ventana) ventana.opener = null;
    try {
      const blob = await firstValueFrom(this.api.comprobante(this.pedido.id));
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
          : this.error(e, 'No fue posible abrir el comprobante.'),
        'danger',
      );
    }
  }
  private async cargar(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      await this.router.navigateByUrl('/pedidos-online');
      return;
    }
    this.cargando = true;
    this.comprobanteImgError = false;
    try {
      this.pedido = await firstValueFrom(this.api.detalle(id));
    } catch (e: unknown) {
      await this.feedback(this.error(e, 'No fue posible cargar el pedido.'), 'danger');
      await this.router.navigateByUrl('/pedidos-online');
    } finally {
      this.cargando = false;
    }
  }
  private error(e: unknown, f: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : f;
  }
  private async feedback(message: string, color: 'success' | 'warning' | 'danger'): Promise<void> {
    const t = await this.toast.create({ message, color, duration: 3400, position: 'top' });
    await t.present();
  }
}
