import { Injectable } from '@angular/core';
import { SocialLogin, SocialLoginError } from '@capgo/capacitor-social-login';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private inicializado = false;

  async obtenerIdToken(): Promise<string> {
    if (!environment.GOOGLE_WEB_CLIENT_ID) throw new Error('GOOGLE_NOT_CONFIGURED');
    if (!this.inicializado) {
      await SocialLogin.initialize({
        google: { webClientId: environment.GOOGLE_WEB_CLIENT_ID, mode: 'online' },
      });
      this.inicializado = true;
    }
    const resultado = await SocialLogin.login({
      provider: 'google',
      options: {},
    });
    const idToken = 'idToken' in resultado.result ? resultado.result.idToken : null;
    if (!idToken) throw new Error('GOOGLE_ID_TOKEN_MISSING');
    return idToken;
  }

  async logout(): Promise<void> {
    if (!this.inicializado) return;
    try {
      await SocialLogin.logout({ provider: 'google' });
    } catch {
      /* La sesión local ya fue cerrada. */
    }
  }

  esCancelacion(error: unknown): boolean {
    return (error as SocialLoginError | undefined)?.code === 'USER_CANCELLED';
  }
}



