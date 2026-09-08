import { HttpClient } from '@angular/common/http';
import { Component, inject, Input, OnInit, DestroyRef } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { ImagenesService } from '../../services/imagenes.service';

export type AdminSection =
  | 'inicio'
  | 'productos'
  | 'categorias'
  | 'marcas'
  | 'empleados'
  | 'cajero'
  | 'ventas'
  | 'pedidos-online'
  | 'configuracion'
  | 'catalogo';

interface TiendaMenu {
  nombreSuc: string | null;
  logoSuc: string | null;
}

@Component({
  selector: 'app-admin-shell',
  templateUrl: './admin-shell.component.html',
  styleUrls: ['./admin-shell.component.scss'],
  standalone: false,
})
export class AdminShellComponent implements OnInit {
  @Input({ required: true }) menuId = '';
  @Input({ required: true }) contentId = '';
  @Input({ required: true }) activeSection: AdminSection = 'inicio';
  @Input() customTitle?: string;
  @Input() showDateBadge = true;

  readonly auth = inject(AuthService);
  readonly imagenes = inject(ImagenesService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  tienda: TiendaMenu | null = null;
  sidebarAbierto = false;

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.cerrarSidebar();
      });
  }

  ngOnInit(): void {
    this.http.get<TiendaMenu[]>(`${environment.API_BASE_URL}/public/tienda`).subscribe({
      next: (tiendas) => (this.tienda = tiendas.length === 1 ? tiendas[0] : null),
      error: () => undefined,
    });
  }

  abrirSidebar(): void {
    this.sidebarAbierto = true;
  }

  cerrarSidebar(): void {
    this.sidebarAbierto = false;
  }

  toggleSidebar(): void {
    this.sidebarAbierto = !this.sidebarAbierto;
  }

  get nombreTienda(): string {
    return this.tienda?.nombreSuc?.trim() || this.auth.sesion?.empleado.nombreSuc?.trim() || 'Mi tienda';
  }

  get esAdministrador(): boolean {
    return this.auth.tieneRol('ADMINISTRADOR');
  }
  resolverLogo(): string | null {
    return this.imagenes.resolver(this.tienda?.logoSuc);
  }
  resolverAvatar(): string | null {
    return this.imagenes.resolver(this.auth.sesion?.empleado.fotoPerfil);
  }

  onAvatarError(): void {
    const foto = this.auth.sesion?.empleado.fotoPerfil;
    if (foto) {
      this.imagenes.marcarFallida(foto);
    }
  }
}
