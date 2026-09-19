import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';

import { Caja } from '../models/caja';
import { VentaResumen } from '../models/venta';
import { AuthService } from '../services/auth.service';
import { CajaService } from '../services/caja.service';
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

export interface OpcionCorteSelect {
  value: string;
  label: string;
}

@Component({
  selector: 'app-historial-ventas',
  templateUrl: './historial-ventas.page.html',
  styleUrls: ['./ventas.page.scss'],
  standalone: false,
})
export class HistorialVentasPage implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(VentaService);
  private readonly cajaApi = inject(CajaService);
  private readonly toast = inject(ToastController);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Pestañas principales
  pestanaActiva: 'tickets' | 'cortes' = 'tickets';

  // Datos
  ventas: VentaResumen[] = [];
  cortes: Caja[] = [];
  gananciasPorDia: ResumenGananciasDia[] = [];

  // Filtros de Tickets
  filtroDia: string = 'TODOS';
  fechaFiltroPicker: string = '';
  filtroCorte: string = '';
  opcionesCortes: OpcionCorteSelect[] = [];

  // Filtros de Cortes
  filtroEstadoCorte: string = '';
  fechaFiltroCortes: string = '';
  readonly opcionesEstadoCorte = [
    { value: '', label: 'Todos los estados' },
    { value: 'ABIERTA', label: 'Abierta (en curso)' },
    { value: 'CERRADA', label: 'Cerrada' },
  ];

  cargando = true;
  cargandoCortes = false;

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['tab'] === 'cortes') {
        this.pestanaActiva = 'cortes';
      } else if (params['tab'] === 'tickets') {
        this.pestanaActiva = 'tickets';
      }

      if (params['corteId']) {
        this.filtroCorte = params['corteId'];
        this.filtroDia = 'TODOS';
        this.fechaFiltroPicker = '';
      }

      if (params['fecha']) {
        this.filtroDia = params['fecha'];
        this.fechaFiltroPicker = params['fecha'];
      }
    });

    void this.cargar();
  }

  ionViewWillEnter(): void {
    void this.cargar();
  }

  cambiarPestana(pestana: 'tickets' | 'cortes'): void {
    this.pestanaActiva = pestana;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: pestana },
      queryParamsHandling: 'merge',
    });
  }

  /* =========================================
     FILTRADO DE VENTAS
  ========================================= */

  get ventasFiltradas(): VentaResumen[] {
    let filtradas = this.ventas;

    // Filtro por corte de caja
    if (this.filtroCorte) {
      filtradas = filtradas.filter((v) => v.sesionCajaId === this.filtroCorte);
    }

    // Filtro por día específico
    if (this.filtroDia !== 'TODOS') {
      filtradas = filtradas.filter((v) => this.extraerClaveFecha(v) === this.filtroDia);
    }

    return filtradas;
  }

  get corteActivo(): Caja | null {
    if (!this.filtroCorte) return null;
    return this.cortes.find((c) => c.id === this.filtroCorte) || null;
  }

  get hayFiltrosTicketsActivos(): boolean {
    return this.filtroDia !== 'TODOS' || !!this.filtroCorte || !!this.fechaFiltroPicker;
  }

  /* =========================================
     MÉTRICAS DINÁMICAS DE VENTAS (FILTRADAS)
  ========================================= */

  get ventasCompletadas(): number {
    return this.ventasFiltradas.filter((venta) => venta.estado === 'COMPLETADA').length;
  }

  get ventasCanceladas(): number {
    return this.ventasFiltradas.filter((venta) => venta.estado === 'CANCELADA').length;
  }

  get totalVendido(): number {
    return this.ventasFiltradas
      .filter((venta) => venta.estado === 'COMPLETADA')
      .reduce((total, venta) => total + Number(venta.total), 0);
  }

  get totalCosto(): number {
    return this.ventasFiltradas
      .filter((venta) => venta.estado === 'COMPLETADA')
      .reduce((total, venta) => total + Number(venta.costoTotal || 0), 0);
  }

  get totalGanancias(): number {
    return this.ventasFiltradas
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
     MÉTRICAS Y FILTRADO DE CORTES
  ========================================= */

  get cortesFiltrados(): Caja[] {
    let resultado = this.cortes;

    if (this.filtroEstadoCorte) {
      resultado = resultado.filter((c) => c.estado === this.filtroEstadoCorte);
    }

    if (this.fechaFiltroCortes) {
      resultado = resultado.filter((c) => {
        const fApertura = c.fechaHoraApertura ? c.fechaHoraApertura.split('T')[0] : '';
        return fApertura === this.fechaFiltroCortes;
      });
    }

    return resultado;
  }

  get cortesCuadrados(): number {
    return this.cortesFiltrados.filter((c) => c.estado === 'CERRADA' && Math.abs(Number(c.diferencia || 0)) < 0.01)
      .length;
  }

  get cortesConDiferencia(): number {
    return this.cortesFiltrados.filter((c) => c.estado === 'CERRADA' && Math.abs(Number(c.diferencia || 0)) >= 0.01)
      .length;
  }

  get totalVendidoCortes(): number {
    return this.cortesFiltrados.reduce((acc, c) => acc + Number(c.totalVentas || 0), 0);
  }

  /* =========================================
     ACCIONES DE FILTRO
  ========================================= */

  seleccionarFiltroDia(clave: string): void {
    if (this.filtroDia === clave) {
      this.filtroDia = 'TODOS';
      this.fechaFiltroPicker = '';
    } else {
      this.filtroDia = clave;
      this.fechaFiltroPicker = clave === 'TODOS' ? '' : clave;
    }
  }

  alCambiarFechaPicker(fecha: string | null): void {
    if (fecha) {
      this.filtroDia = fecha;
      this.fechaFiltroPicker = fecha;
    } else {
      this.filtroDia = 'TODOS';
      this.fechaFiltroPicker = '';
    }
  }

  seleccionarCorte(corteId: string): void {
    this.filtroCorte = corteId;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { corteId: corteId || null },
      queryParamsHandling: 'merge',
    });
  }

  limpiarFiltroCorte(): void {
    this.filtroCorte = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { corteId: null },
      queryParamsHandling: 'merge',
    });
  }

  limpiarFiltroDia(): void {
    this.filtroDia = 'TODOS';
    this.fechaFiltroPicker = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { fecha: null },
      queryParamsHandling: 'merge',
    });
  }

  limpiarTodosFiltros(): void {
    this.filtroDia = 'TODOS';
    this.fechaFiltroPicker = '';
    this.filtroCorte = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { corteId: null, fecha: null },
      queryParamsHandling: 'merge',
    });
  }

  verVentasDeCorte(corte: Caja): void {
    this.pestanaActiva = 'tickets';
    this.filtroCorte = corte.id;
    this.filtroDia = 'TODOS';
    this.fechaFiltroPicker = '';

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'tickets', corteId: corte.id },
      queryParamsHandling: 'merge',
    });
  }

  /* =========================================
     CARGA DE DATOS
  ========================================= */

  async cargar(): Promise<void> {
    this.cargando = true;
    this.cargandoCortes = true;

    try {
      const [ventasRes, cortesRes] = await Promise.all([
        firstValueFrom(this.api.historial()),
        firstValueFrom(this.cajaApi.historial()),
      ]);

      this.ventas = ventasRes || [];
      this.cortes = cortesRes || [];

      this.actualizarOpcionesCortes();
      this.calcularGananciasPorDia();
    } catch (error) {
      const aviso = await this.toast.create({
        message:
          error instanceof HttpErrorResponse && error.status === 0
            ? 'No hay conexión con el servidor.'
            : 'No fue posible consultar los datos.',
        color: 'danger',
        duration: 3000,
        position: 'top',
      });
      await aviso.present();
    } finally {
      this.cargando = false;
      this.cargandoCortes = false;
    }
  }

  private actualizarOpcionesCortes(): void {
    this.opcionesCortes = [
      { value: '', label: 'Todos los cortes de caja' },
      ...this.cortes.map((c) => {
        const folio = this.formatearFolio(c.id);
        const fecha = this.formatearFechaCorteCorta(c.fechaHoraApertura);
        const totalStr = Number(c.totalVentas || 0).toLocaleString('es-MX', {
          style: 'currency',
          currency: 'MXN',
        });
        const estadoBadge = c.estado === 'ABIERTA' ? ' [Abierta]' : '';
        return {
          value: c.id,
          label: `Corte #${folio} · ${c.empleado} (${fecha}) · ${totalStr}${estadoBadge}`,
        };
      }),
    ];
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
      const totalVendido = Number(val.ventas.reduce((acc, v) => acc + Number(v.total), 0).toFixed(2));
      const costoTotal = Number(val.ventas.reduce((acc, v) => acc + Number(v.costoTotal || 0), 0).toFixed(2));
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
      const margenPorcentaje = totalVendido > 0 ? Number(((gananciaEsperada / totalVendido) * 100).toFixed(1)) : 0;

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

    listaResumen.sort((a, b) => b.fechaKey.localeCompare(a.fechaKey));
    this.gananciasPorDia = listaResumen;
  }

  extraerClaveFecha(venta: VentaResumen): string {
    if (venta.fechaIso) {
      return venta.fechaIso.split('T')[0];
    }
    if (venta.fecha) {
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
     FORMATEADORES Y AYUDANTES VISUALES
  ========================================= */

  formatearFolio(id: string | null | undefined): string {
    if (!id) return '---';
    const limpio = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return limpio.length > 8 ? limpio.substring(0, 8) : limpio;
  }

  formatearFechaHora(isoString: string | null | undefined): string {
    if (!isoString) return '---';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  }

  formatearFechaCorteCorta(isoString: string | null | undefined): string {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
    } catch {
      return '';
    }
  }

  interpretarDiferencia(diferencia: number | null | undefined): {
    texto: string;
    clase: string;
    icono: string;
  } {
    const d = Number(diferencia || 0);
    if (Math.abs(d) < 0.01) {
      return {
        texto: 'Cuadre exacto ($0.00)',
        clase: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icono: 'check_circle',
      };
    }
    if (d > 0) {
      const formatted = d.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
      return {
        texto: `Sobrante (+${formatted})`,
        clase: 'bg-amber-100 text-amber-800 border-amber-300',
        icono: 'trending_up',
      };
    }
    const formatted = Math.abs(d).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    return {
      texto: `Faltante (-${formatted})`,
      clase: 'bg-error-container text-on-error-container border-error/30',
      icono: 'warning',
    };
  }
}
