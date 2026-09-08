import { Component, inject } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { ClienteAuthService } from '../services/cliente-auth.service';
import { ImagenesService } from '../services/imagenes.service';

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

  ionViewWillEnter(): void {
    // Asegurar renderizado inmediato
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
