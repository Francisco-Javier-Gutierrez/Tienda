import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstadoPedidoCliente, PedidoAdminResumen } from '../models/pedido-cliente';
import { PedidosAdminService } from '../services/pedidos-admin.service';
import { ImagenesService } from '../services/imagenes.service';

@Component({
  selector: 'app-pedidos-online',
  templateUrl: './pedidos-online.page.html',
  styleUrls: ['./pedidos-online.page.scss'],
  standalone: false,
})
export class PedidosOnlinePage implements OnInit {
  pedidos: PedidoAdminResumen[] = [];
  busqueda = '';
  estado = '';
  cargando = true;

  readonly opcionesEstado = [
    { value: '', label: 'Todos los estados' },
    { value: 'EN_REVISION', label: 'Pago en revisión' },
    { value: 'PAGADO', label: 'Pago aprobado' },
    { value: 'LISTO', label: 'Listo para recoger' },
    { value: 'ENTREGADO', label: 'Entregado' },
    { value: 'RECHAZADO', label: 'Pago rechazado' },
    { value: 'PENDIENTE_PAGO', label: 'Pendiente de pago' },
    { value: 'CANCELADO', label: 'Cancelado' },
    { value: 'EXPIRADO', label: 'Reserva expirada' },
  ];

  private readonly api = inject(PedidosAdminService);
  private readonly toast = inject(ToastController);
  readonly imagenes = inject(ImagenesService);

  ngOnInit(): void {
    void this.cargar();
  }

  imagen(ruta: string | null | undefined): string | null {
    return this.imagenes.resolver(ruta);
  }

  onFotoError(foto: string | null | undefined): void {
    if (foto) this.imagenes.marcarFallida(foto);
  }
  get filtrados(): PedidoAdminResumen[] {
    const q = this.busqueda.trim().toLocaleLowerCase('es');
    return this.pedidos.filter(
      (p) =>
        (!this.estado || p.estado === this.estado) &&
        (!q ||
          p.folio.toLowerCase().includes(q) ||
          p.cliente.nombre.toLocaleLowerCase('es').includes(q) ||
          p.cliente.correo.toLowerCase().includes(q)),
    );
  }
  contar(estado?: EstadoPedidoCliente): number {
    return estado ? this.pedidos.filter((p) => p.estado === estado).length : this.pedidos.length;
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
  async cargar(event?: CustomEvent): Promise<void> {
    if (!event) this.cargando = true;
    try {
      this.pedidos = await firstValueFrom(this.api.listar());
    } catch (e: unknown) {
      await this.feedback(this.error(e, 'No fue posible consultar los pedidos.'), 'danger');
    } finally {
      this.cargando = false;
      (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    }
  }
  private error(e: unknown, f: string): string {
    return e instanceof HttpErrorResponse && typeof e.error?.message === 'string' ? e.error.message : f;
  }
  private async feedback(message: string, color: 'danger'): Promise<void> {
    const t = await this.toast.create({ message, color, duration: 3200, position: 'top' });
    await t.present();
  }
}
