import { Component, inject, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { ItemCarrito } from '../models/carrito';
import { CarritoService } from '../services/carrito.service';
import { ImagenesService } from '../services/imagenes.service';
import { ClienteAuthService } from '../services/cliente-auth.service';
import { DialogService } from '../services/dialog.service';

@Component({
  selector: 'app-carrito',
  templateUrl: './carrito.page.html',
  styleUrls: ['./carrito.page.scss'],
  standalone: false,
})
export class CarritoPage implements OnInit {
  cargando = true;
  readonly carrito = inject(CarritoService);
  private readonly imagenes = inject(ImagenesService);
  private readonly toastController = inject(ToastController);
  private readonly dialog = inject(DialogService);
  private readonly clienteAuth = inject(ClienteAuthService);
  private readonly router = inject(Router);

  private imagenesConError = new Set<string>();

  ngOnInit() {
    setTimeout(() => {
      this.cargando = false;
    }, 500);
  }

  imagen(ruta: string | null): string | null {
    return this.imagenes.resolver(ruta);
  }

  imagenUrl(item: ItemCarrito): string | null {
    if (!item.imagen || this.imagenesConError.has(item.id)) return null;
    return this.imagenes.resolver(item.imagen);
  }

  onImageError(id: string, ruta?: string | null): void {
    this.imagenesConError.add(id);
    if (ruta) {
      this.imagenes.marcarFallida(ruta);
    }
  }

  async incrementar(item: ItemCarrito): Promise<void> {
    if (this.carrito.incrementar(item.id)) return;
    const toast = await this.toastController.create({
      message: 'Alcanzaste la existencia disponible de este producto.',
      duration: 1800,
      position: 'bottom',
      color: 'warning',
    });
    await toast.present();
  }

  async confirmarVaciar(): Promise<void> {
    const confirmado = await this.dialog.confirm({
      title: '¿Vaciar carrito?',
      message: '¿Estás seguro de que quieres quitar todos los productos del carrito?',
      type: 'danger',
      icon: 'remove_shopping_cart',
      confirmText: 'Vaciar carrito',
      cancelText: 'Conservar',
    });
    if (confirmado) {
      this.carrito.vaciar();
    }
  }

  async continuarCompra(): Promise<void> {
    const destino = this.clienteAuth.estaAutenticado() ? '/checkout' : '/login?returnUrl=%2Fcheckout';
    await this.router.navigateByUrl(destino);
  }
}
