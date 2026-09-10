import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ItemCarrito } from '../models/carrito';
import { PedidoCliente } from '../models/pedido-cliente';
import { CarritoService } from '../services/carrito.service';
import { ImagenesService } from '../services/imagenes.service';
import { PedidosClienteService } from '../services/pedidos-cliente.service';

interface ProductoPublicoStock {
  id: string;
  existencia?: number | null;
  precioVenta?: number;
  existenciaPro?: number | null;
  precioVentaPro?: number;
}

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.page.html',
  styleUrls: ['./checkout.page.scss'],
  standalone: false,
})
export class CheckoutPage implements OnInit {
  readonly carrito = inject(CarritoService);
  pedido: PedidoCliente | null = null;
  procesando = false;
  subiendo = false;
  transferenciaDisponible = true;
  mensajeTransferencia = '';
  archivo: File | null = null;
  private readonly claveIntento = 'tienda.cliente.pedido-intento';
  private readonly pedidos = inject(PedidosClienteService);
  private readonly imagenes = inject(ImagenesService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastController);
  private readonly router = inject(Router);
  private readonly imagenesConError = new Set<string>();

  ngOnInit(): void {
    if (!this.carrito.items.length) return;
    this.pedidos.obtenerConfiguracionTransferencia().subscribe({
      error: (error: unknown) => {
        this.transferenciaDisponible = false;
        this.mensajeTransferencia = this.mensajeError(
          error,
          'Los pagos por transferencia no están disponibles en este momento.',
        );
      },
    });
  }

  imagen(ruta: string | null): string | null {
    return this.imagenes.resolver(ruta);
  }

  imagenUrl(item: ItemCarrito): string | null {
    if (!item.imagen || this.imagenesConError.has(item.id)) return null;
    return this.imagenes.resolver(item.imagen);
  }

  onImageError(item: ItemCarrito): void {
    this.imagenesConError.add(item.id);
    if (item.imagen) {
      this.imagenes.marcarFallida(item.imagen);
    }
  }

  async generarPedido(): Promise<void> {
    if (this.procesando || !this.carrito.items.length || !this.transferenciaDisponible) return;
    this.procesando = true;
    try {
      const pedido = await firstValueFrom(
        this.pedidos.crearPedido({
          uuidPedido: this.uuidIntento(),
          items: this.carrito.items.map((item) => ({ id: item.id, cantidad: item.cantidad })),
        }),
      );
      this.pedido = pedido;
      this.carrito.vaciar();
      sessionStorage.removeItem(this.claveIntento);
      await this.feedback('Pedido reservado correctamente.', 'success');
    } catch (error: unknown) {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        /stock|disponib/i.test(this.mensajeError(error, ''))
      ) {
        await this.actualizarCarrito();
        await this.feedback(
          'Ya no hay suficiente existencia de uno de los productos. Actualizamos la disponibilidad para que puedas revisar tu carrito.',
          'warning',
        );
        await this.router.navigateByUrl('/carrito');
      } else {
        await this.feedback(
          this.mensajeError(error, 'No pudimos generar el pedido. Tu carrito se conservó.'),
          'danger',
        );
      }
    } finally {
      this.procesando = false;
    }
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

  async subirComprobante(): Promise<void> {
    if (!this.pedido || !this.archivo || this.subiendo) return;
    this.subiendo = true;
    try {
      this.pedido = await firstValueFrom(this.pedidos.subirComprobante(this.pedido.id, this.archivo));
      this.archivo = null;
      await this.feedback('Pago enviado a revisión.', 'success');
      await this.router.navigateByUrl(`/mis-pedidos/${this.pedido.id}`);
    } catch (error: unknown) {
      await this.feedback(this.mensajeError(error, 'No pudimos subir el comprobante.'), 'danger');
    } finally {
      this.subiendo = false;
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
      await this.feedback('No pudimos copiar la CLABE. Mantén presionado el número para copiarlo.', 'warning');
    }
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

  private uuidIntento(): string {
    const firma = this.carrito.items
      .map((item) => `${item.id}:${item.cantidad}`)
      .sort()
      .join('|');
    try {
      const guardado = JSON.parse(sessionStorage.getItem(this.claveIntento) || 'null') as {
        firma?: string;
        uuid?: string;
      } | null;
      if (guardado?.firma === firma && guardado.uuid && /^[0-9a-f-]{36}$/i.test(guardado.uuid)) return guardado.uuid;
    } catch {
      sessionStorage.removeItem(this.claveIntento);
    }
    const uuid = crypto.randomUUID();
    sessionStorage.setItem(this.claveIntento, JSON.stringify({ firma, uuid }));
    return uuid;
  }

  private async actualizarCarrito(): Promise<void> {
    try {
      const productos = await firstValueFrom(
        this.http.get<ProductoPublicoStock[]>(`${environment.API_BASE_URL}/public/productos`),
      );
      this.carrito.actualizarDisponibilidad(productos);
    } catch {
      /* El mensaje principal conserva el carrito si no es posible refrescarlo. */
    }
  }

  private mensajeError(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
      ? error.error.message
      : fallback;
  }

  private async feedback(message: string, color: 'success' | 'warning' | 'danger'): Promise<void> {
    const toast = await this.toast.create({
      message,
      color,
      duration: 3200,
      position: 'top',
      cssClass: 'pastel-toast',
    });
    await toast.present();
  }
}
