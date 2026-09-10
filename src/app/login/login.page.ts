import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SucursalService } from '../services/sucursal.service';
import { AuthService } from '../services/auth.service';
import { ClienteAuthService } from '../services/cliente-auth.service';

interface TiendaPublica {
  nombreSuc: string | null;
  descripcionSuc: string | null;
  logoSuc: string | null;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  correo = '';
  password = '';
  mostrarPassword = false;
  autenticando = false;
  tienda: TiendaPublica | null = null;
  readonly googleConfigurado = Boolean(environment.GOOGLE_WEB_CLIENT_ID);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly clienteAuth = inject(ClienteAuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);
  private readonly route = inject(ActivatedRoute);
  private readonly imagenes = inject(SucursalService);

  ngOnInit(): void {
    if (this.auth.estaAutenticado()) {
      void this.irSegunRol();
      return;
    }
    if (this.clienteAuth.estaAutenticado()) {
      void this.router.navigateByUrl(this.returnUrlCliente(), { replaceUrl: true });
      return;
    }
    this.http.get<TiendaPublica[]>(`${environment.API_BASE_URL}/public/tienda`).subscribe({
      next: (tiendas) => (this.tienda = tiendas.length === 1 ? tiendas[0] : null),
      error: () => undefined,
    });
  }
  get nombreTienda(): string {
    return this.tienda?.nombreSuc?.trim() || 'Mi tienda';
  }
  resolverLogo(): string | null {
    return this.imagenes.resolverImagen(this.tienda?.logoSuc);
  }

  async ingresar(): Promise<void> {
    if (this.autenticando) return;
    const correo = this.correo.trim().toLowerCase();
    if (!correo) return this.feedback('Ingresa tu correo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return this.feedback('Ingresa un correo válido.');
    this.autenticando = true;
    try {
      try {
        const sesion = await firstValueFrom(this.auth.login(correo, this.password));
        this.clienteAuth.limpiarSesion();
        this.auth.guardarSesion(sesion, this.password);
        this.password = '';
        await this.irSegunRol();
        return;
      } catch (error: unknown) {
        const esErrorConexion =
          error instanceof HttpErrorResponse && (error.status === 0 || error.status === 504 || error.status === 503);
        if (esErrorConexion) {
          const sesionOffline = await this.auth.loginOffline(correo, this.password);
          if (sesionOffline) {
            this.clienteAuth.limpiarSesion();
            this.auth.guardarSesion(sesionOffline);
            this.password = '';
            await this.feedback('Sesión iniciada en modo offline.', 'warning');
            await this.irSegunRol();
            return;
          }
        }
        throw error;
      }
    } catch (error: unknown) {
      await this.feedback(this.mensajeError(error));
    } finally {
      this.autenticando = false;
    }
  }

  async ingresarGoogle(): Promise<void> {
    if (this.autenticando || !this.googleConfigurado) return;
    this.autenticando = true;
    try {
      const sesion = await this.clienteAuth.loginGoogle();
      this.auth.limpiarSesion();
      this.clienteAuth.guardarSesion(sesion);
      await this.router.navigateByUrl(this.returnUrlCliente(), { replaceUrl: true });
    } catch (error: unknown) {
      if (!this.clienteAuth.esCancelacionGoogle(error)) await this.feedback(this.mensajeError(error));
    } finally {
      this.autenticando = false;
    }
  }

  private async irSegunRol(): Promise<void> {
    await this.router.navigateByUrl(this.auth.tieneRol('ADMINISTRADOR') ? '/home' : '/cajero', { replaceUrl: true });
  }
  private returnUrlCliente(): string {
    const permitidas = ['/checkout', '/carrito', '/catalogo', '/mis-pedidos', '/perfil'];
    const solicitada = this.route.snapshot.queryParamMap.get('returnUrl') || '';
    return permitidas.includes(solicitada) || /^\/mis-pedidos\/\d+$/.test(solicitada) ? solicitada : '/catalogo';
  }
  private async feedback(message: string, color: string = 'danger'): Promise<void> {
    const t = await this.toast.create({
      message,
      duration: 3200,
      position: 'top',
      color,
      cssClass: 'pastel-toast',
    });
    await t.present();
  }
  private mensajeError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse))
      return error instanceof Error && error.message === 'GOOGLE_NOT_CONFIGURED'
        ? 'Google aún no está configurado.'
        : 'No pudimos iniciar sesión.';
    if (error.status === 0) return 'No pudimos conectar con el servidor.';
    return typeof error.error?.message === 'string' ? error.error.message : 'No pudimos iniciar sesión.';
  }
}
