import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { VentaDetalle } from '../models/venta';
import { AuthService } from '../services/auth.service';
import { ImagenesService } from '../services/imagenes.service';
import { TicketService } from '../services/ticket.service';
import { VentaService } from '../services/venta.service';
@Component({
  selector: 'app-detalle-venta',
  templateUrl: './detalle-venta.page.html',
  styleUrls: ['./ventas.page.scss'],
  standalone: false,
})
export class DetalleVentaPage implements OnInit {
  readonly auth = inject(AuthService);
  readonly ticket = inject(TicketService);
  venta: VentaDetalle | null = null;
  cargando = true;
  mostrarCancelacion = false;
  cancelandoVenta = false;
  motivoCancelacion = '';
  private route = inject(ActivatedRoute);
  private api = inject(VentaService);
  private imagenes = inject(ImagenesService);
  private toast = inject(ToastController);
  ngOnInit(): void {
    void this.cargar();
  }
  async cargar(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargando = true;
    try {
      this.venta = await firstValueFrom(this.api.detalle(id));
    } catch (error) {
      await this.feedback(
        error instanceof HttpErrorResponse && error.status === 404
          ? 'Venta no encontrada.'
          : 'No fue posible consultar el detalle.',
        'danger',
      );
    } finally {
      this.cargando = false;
    }
  }
  abrirCancelacion(): void {
    this.motivoCancelacion = '';
    this.mostrarCancelacion = true;
  }
  async cancelar(): Promise<void> {
    if (!this.venta || this.cancelandoVenta) return;
    const motivo = this.motivoCancelacion.trim();
    if (motivo.length < 3 || motivo.length > 255) {
      await this.feedback('El motivo debe tener entre 3 y 255 caracteres.', 'warning');
      return;
    }
    this.cancelandoVenta = true;
    try {
      await firstValueFrom(this.api.cancelarVenta(this.venta.id, motivo));
      this.mostrarCancelacion = false;
      await this.cargar();
      await this.feedback('Venta cancelada. El inventario fue actualizado.', 'success');
    } catch (error) {
      await this.feedback(
        error instanceof HttpErrorResponse && error.error?.message
          ? error.error.message
          : 'No fue posible cancelar la venta.',
        'danger',
      );
    } finally {
      this.cancelandoVenta = false;
    }
  }
  async descargar(): Promise<void> {
    if (this.venta)
      try {
        await this.ticket.descargar(this.venta);
        await this.feedback('Comprobante generado.', 'success');
      } catch {
        await this.feedback('No fue posible generar el PDF.', 'danger');
      }
  }
  async compartir(): Promise<void> {
    if (this.venta)
      try {
        await this.ticket.compartir(this.venta);
      } catch {
        await this.feedback('No fue posible compartir el comprobante.', 'danger');
      }
  }
  imagen(ruta: string | null): string | null {
    return this.imagenes.resolver(ruta);
  }
  formatearFolio(id: string | null | undefined): string {
    if (!id) return '---';
    const limpio = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return limpio.length > 8 ? limpio.substring(0, 8) : limpio;
  }
  private async feedback(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const aviso = await this.toast.create({ message, color, duration: 3200, position: 'top' });
    await aviso.present();
  }
}
