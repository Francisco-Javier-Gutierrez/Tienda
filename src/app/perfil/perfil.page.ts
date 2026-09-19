import { Component, inject } from '@angular/core';
import { ToastController, ViewWillEnter } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { ClienteAuthService } from '../services/cliente-auth.service';
import { ImagenesService } from '../services/imagenes.service';
import { PushNotificationService } from '../services/push-notification.service';

export interface PerfilUsuario {
  nombre: string;
  apellidos: string;
  correo: string;
  fotoPerfil: string | null;
  rol: string;
  esEmpleado: boolean;
  sucursal?: string | null;
  telefono?: string | null;
  fecha?: string | Date | null;
  etiquetaFecha: string;
}

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: false,
})
export class PerfilPage implements ViewWillEnter {
  readonly auth = inject(AuthService);
  readonly clienteAuth = inject(ClienteAuthService);
  readonly imagenes = inject(ImagenesService);
  readonly pushService = inject(PushNotificationService);
  private readonly toastCtrl = inject(ToastController);

  probandoNotificacion = false;
  sincronizandoNotificaciones = false;

  async ionViewWillEnter(): Promise<void> {
    // Si en el navegador ya hay permiso concedido pero aún no hay token cargado, intentar inicializar
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      !this.pushService.tokenActual
    ) {
      await this.pushService.inicializar(true);
    }
  }

  async probarNotificacion(): Promise<void> {
    this.probandoNotificacion = true;
    try {
      const res = await this.pushService.enviarNotificacionPrueba();
      if (res.exitosos > 0) {
        await this.mostrarToast(`Notificación enviada a ${res.exitosos} dispositivo(s).`, 'success');
      } else {
        await this.mostrarToast('El servidor procesó el envío, pero no reportó dispositivos activos.', 'warning');
      }
    } catch (err: any) {
      await this.mostrarToast(err?.message || 'Error al enviar notificación de prueba.', 'danger');
    } finally {
      this.probandoNotificacion = false;
    }
  }

  async reactivarNotificaciones(): Promise<void> {
    this.sincronizandoNotificaciones = true;
    try {
      await this.pushService.inicializar(true);
      if (this.pushService.tokenActual) {
        await this.pushService.sincronizarTokenConBackend();
        await this.mostrarToast('Notificaciones activadas y sincronizadas exitosamente.', 'success');
      } else if (this.pushService.ultimoError) {
        await this.mostrarToast(this.pushService.ultimoError, 'warning', 8000);
      } else {
        await this.mostrarToast('No se pudo obtener el token de notificaciones.', 'warning');
      }
    } catch (err: any) {
      await this.mostrarToast(err?.message || 'Error al sincronizar notificaciones.', 'danger');
    } finally {
      this.sincronizandoNotificaciones = false;
    }
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'warning' | 'danger', duration = 4000): Promise<void> {
    const t = await this.toastCtrl.create({
      message: mensaje,
      duration,
      color,
      position: 'top',
      buttons: [{ text: 'Cerrar', role: 'cancel' }],
    });
    await t.present();
  }

  get esEmpleado(): boolean {
    return this.auth.estaAutenticado();
  }

  get usuario(): PerfilUsuario | null {
    if (this.clienteAuth.sesion?.cliente) {
      const c = this.clienteAuth.sesion.cliente;
      return {
        nombre: c.nombre || '',
        apellidos: [c.apellidoPat, c.apellidoMat].filter(Boolean).join(' ') || '—',
        correo: c.correo || '',
        fotoPerfil: c.fotoPerfil,
        rol: 'CLIENTE',
        esEmpleado: false,
        sucursal: null,
        telefono: null,
        fecha: c.fechaRegistro,
        etiquetaFecha: 'Cliente Desde',
      };
    }
    if (this.auth.sesion?.empleado) {
      const e = this.auth.sesion.empleado;
      return {
        nombre: e.nombreEmp || e.nombre || '',
        apellidos: [e.apellidoPatEmp, e.apellidoMatEmp].filter(Boolean).join(' ') || '—',
        correo: e.correo || '',
        fotoPerfil: e.fotoPerfil,
        rol: e.cargo || 'EMPLEADO',
        esEmpleado: true,
        sucursal: e.nombreSuc,
        telefono: e.telefono,
        fecha: e.fechaIngreso,
        etiquetaFecha: 'Fecha de Ingreso',
      };
    }
    return null;
  }

  foto(ruta: string | null | undefined): string | null {
    return this.imagenes.resolver(ruta);
  }

  onFotoError(ruta: string | null | undefined): void {
    if (ruta) {
      this.imagenes.marcarFallida(ruta);
    }
  }

  async logout(): Promise<void> {
    if (this.auth.estaAutenticado()) {
      await this.auth.logout();
    } else if (this.clienteAuth.estaAutenticado()) {
      await this.clienteAuth.logout();
    }
  }
}
