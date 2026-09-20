import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ClienteDeudor, CrearClienteRapidoDto, FiadoResumen, MovimientoCuenta } from '../models/fiado';
import { DialogService } from '../services/dialog.service';
import { FiadoService } from '../services/fiado.service';

@Component({
  selector: 'app-fiados',
  templateUrl: './fiados.page.html',
  styleUrls: ['./fiados.page.scss'],
  standalone: false,
})
export class FiadosPage implements OnInit {
  private readonly fiadoService = inject(FiadoService);
  private readonly toastController = inject(ToastController);
  private readonly dialog = inject(DialogService);

  deudores: ClienteDeudor[] = [];
  resumen: FiadoResumen | null = null;
  cargando = true;
  filtroBusqueda = '';
  filtroEstado: 'TODOS' | 'CON_DEUDA' | 'AL_CORRIENTE' = 'TODOS';

  // Modal Abono
  mostrarModalAbono = false;
  clienteAbono: ClienteDeudor | null = null;
  montoAbono: number | null = null;
  metodoPagoAbono: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' = 'EFECTIVO';
  conceptoAbono = '';
  guardandoAbono = false;

  // Modal Añadir Deuda / Cargo Manual
  mostrarModalCargo = false;
  clienteCargo: ClienteDeudor | null = null;
  montoCargo: number | null = null;
  conceptoCargo = '';
  guardandoCargo = false;

  // Modal Nuevo Cliente Rápido
  mostrarModalNuevoCliente = false;
  nuevoClienteNombre = '';
  nuevoClienteApellido = '';
  nuevoClienteTelefono = '';
  nuevoClienteLimite: number | null = null;
  guardandoCliente = false;

  // Modal Historial / Estado de Cuenta
  mostrarModalHistorial = false;
  clienteHistorial: ClienteDeudor | null = null;
  movimientosHistorial: MovimientoCuenta[] = [];
  cargandoHistorial = false;

  ngOnInit(): void {
    void this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    this.cargando = true;
    try {
      const [deudores, resumen] = await Promise.all([
        firstValueFrom(this.fiadoService.listarDeudores()),
        firstValueFrom(this.fiadoService.resumen()),
      ]);

      this.deudores = deudores || [];
      this.resumen = resumen || null;
    } catch (err) {
      console.error('Error al cargar datos de fiados:', err);
      await this.mostrarFeedback('Error al cargar la libreta de fiados', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  get totalConDeuda(): number {
    return this.deudores.filter((d) => d.saldoDeudor > 0).length;
  }

  get totalAlCorriente(): number {
    return this.deudores.filter((d) => d.saldoDeudor <= 0).length;
  }

  get deudoresFiltrados(): ClienteDeudor[] {
    let lista = this.deudores;

    if (this.filtroEstado === 'CON_DEUDA') {
      lista = lista.filter((d) => d.saldoDeudor > 0);
    } else if (this.filtroEstado === 'AL_CORRIENTE') {
      lista = lista.filter((d) => d.saldoDeudor <= 0);
    }

    const termino = this.filtroBusqueda.trim().toLowerCase();
    if (!termino) return lista;

    return lista.filter((d) => {
      const nombre = (d.nombreCompleto || d.nombre || '').toLowerCase();
      const telefono = (d.telefono || '').toLowerCase();
      return nombre.includes(termino) || telefono.includes(termino);
    });
  }

  abrirModalAbono(cliente: ClienteDeudor): void {
    this.clienteAbono = cliente;
    this.montoAbono = cliente.saldoDeudor; // Sugerir liquidar el total por defecto
    this.metodoPagoAbono = 'EFECTIVO';
    this.conceptoAbono = '';
    this.guardandoAbono = false;
    this.mostrarModalAbono = true;
  }

  cerrarModalAbono(): void {
    this.mostrarModalAbono = false;
    this.clienteAbono = null;
  }

  async guardarAbono(): Promise<void> {
    if (!this.clienteAbono) return;

    const monto = Number(this.montoAbono);
    if (isNaN(monto) || monto <= 0) {
      await this.mostrarFeedback('Ingresa un monto válido mayor a 0', 'warning');
      return;
    }

    this.guardandoAbono = true;
    try {
      const res = await firstValueFrom(
        this.fiadoService.registrarAbono(this.clienteAbono.id, {
          uuidAbono: crypto.randomUUID(),
          monto,
          metodoPago: this.metodoPagoAbono,
          concepto: this.conceptoAbono.trim() || undefined,
        }),
      );

      await this.mostrarFeedback(res.mensaje || 'Abono registrado con éxito', 'success');
      this.cerrarModalAbono();
      await this.cargarDatos();
    } catch (err: unknown) {
      console.error('Error al registrar abono:', err);
      let msg = 'No fue posible registrar el abono.';
      if (err instanceof HttpErrorResponse && err.error?.message) {
        msg = err.error.message;
      }
      await this.mostrarFeedback(msg, 'danger');
    } finally {
      this.guardandoAbono = false;
    }
  }

  abrirModalCargo(cliente: ClienteDeudor): void {
    this.clienteCargo = cliente;
    this.montoCargo = null;
    this.conceptoCargo = '';
    this.guardandoCargo = false;
    this.mostrarModalCargo = true;
  }

  cerrarModalCargo(): void {
    this.mostrarModalCargo = false;
    this.clienteCargo = null;
    this.montoCargo = null;
    this.conceptoCargo = '';
  }

  setConceptoCargo(concepto: string): void {
    this.conceptoCargo = concepto;
  }

  async guardarCargo(): Promise<void> {
    if (!this.clienteCargo) return;

    const monto = Number(this.montoCargo);
    if (isNaN(monto) || monto <= 0) {
      await this.mostrarFeedback('Ingresa un monto válido mayor a 0', 'warning');
      return;
    }

    const concepto = (this.conceptoCargo || '').trim() || 'Cargo manual a cuenta';

    this.guardandoCargo = true;
    try {
      const res = await firstValueFrom(
        this.fiadoService.registrarCargo(this.clienteCargo.idCliente || this.clienteCargo.id, {
          monto,
          concepto,
        }),
      );

      await this.mostrarFeedback(res.mensaje || 'Cargo registrado con éxito', 'success');
      this.cerrarModalCargo();
      await this.cargarDatos();
    } catch (err: unknown) {
      console.error('Error al registrar cargo:', err);
      let msg = 'No fue posible registrar el cargo.';
      if (err instanceof HttpErrorResponse && err.error?.message) {
        msg = err.error.message;
      }
      await this.mostrarFeedback(msg, 'danger');
    } finally {
      this.guardandoCargo = false;
    }
  }

  abrirModalNuevoCliente(): void {
    this.mostrarModalNuevoCliente = true;
  }

  cerrarModalNuevoCliente(): void {
    this.mostrarModalNuevoCliente = false;
  }

  async guardarNuevoCliente(dto: CrearClienteRapidoDto): Promise<void> {
    this.guardandoCliente = true;
    try {
      await firstValueFrom(this.fiadoService.crearClienteRapido(dto));

      await this.mostrarFeedback('Cliente registrado con éxito en la libreta', 'success');
      this.cerrarModalNuevoCliente();
      await this.cargarDatos();
    } catch (err: unknown) {
      console.error('Error al crear cliente:', err);
      let msg = 'No fue posible registrar al cliente.';
      if (err instanceof HttpErrorResponse && err.error?.message) {
        msg = err.error.message;
      }
      await this.mostrarFeedback(msg, 'danger');
    } finally {
      this.guardandoCliente = false;
    }
  }

  async verHistorial(cliente: ClienteDeudor): Promise<void> {
    this.clienteHistorial = cliente;
    this.movimientosHistorial = [];
    this.cargandoHistorial = true;
    this.mostrarModalHistorial = true;

    try {
      const res = await firstValueFrom(this.fiadoService.estadoCuenta(cliente.id));
      this.movimientosHistorial = res.movimientos || [];
    } catch (err) {
      console.error('Error al cargar estado de cuenta:', err);
      await this.mostrarFeedback('No fue posible cargar el estado de cuenta', 'danger');
    } finally {
      this.cargandoHistorial = false;
    }
  }

  cerrarModalHistorial(): void {
    this.mostrarModalHistorial = false;
    this.clienteHistorial = null;
    this.movimientosHistorial = [];
  }

  enviarWhatsApp(cliente: ClienteDeudor): void {
    this.fiadoService.enviarRecordatorioWhatsApp(cliente);
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
