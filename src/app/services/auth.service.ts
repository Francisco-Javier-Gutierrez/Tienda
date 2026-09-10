import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthSession, EmpleadoSesion, Rol } from '../models/auth';
import { AuthSessionStore } from './auth-session.service';
import { GoogleIdentityService } from './google-identity.service';
import { SqliteService } from './sqlite.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly store = inject(AuthSessionStore);
  private readonly google = inject(GoogleIdentityService);
  private readonly sqlite = inject(SqliteService);
  readonly sesion$ = this.store.sesion$;

  get sesion(): AuthSession | null {
    return this.store.sesion;
  }
  get token(): string | null {
    return this.store.token;
  }
  estaAutenticado(): boolean {
    return Boolean(this.token);
  }
  tieneRol(...roles: Rol[]): boolean {
    return Boolean(this.sesion && roles.includes(this.sesion.empleado.cargo));
  }

  private credencialesOffline: { correo: string; password: string } | null = null;

  login(correo: string, password: string): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${environment.API_BASE_URL}/auth/login`, {
      correo: correo.trim().toLowerCase(),
      password,
    });
  }

  async loginOffline(correo: string, password: string): Promise<AuthSession | null> {
    const empleado = await this.sqlite.verificarUsuarioOffline(correo, password);
    if (!empleado) return null;

    this.credencialesOffline = { correo: correo.trim().toLowerCase(), password };
    const sesion: AuthSession = {
      token: `offline-token-${Date.now()}`,
      empleado,
    };
    return sesion;
  }

  async reautenticarSiEsNecesario(): Promise<boolean> {
    if (!this.token || !this.token.startsWith('offline-token-')) {
      return Boolean(this.token);
    }
    if (!this.credencialesOffline) {
      return false;
    }
    try {
      const sesion = await firstValueFrom(
        this.login(this.credencialesOffline.correo, this.credencialesOffline.password),
      );
      this.guardarSesion(sesion, this.credencialesOffline.password);
      return true;
    } catch (error) {
      console.error('No fue posible reautenticar sesión online automáticamente:', error);
      return false;
    }
  }

  async loginGoogle(): Promise<AuthSession> {
    const idToken = await this.google.obtenerIdToken();
    return firstValueFrom(this.http.post<AuthSession>(`${environment.API_BASE_URL}/auth/google`, { idToken }));
  }

  guardarSesion(sesion: AuthSession, password?: string): void {
    this.store.guardar(sesion);
    if (this.sqlite.disponible && sesion.empleado) {
      void this.sqlite.guardarUsuarioOffline(sesion.empleado, password);
    }
  }

  me(): Observable<{ empleado: EmpleadoSesion }> {
    return this.http.get<{ empleado: EmpleadoSesion }>(`${environment.API_BASE_URL}/auth/me`);
  }

  async restaurarSesion(): Promise<void> {
    if (!this.token) return;
    if (this.token.startsWith('offline-token-')) {
      return;
    }
    try {
      const respuesta = await firstValueFrom(this.me());
      this.guardarSesion({ token: this.token!, empleado: respuesta.empleado });
    } catch (error: unknown) {
      const esOffline = error instanceof HttpErrorResponse && (error.status === 0 || error.status === 504);
      if (!esOffline) {
        this.limpiarSesion();
      }
    }
  }

  async logout(): Promise<void> {
    this.store.limpiar();
    await this.google.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  limpiarSesion(): void {
    this.store.limpiar();
  }

  esCancelacionGoogle(error: unknown): boolean {
    return this.google.esCancelacion(error);
  }
}
