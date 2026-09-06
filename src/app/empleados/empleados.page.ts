import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { EmpleadoSesion } from '../models/auth';
import { Cargo } from '../models/cargo';
import { AuthService } from '../services/auth.service';
import { DialogService } from '../services/dialog.service';
import { EmpleadoDto, EmpleadosService } from '../services/empleados.service';
import { ImagenesService } from '../services/imagenes.service';

@Component({
  selector: 'app-empleados',
  templateUrl: './empleados.page.html',
  styleUrls: ['./empleados.page.scss'],
  standalone: false,
})
export class EmpleadosPage implements OnInit {
  /* Servicios */
  readonly auth = inject(AuthService);
  private readonly api = inject(EmpleadosService);
  private readonly toast = inject(ToastController);
  private readonly dialog = inject(DialogService);
  private readonly imagenes = inject(ImagenesService);

  /* Datos */
  empleados: EmpleadoSesion[] = [];
  cargos: Cargo[] = [];
  cargando = true;

  /* Filtros y búsqueda */
  busqueda = '';
  filtro: 'todos' | 'activos' | 'inactivos' | 'cajeros' = 'todos';

  /* Modal */
  modal = false;
  guardando = false;
  editando: string | null = null;
  form: EmpleadoDto = this.vacio();

  errores = {
    nombre: '',
    correo: '',
    idCargo: '',
    password: '',
  };

  ngOnInit(): void {
    void this.cargarDatos();
  }

  ionViewWillEnter(): void {
    void this.cargarDatos();
  }

  resolverFoto(foto: string | null | undefined): string | null {
    return this.imagenes.resolver(foto);
  }

  private async cargarDatos(): Promise<void> {
    this.cargando = true;
    try {
      const [empleados, cargos] = await Promise.all([
        firstValueFrom(this.api.listar()),
        firstValueFrom(this.api.cargos()),
      ]);
      this.empleados = empleados;
      this.cargos = cargos;
    } catch {
      await this.feedback('No fue posible cargar la información de empleados.', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  estaActivo(empleado: EmpleadoSesion): boolean {
    if (typeof empleado?.estadoEmp === 'boolean') return empleado.estadoEmp;
    if (typeof empleado?.estado === 'boolean') return empleado.estado;
    return true;
  }

  /* Estadísticas */
  get totalEmpleados(): number {
    return this.empleados.length;
  }

  get empleadosActivos(): number {
    return this.empleados.filter((empleado) => this.estaActivo(empleado)).length;
  }

  get empleadosInactivos(): number {
    return this.empleados.filter((empleado) => !this.estaActivo(empleado)).length;
  }

  get totalCajeros(): number {
    return this.empleados.filter((empleado) => String(empleado.cargo).toUpperCase() === 'CAJERO').length;
  }

  get filtrados(): EmpleadoSesion[] {
    const q = this.busqueda.trim().toLocaleLowerCase('es');
    return this.empleados.filter((e) => {
      const activo = this.estaActivo(e);
      if (this.filtro === 'activos' && !activo) return false;
      if (this.filtro === 'inactivos' && activo) return false;
      if (this.filtro === 'cajeros' && String(e.cargo).toUpperCase() !== 'CAJERO') return false;

      if (!q) return true;
      const nombreCompleto = `${e.nombreEmp || e.nombre || ''} ${e.apellidoPatEmp || ''} ${e.apellidoMatEmp || ''}`.toLocaleLowerCase('es');
      return (
        nombreCompleto.includes(q) ||
        (e.correo && e.correo.toLowerCase().includes(q)) ||
        (e.cargo && e.cargo.toLowerCase().includes(q)) ||
        (e.telefono && e.telefono.includes(q))
      );
    });
  }

  /* Modal de creación */
  nuevo(): void {
    this.editando = null;
    this.form = this.vacio();
    this.errores = { nombre: '', correo: '', idCargo: '', password: '' };
    this.modal = true;
  }

  /* Modal de edición */
  editar(empleado: EmpleadoSesion): void {
    this.editando = empleado.id;
    this.errores = { nombre: '', correo: '', idCargo: '', password: '' };
    this.form = {
      nombre: empleado.nombreEmp || empleado.nombre || '',
      apellidoPat: empleado.apellidoPatEmp || '',
      apellidoMat: empleado.apellidoMatEmp || '',
      correo: empleado.correo,
      telefono: empleado.telefono || '',
      fechaIngreso: empleado.fechaIngreso?.slice(0, 10) || '',
      fotoPerfil: empleado.fotoPerfil || '',
      idCargo: (empleado.cargoId || empleado.idCargo) ?? null,
      password: '',
    };
    this.modal = true;
  }

  /* Guardar */
  async guardar(): Promise<void> {
    if (this.guardando) return;

    this.errores = { nombre: '', correo: '', idCargo: '', password: '' };
    let valido = true;

    if (!this.form.nombre.trim()) {
      this.errores.nombre = 'El nombre es obligatorio.';
      valido = false;
    }

    if (!this.form.correo.trim()) {
      this.errores.correo = 'El correo electrónico es obligatorio.';
      valido = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.correo)) {
      this.errores.correo = 'El formato de correo no es válido.';
      valido = false;
    }

    if (!this.form.idCargo) {
      this.errores.idCargo = 'Debes seleccionar un cargo.';
      valido = false;
    }

    if (this.form.password && this.form.password.length < 8) {
      this.errores.password = 'La contraseña debe tener al menos 8 caracteres.';
      valido = false;
    }

    if (!valido) {
      await this.feedback('Verifica los campos señalados.', 'warning');
      return;
    }

    this.guardando = true;
    try {
      const empleado = this.editando
        ? await firstValueFrom(this.api.editar(this.editando, this.form))
        : await firstValueFrom(this.api.crear(this.form));

      this.empleados = this.upsert(empleado);
      this.modal = false;
      await this.feedback(
        this.editando ? 'Empleado actualizado correctamente.' : 'Empleado registrado correctamente.',
        'success',
      );
    } catch (error) {
      await this.feedback(
        error instanceof HttpErrorResponse && error.error?.message
          ? error.error.message
          : 'No pudimos guardar el empleado.',
        'danger',
      );
    } finally {
      this.guardando = false;
    }
  }

  /* Cambiar estado con confirmación */
  async cambiarEstado(empleado: EmpleadoSesion): Promise<void> {
    const id = empleado.id || empleado.idEmp;
    if (!id) return;

    const activo = this.estaActivo(empleado);
    const accion = activo ? 'Desactivar' : 'Activar';
    const confirmado = await this.dialog.confirm({
      title: `${accion} empleado`,
      message: activo
        ? `¿Estás seguro de desactivar a "${empleado.nombre || empleado.nombreEmp}"? Ya no podrá iniciar sesión ni acceder al sistema.`
        : `¿Deseas activar a "${empleado.nombre || empleado.nombreEmp}" para habilitar su acceso al sistema?`,
      type: activo ? 'danger' : 'success',
      icon: activo ? 'pause_circle' : 'check_circle',
      confirmText: accion,
      cancelText: 'Cancelar',
    });

    if (!confirmado) return;

    try {
      const actualizado = await firstValueFrom(this.api.estado(id, !activo));
      this.empleados = this.upsert(actualizado);
      await this.feedback(
        this.estaActivo(actualizado) ? 'Empleado activado con éxito.' : 'Empleado desactivado.',
        'success',
      );
    } catch {
      await this.feedback('No pudimos cambiar el estado.', 'danger');
    }
  }

  private upsert(empleado: EmpleadoSesion): EmpleadoSesion[] {
    const existe = this.empleados.some((item) => item.id === empleado.id);
    if (existe) {
      return this.empleados.map((item) => (item.id === empleado.id ? empleado : item));
    }
    return [...this.empleados, empleado];
  }

  private vacio(): EmpleadoDto {
    return {
      nombre: '',
      apellidoPat: '',
      apellidoMat: '',
      correo: '',
      telefono: '',
      fechaIngreso: '',
      fotoPerfil: '',
      idCargo: null,
      password: '',
    };
  }

  private async feedback(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toast.create({
      message,
      color,
      duration: 3000,
      position: 'top',
    });
    await toast.present();
  }
}

