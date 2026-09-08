import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { CarritoService } from '../../services/carrito.service';
import { ClienteAuthService } from '../../services/cliente-auth.service';
import { ImagenesService } from '../../services/imagenes.service';

interface TiendaPublica {
  nombreSuc: string | null;
  logoSuc: string | null;
}

@Component({
  selector: 'app-cliente-shell',
  templateUrl: './cliente-shell.component.html',
  styleUrls: ['./cliente-shell.component.scss'],
  standalone: false,
})
export class ClienteShellComponent implements OnInit {
  readonly clienteAuth = inject(ClienteAuthService);
  readonly auth = inject(AuthService);
  readonly carrito = inject(CarritoService);
  private readonly http = inject(HttpClient);
  readonly imagenes = inject(ImagenesService);
  private readonly router = inject(Router);
  tienda: TiendaPublica | null = null;

  ngOnInit(): void {
    this.http.get<TiendaPublica[]>(`${environment.API_BASE_URL}/public/tienda`).subscribe({
      next: (tiendas) => (this.tienda = tiendas.length === 1 ? tiendas[0] : null),
      error: () => undefined,
    });
  }

  get estaAutenticado(): boolean {
    return this.clienteAuth.estaAutenticado() || this.auth.estaAutenticado();
  }

  get esEmpleado(): boolean {
    return this.auth.estaAutenticado();
  }

  get rolEmpleado(): string | null {
    return this.auth.sesion?.empleado?.cargo || null;
  }

  get rutaPanel(): string {
    return this.auth.tieneRol('ADMINISTRADOR') ? '/home' : '/cajero';
  }

  get nombreUsuario(): string | null {
    if (this.auth.sesion?.empleado?.nombre) {
      return this.auth.sesion.empleado.nombre.split(' ')[0];
    }
    if (this.clienteAuth.sesion?.cliente?.nombre) {
      return this.clienteAuth.sesion.cliente.nombre.split(' ')[0];
    }
    return null;
  }

  get nombreTienda(): string {
    return this.tienda?.nombreSuc?.trim() || this.auth.sesion?.empleado?.nombreSuc?.trim() || 'Mi tienda';
  }

  logo(): string | null {
    return this.imagenes.resolver(this.tienda?.logoSuc);
  }

  avatar(): string | null {
    if (this.auth.sesion?.empleado?.fotoPerfil) {
      return this.imagenes.resolver(this.auth.sesion.empleado.fotoPerfil);
    }
    return this.imagenes.resolver(this.clienteAuth.sesion?.cliente?.fotoPerfil);
  }

  onAvatarError(): void {
    const foto = this.auth.sesion?.empleado?.fotoPerfil || this.clienteAuth.sesion?.cliente?.fotoPerfil;
    if (foto) {
      this.imagenes.marcarFallida(foto);
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
