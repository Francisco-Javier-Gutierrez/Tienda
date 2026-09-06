import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';

import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { VentaResumen } from '../models/venta';
import { AuthService } from '../services/auth.service';
import { VentaService } from '../services/venta.service';

@Component({
  selector: 'app-historial-ventas',
  templateUrl: './historial-ventas.page.html',
  styleUrls: ['./ventas.page.scss'],
  standalone: false,
})
export class HistorialVentasPage implements OnInit {
  readonly auth = inject(AuthService);

  ventas: VentaResumen[] = [];

  cargando = true;

  private readonly api = inject(VentaService);
  private readonly toast = inject(ToastController);

  ngOnInit(): void {
    void this.cargar();
  }

  ionViewWillEnter(): void {
    void this.cargar();
  }

  /* =========================================
     VENTAS COMPLETADAS
  ========================================= */

  get ventasCompletadas(): number {
    return this.ventas.filter((venta) => venta.estado === 'COMPLETADA').length;
  }

  /* =========================================
     VENTAS CANCELADAS
  ========================================= */

  get ventasCanceladas(): number {
    return this.ventas.filter((venta) => venta.estado === 'CANCELADA').length;
  }

  /* =========================================
     TOTAL VENDIDO
     No cuenta ventas canceladas
  ========================================= */

  get totalVendido(): number {
    return this.ventas

      .filter((venta) => venta.estado === 'COMPLETADA')

      .reduce((total, venta) => total + Number(venta.total), 0);
  }

  /* =========================================
     CARGAR HISTORIAL
  ========================================= */

  async cargar(): Promise<void> {
    this.cargando = true;

    try {
      this.ventas = await firstValueFrom(this.api.historial());
    } catch (error) {
      const aviso = await this.toast.create({
        message:
          error instanceof HttpErrorResponse && error.status === 0
            ? 'No hay conexión con el servidor.'
            : 'No fue posible consultar las ventas.',

        color: 'danger',

        duration: 3000,

        position: 'top',
      });

      await aviso.present();
    } finally {
      this.cargando = false;
    }
  }

  /* =========================================
     FORMATEAR FOLIO (ID ENCRIPTADO)
  ========================================= */

  formatearFolio(id: string | null | undefined): string {
    if (!id) return '---';
    const limpio = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return limpio.length > 8 ? limpio.substring(0, 8) : limpio;
  }
}
