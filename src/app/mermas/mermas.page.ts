import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EstadoMerma, Merma, MermaResumen, TipoMerma } from '../models/merma';
import { Producto } from '../models/productos';
import { DialogService } from '../services/dialog.service';
import { MermaService } from '../services/merma.service';
import { ProductosService } from '../services/productos.service';

@Component({
  selector: 'app-mermas',
  templateUrl: './mermas.page.html',
  styleUrls: ['./mermas.page.scss'],
  standalone: false,
})
export class MermasPage implements OnInit {
  private readonly mermaService = inject(MermaService);
  private readonly productosService = inject(ProductosService);
  private readonly toastController = inject(ToastController);
  private readonly dialog = inject(DialogService);

  mermas: Merma[] = [];
  resumen: MermaResumen | null = null;
  productos: Producto[] = [];

  cargando = true;
  guardando = false;

  // Filtros
  filtroBusqueda = '';
  filtroTipo = 'TODOS';
  filtroEstado = 'TODOS';

  // Modal de Registro
  mostrarModalRegistro = false;
  busquedaProducto = '';
  productoSeleccionado: Producto | null = null;
  cantidad = 1;
  tipoSeleccionado: TipoMerma = 'CADUCADO';
  motivo = '';

  tiposDisponibles: { valor: TipoMerma; label: string; icono: string; descripcion: string }[] = [
    { valor: 'CADUCADO', label: 'Caducado / Vencido', icono: 'event_busy', descripcion: 'Fecha de caducidad vencida' },
    {
      valor: 'DANADO',
      label: 'Dañado / Roto',
      icono: 'broken_image',
      descripcion: 'Empaque roto, botella rota o derramada',
    },
    {
      valor: 'DEVOLUCION_PROVEEDOR',
      label: 'Devolución a Proveedor',
      icono: 'assignment_return',
      descripcion: 'Apartado para cambio con preventa (Bimbo, Sabritas, etc.)',
    },
    {
      valor: 'CONSUMO_INTERNO',
      label: 'Consumo Interno',
      icono: 'storefront',
      descripcion: 'Uso y limpieza de la tienda',
    },
    { valor: 'OTRO', label: 'Otro Motivo', icono: 'more_horiz', descripcion: 'Descarte por otras causas' },
  ];

  ngOnInit(): void {
    void this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    this.cargando = true;
    try {
      const [mermas, resumen, productos] = await Promise.all([
        firstValueFrom(this.mermaService.listar()),
        firstValueFrom(this.mermaService.resumen()),
        firstValueFrom(this.productosService.getProductos()),
      ]);

      this.mermas = mermas || [];
      this.resumen = resumen || null;
      this.productos = productos || [];
    } catch (err) {
      console.error('Error al cargar datos de mermas:', err);
      await this.mostrarFeedback('Error al cargar registros de mermas', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  get mermasFiltradas(): Merma[] {
    const termino = this.filtroBusqueda.trim().toLowerCase();
    return this.mermas.filter((m) => {
      const coincideTexto =
        !termino ||
        (m.productoNombre && m.productoNombre.toLowerCase().includes(termino)) ||
        (m.motivo && m.motivo.toLowerCase().includes(termino)) ||
        (m.codigoQR && m.codigoQR.toLowerCase().includes(termino));

      const coincideTipo = this.filtroTipo === 'TODOS' || m.tipo === this.filtroTipo;
      const coincideEstado = this.filtroEstado === 'TODOS' || m.estado === this.filtroEstado;

      return coincideTexto && coincideTipo && coincideEstado;
    });
  }

  get productosFiltradosParaModal(): Producto[] {
    const termino = this.busquedaProducto.trim().toLowerCase();
    if (!termino) {
      return this.productos.slice(0, 8);
    }
    return this.productos
      .filter(
        (p) => p.nombre.toLowerCase().includes(termino) || (p.codigoQR && p.codigoQR.toLowerCase().includes(termino)),
      )
      .slice(0, 10);
  }

  seleccionarProducto(p: Producto): void {
    this.productoSeleccionado = p;
    this.busquedaProducto = p.nombre;
    this.cantidad = 1;
  }

  get costoPerdidaEstimado(): number {
    if (!this.productoSeleccionado) return 0;
    const costoUnit = Number(this.productoSeleccionado.costo || 0);
    return Math.round(costoUnit * this.cantidad * 100) / 100;
  }

  abrirModalRegistro(productoPreseleccionado?: Producto): void {
    this.mostrarModalRegistro = true;
    this.guardando = false;
    this.tipoSeleccionado = 'CADUCADO';
    this.motivo = '';
    this.cantidad = 1;

    if (productoPreseleccionado) {
      this.seleccionarProducto(productoPreseleccionado);
    } else {
      this.productoSeleccionado = null;
      this.busquedaProducto = '';
    }
  }

  cerrarModalRegistro(): void {
    this.mostrarModalRegistro = false;
    this.productoSeleccionado = null;
    this.busquedaProducto = '';
  }

  async guardarMerma(): Promise<void> {
    if (!this.productoSeleccionado) {
      await this.mostrarFeedback('Debes seleccionar un producto del catálogo', 'warning');
      return;
    }

    if (!this.cantidad || this.cantidad <= 0) {
      await this.mostrarFeedback('La cantidad debe ser mayor a 0', 'warning');
      return;
    }

    if (this.cantidad > this.productoSeleccionado.existencia) {
      await this.mostrarFeedback(
        `La cantidad (${this.cantidad}) supera el stock actual disponible (${this.productoSeleccionado.existencia})`,
        'warning',
      );
      return;
    }

    if (!this.motivo.trim()) {
      await this.mostrarFeedback('Por favor especifica el motivo o descripción de la baja', 'warning');
      return;
    }

    this.guardando = true;
    try {
      await firstValueFrom(
        this.mermaService.registrar({
          uuidMerma: crypto.randomUUID(),
          idPro: this.productoSeleccionado.id,
          cantidad: this.cantidad,
          tipo: this.tipoSeleccionado,
          motivo: this.motivo.trim(),
        }),
      );

      await this.mostrarFeedback('Baja de inventario registrada con éxito', 'success');
      this.cerrarModalRegistro();
      await this.cargarDatos();
    } catch (err: unknown) {
      console.error('Error al registrar merma:', err);
      let mensaje = 'No fue posible registrar la merma.';
      if (err instanceof HttpErrorResponse && err.error?.message) {
        mensaje = err.error.message;
      }
      await this.mostrarFeedback(mensaje, 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async marcarDevuelto(merma: Merma): Promise<void> {
    const confirmado = await this.dialog.confirm({
      title: 'Confirmar reposición / cambio',
      message: `¿Confirmas que el proveedor ya entregó el producto de cambio o bonificación para "${merma.productoNombre}" (${merma.cantidad} piezas)?`,
      type: 'info',
      icon: 'published_with_changes',
      confirmText: 'Sí, registrar reposición',
      cancelText: 'Cancelar',
    });

    if (!confirmado) return;

    try {
      await firstValueFrom(this.mermaService.actualizarEstado(merma.id, 'DEVUELTO_PROVEEDOR'));
      await this.mostrarFeedback('Mercancía marcada como devuelta/repuesta por el proveedor', 'success');
      await this.cargarDatos();
    } catch (err) {
      console.error('Error al actualizar estado de merma:', err);
      await this.mostrarFeedback('Error al actualizar el estado de la merma', 'danger');
    }
  }

  moneda(valor: number | null | undefined): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number(valor || 0));
  }

  formatearFecha(iso: string | null | undefined): string {
    if (!iso) return '---';
    try {
      const fecha = new Date(iso);
      return fecha.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  private async mostrarFeedback(mensaje: string, color: 'success' | 'danger' | 'warning' | 'primary'): Promise<void> {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3500,
      position: 'bottom',
      color,
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }
}
