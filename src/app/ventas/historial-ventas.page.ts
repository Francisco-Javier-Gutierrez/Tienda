import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';

import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { VentaResumen } from '../models/venta';
import { AuthService } from '../services/auth.service';
import { VentaService } from '../services/venta.service';

export interface ResumenGananciasDia {
  fechaKey: string;
  fechaLegible: string;
  esHoy: boolean;
  esAyer: boolean;
  totalVentas: number;
  totalVendido: number;
  costoTotal: number;
  gananciaEsperada: number;
  margenPorcentaje: number;
  ventas: VentaResumen[];
}

@Component({
  selector: 'app-historial-ventas',
  templateUrl: './historial-ventas.page.html',
  styleUrls: ['./ventas.page.scss'],
  standalone: false,
})
export class HistorialVentasPage implements OnInit {
  readonly auth = inject(AuthService);

  ventas: VentaResumen[] = [];
  gananciasPorDia: ResumenGananciasDia[] = [];
  filtroDia: string = 'TODOS';

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
     TOTAL COSTO PRODUCTOS
  ========================================= */

  get totalCosto(): number {
    return this.ventas
      .filter((venta) => venta.estado === 'COMPLETADA')
      .reduce((total, venta) => total + Number(venta.costoTotal || 0), 0);
  }

  /* =========================================
     GANANCIAS TOTALES Y MARGEN PROMEDIO
  ========================================= */

  get totalGanancias(): number {
    return this.ventas
      .filter((venta) => venta.estado === 'COMPLETADA')
      .reduce((total, venta) => {
        if (venta.ganancia !== undefined && venta.ganancia !== null) {
          return total + Number(venta.ganancia);
        }
        return total + Math.max(0, Number(venta.total) - Number(venta.costoTotal || 0));
      }, 0);
  }

  get margenPromedio(): number {
    if (this.totalVendido <= 0) return 0;
    return Number(((this.totalGanancias / this.totalVendido) * 100).toFixed(1));
  }

  /* =========================================
     VENTAS FILTRADAS POR DÍA
  ========================================= */

  get ventasFiltradas(): VentaResumen[] {
    if (this.filtroDia === 'TODOS') {
      return this.ventas;
    }
    return this.ventas.filter((v) => this.extraerClaveFecha(v) === this.filtroDia);
  }

  seleccionarFiltroDia(clave: string): void {
    if (this.filtroDia === clave) {
      this.filtroDia = 'TODOS';
    } else {
      this.filtroDia = clave;
    }
  }

  /* =========================================
     CARGAR HISTORIAL
  ========================================= */

  async cargar(): Promise<void> {
    this.cargando = true;

    try {
      this.ventas = await firstValueFrom(this.api.historial());
      this.calcularGananciasPorDia();
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
     CÁLCULO DE GANANCIAS POR DÍA
  ========================================= */

  private calcularGananciasPorDia(): void {
    const mapaDias = new Map<string, { ventas: VentaResumen[]; fechaObj: Date; fechaTexto: string }>();

    for (const venta of this.ventas) {
      if (venta.estado !== 'COMPLETADA') continue;

      const key = this.extraerClaveFecha(venta);
      const fechaObj = this.parsearFecha(venta);

      if (!mapaDias.has(key)) {
        mapaDias.set(key, {
          ventas: [],
          fechaObj,
          fechaTexto: venta.fecha || key,
        });
      }
      mapaDias.get(key)!.ventas.push(venta);
    }

    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    const ayerStr = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;

    const listaResumen: ResumenGananciasDia[] = [];

    mapaDias.forEach((val, key) => {
      const totalVendido = Number(
        val.ventas.reduce((acc, v) => acc + Number(v.total), 0).toFixed(2),
      );
      const costoTotal = Number(
        val.ventas.reduce((acc, v) => acc + Number(v.costoTotal || 0), 0).toFixed(2),
      );
      const gananciaEsperada = Number(
        val.ventas
          .reduce((acc, v) => {
            if (v.ganancia !== undefined && v.ganancia !== null) {
              return acc + Number(v.ganancia);
            }
            return acc + (Number(v.total) - Number(v.costoTotal || 0));
          }, 0)
          .toFixed(2),
      );
      const margenPorcentaje =
        totalVendido > 0 ? Number(((gananciaEsperada / totalVendido) * 100).toFixed(1)) : 0;

      const esHoy = key === hoyStr;
      const esAyer = key === ayerStr;

      let fechaLegible = val.fechaTexto;
      if (esHoy) {
        fechaLegible = 'Hoy';
      } else if (esAyer) {
        fechaLegible = 'Ayer';
      }

      listaResumen.push({
        fechaKey: key,
        fechaLegible,
        esHoy,
        esAyer,
        totalVentas: val.ventas.length,
        totalVendido,
        costoTotal,
        gananciaEsperada,
        margenPorcentaje,
        ventas: val.ventas,
      });
    });

    // Ordenar de más reciente a más antiguo
    listaResumen.sort((a, b) => b.fechaKey.localeCompare(a.fechaKey));
    this.gananciasPorDia = listaResumen;
  }

  private extraerClaveFecha(venta: VentaResumen): string {
    if (venta.fechaIso) {
      return venta.fechaIso.split('T')[0];
    }
    if (venta.fecha) {
      // Si tiene formato YYYY-MM-DD o DD/MM/YYYY
      const partes = venta.fecha.split(/[-/]/);
      if (partes.length === 3) {
        if (partes[0].length === 4) {
          return `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
        }
        return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
      }
      return venta.fecha;
    }
    return 'sin-fecha';
  }

  private parsearFecha(venta: VentaResumen): Date {
    if (venta.fechaIso) {
      return new Date(venta.fechaIso);
    }
    return new Date();
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
