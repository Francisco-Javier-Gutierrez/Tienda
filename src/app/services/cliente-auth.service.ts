import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ClienteAuthSession, ClienteSesion } from '../models/cliente-auth';
import { ClienteSessionStore } from './cliente-session.service';
import { GoogleIdentityService } from './google-identity.service';
import { PushNotificationService } from './push-notification.service';

@Injectable({ providedIn: 'root' })
export class ClienteAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly store = inject(ClienteSessionStore);
  private readonly google = inject(GoogleIdentityService);
  private readonly pushService = inject(PushNotificationService);
  readonly sesion$ = this.store.sesion$;

  get sesion(): ClienteAuthSession | null {
    return this.store.sesion;
  }
  get token(): string | null {
    return this.store.token;
  }
  estaAutenticado(): boolean {
    return Boolean(this.token);
  }

  async loginGoogle(): Promise<ClienteAuthSession> {
    const idToken = await this.google.obtenerIdToken();
    return firstValueFrom(
      this.http.post<ClienteAuthSession>(`${environment.API_BASE_URL}/auth/google/cliente`, { idToken }),
    );
  }

  guardarSesion(sesion: ClienteAuthSession): void {
    this.store.guardar(sesion);
    void this.pushService.sincronizarTokenConBackend();
  }
  limpiarSesion(): void {
    this.store.limpiar();
  }
  me(): Observable<{ cliente: ClienteSesion }> {
    return this.http.get<{ cliente: ClienteSesion }>(`${environment.API_BASE_URL}/auth/cliente/me`);
  }

  async restaurarSesion(): Promise<void> {
    if (!this.token) return;
    try {
      const respuesta = await firstValueFrom(this.me());
      this.guardarSesion({ token: this.token!, cliente: respuesta.cliente });
    } catch {
      this.limpiarSesion();
    }
  }

  async logout(): Promise<void> {
    await this.pushService.desregistrarToken();
    this.store.limpiar();
    await this.google.logout();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  esCancelacionGoogle(error: unknown): boolean {
    return this.google.esCancelacion(error);
  }
}
