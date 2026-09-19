import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AUTH_SESSION_STORE, CLIENTE_SESSION_STORE } from './tokens';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);
  private readonly authSession = inject(AUTH_SESSION_STORE);
  private readonly clienteSession = inject(CLIENTE_SESSION_STORE);

  private readonly TOKEN_STORAGE_KEY = 'tienda.fcm.token';
  private fcmToken: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem(this.TOKEN_STORAGE_KEY) : null;
  private plataforma: 'ANDROID' | 'WEB' = 'WEB';
  private inicializado = false;
  public ultimoError: string | null = null;

  get tokenActual(): string | null {
    return this.fcmToken || (typeof localStorage !== 'undefined' ? localStorage.getItem(this.TOKEN_STORAGE_KEY) : null);
  }

  async inicializar(forzar = false): Promise<void> {
    if (this.inicializado && !forzar) return;
    this.inicializado = true;
    this.ultimoError = null;

    if (Capacitor.isNativePlatform()) {
      this.plataforma = 'ANDROID';
      await this.inicializarAndroid();
    } else {
      this.plataforma = 'WEB';
      await this.inicializarWeb(forzar);
    }
  }

  /**
   * Inicialización nativa para Android vía @capacitor/push-notifications
   */
  private async inicializarAndroid(): Promise<void> {
    try {
      console.log('[FCM-Android] Verificando permisos...');
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[FCM-Android] Estado inicial de permisos:', permStatus);

      if (permStatus.receive !== 'granted') {
        console.log('[FCM-Android] Solicitando permisos nativos...');
        permStatus = await PushNotifications.requestPermissions();
        console.log('[FCM-Android] Estado tras solicitar permisos:', permStatus);
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[FCM-Android] Permisos de notificaciones no otorgados por el usuario.');
        return;
      }

      // Crear canal de alta prioridad para pedidos
      await PushNotifications.createChannel({
        id: 'pedidos_channel',
        name: 'Pedidos y Comprobantes',
        description: 'Actualizaciones de pedidos, pagos y entregas',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
      });

      // Escuchar registro exitoso del token
      await PushNotifications.addListener('registration', (token: Token) => {
        console.log('[FCM-Android] Token recibido:', token.value);
        this.fcmToken = token.value;
        if (typeof localStorage !== 'undefined') localStorage.setItem(this.TOKEN_STORAGE_KEY, token.value);
        void this.sincronizarTokenConBackend(token.value, 'ANDROID');
      });

      // Escuchar errores de registro
      await PushNotifications.addListener('registrationError', (err: any) => {
        console.error('[FCM-Android] Error en registro de push:', err);
      });

      // Notificación recibida en primer plano (Foreground)
      await PushNotifications.addListener('pushNotificationReceived', async (notification: PushNotificationSchema) => {
        console.log('[FCM-Android] Notificación recibida en primer plano:', notification);
        await this.mostrarNotificacionEnApp(
          notification.title || 'DonaPaty',
          notification.body || '',
          notification.data?.url,
        );
      });

      // Notificación tocada / abierta por el usuario (Background / Closed)
      await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('[FCM-Android] Acción de notificación tocada:', notification);
        const targetUrl = notification.notification.data?.url || '/mis-pedidos';
        void this.router.navigateByUrl(targetUrl);
      });

      // Solicitar registro en Firebase
      await PushNotifications.register();
    } catch (error) {
      console.warn('[FCM-Android] Error inicializando notificaciones push:', error);
    }
  }

  /**
   * Inicialización para Navegador Web vía Service Worker y Firebase Web SDK
   */
  private async inicializarWeb(forzar = false): Promise<void> {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        this.ultimoError = 'Este navegador no soporta notificaciones push.';
        console.warn('[FCM-Web]', this.ultimoError);
        return;
      }

      let permission = Notification.permission;
      if (permission === 'denied') {
        this.ultimoError = 'Las notificaciones están bloqueadas en este navegador. Haz clic en el candado junto a la URL y permite las notificaciones.';
        console.warn('[FCM-Web]', this.ultimoError);
        return;
      }

      if (permission !== 'granted') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        this.ultimoError = 'Permiso de notificaciones no otorgado por el usuario.';
        console.warn('[FCM-Web]', this.ultimoError);
        return;
      }

      // Registrar el service worker en la raíz
      let swRegistration: ServiceWorkerRegistration;
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        console.log('[FCM-Web] Service Worker registrado:', swRegistration);
      } catch (swErr: any) {
        this.ultimoError = `Error al registrar Service Worker: ${swErr?.message || swErr}`;
        console.error('[FCM-Web]', this.ultimoError, swErr);
        return;
      }

      // Asegurar que el Service Worker esté activo sin riesgo de cuelgue infinito
      if (swRegistration.installing || swRegistration.waiting) {
        await new Promise<void>((resolve) => {
          const sw = swRegistration.installing || swRegistration.waiting;
          if (!sw || sw.state === 'activated') return resolve();
          const onStateChange = () => {
            if (sw.state === 'activated') {
              sw.removeEventListener('statechange', onStateChange);
              resolve();
            }
          };
          sw.addEventListener('statechange', onStateChange);
          setTimeout(resolve, 3000);
        });
      }

      // Cargar dinámicamente el SDK modular de Firebase Web
      const { initializeApp, getApps } = await import('firebase/app');
      const { getMessaging, getToken, deleteToken, onMessage } = await import('firebase/messaging');

      const app = getApps().length === 0 ? initializeApp(environment.FIREBASE_CONFIG) : getApps()[0];
      const messaging = getMessaging(app);

      if (forzar) {
        try {
          await deleteToken(messaging);
          this.fcmToken = null;
          if (typeof localStorage !== 'undefined') localStorage.removeItem(this.TOKEN_STORAGE_KEY);
          console.log('[FCM-Web] Token anterior invalidado para renovación limpia.');
        } catch (delErr) {
          console.log('[FCM-Web] No fue necesario eliminar token anterior:', delErr);
        }
      }

      const vapidKey = environment.FIREBASE_VAPID_KEY || undefined;
      const currentToken = await getToken(messaging, {
        serviceWorkerRegistration: swRegistration,
        ...(vapidKey ? { vapidKey } : {}),
      });

      if (currentToken) {
        console.log('[FCM-Web] Token Web recibido exitosamente:', currentToken);
        this.fcmToken = currentToken;
        this.ultimoError = null;
        if (typeof localStorage !== 'undefined') localStorage.setItem(this.TOKEN_STORAGE_KEY, currentToken);
        await this.sincronizarTokenConBackend(currentToken, 'WEB');
      } else {
        this.ultimoError = 'El navegador no devolvió un token de notificación válido.';
      }

      // Escuchar mensajes en primer plano en la pestaña del navegador
      onMessage(messaging, (payload) => {
        console.log('[FCM-Web] Mensaje en primer plano:', payload);
        const data = payload.data as Record<string, string> | undefined;
        const title = payload.notification?.title || data?.['title'] || 'DonaPaty';
        const body = payload.notification?.body || data?.['body'] || '';
        const url = payload.fcmOptions?.link || data?.['url'];
        void this.mostrarNotificacionEnApp(title, body, url);
      });
    } catch (error: any) {
      const rawMsg = error?.message || String(error);
      const isBrave =
        Boolean((navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function') ||
        navigator.userAgent.toLowerCase().includes('brave');

      if (isBrave || rawMsg.includes('push service error') || rawMsg.includes('token-subscribe-failed')) {
        this.ultimoError =
          'Brave bloquea notificaciones push por defecto. Entra a brave://settings/privacy, activa "Usar los servicios de Google para la mensajería push" y reinicia Brave.';
      } else {
        this.ultimoError = `Error al registrar push web: ${rawMsg}`;
      }
      console.warn('[FCM-Web]', this.ultimoError, error);
    }
  }

  /**
   * Muestra un Toast interactivo si la app está en primer plano
   */
  private async mostrarNotificacionEnApp(titulo: string, cuerpo: string, url?: string): Promise<void> {
    const toast = await this.toast.create({
      header: titulo,
      message: cuerpo,
      position: 'top',
      duration: 5000,
      color: 'primary',
      buttons: [
        {
          text: 'Ver',
          handler: () => {
            if (url) void this.router.navigateByUrl(url);
          },
        },
        {
          text: 'Cerrar',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }

  /**
   * Envía el token al backend de AWS si el usuario está autenticado
   */
  async sincronizarTokenConBackend(
    token = this.fcmToken || (typeof localStorage !== 'undefined' ? localStorage.getItem(this.TOKEN_STORAGE_KEY) : null),
    plataforma = this.plataforma,
  ): Promise<boolean> {
    if (!token) return false;
    this.fcmToken = token;
    if (typeof localStorage !== 'undefined') localStorage.setItem(this.TOKEN_STORAGE_KEY, token);

    const tokenAuth = this.clienteSession?.token || this.authSession?.token;
    if (!tokenAuth) {
      console.log('[FCM] Token guardado localmente en espera de autenticación.');
      return false;
    }

    try {
      const url = `${environment.API_BASE_URL}/notificaciones/token`;
      const dispositivo = Capacitor.isNativePlatform() ? 'Android Device' : navigator.userAgent.slice(0, 80);

      const res = await firstValueFrom(
        this.http.post(url, {
          token,
          plataforma,
          dispositivo,
        }),
      );
      console.log('[FCM] Token sincronizado exitosamente con el backend:', res);
      return true;
    } catch (e: any) {
      console.warn('[FCM] Error sincronizando token con el backend:', e?.status, e?.message);
      throw e;
    }
  }

  /**
   * Elimina el token del backend al cerrar sesión
   */
  async desregistrarToken(): Promise<void> {
    const token = this.fcmToken || (typeof localStorage !== 'undefined' ? localStorage.getItem(this.TOKEN_STORAGE_KEY) : null);
    if (!token) return;

    try {
      const url = `${environment.API_BASE_URL}/notificaciones/token/${encodeURIComponent(token)}`;
      await firstValueFrom(this.http.delete(url));
      console.log('[FCM] Token eliminado del backend tras logout.');
    } catch (e) {
      console.warn('[FCM] Error eliminando token en logout:', e);
    } finally {
      this.fcmToken = null;
      if (typeof localStorage !== 'undefined') localStorage.removeItem(this.TOKEN_STORAGE_KEY);
    }
  }

  /**
   * Dispara una notificación de prueba para el usuario actual
   */
  async enviarNotificacionPrueba(): Promise<{ exitosos: number; message: string }> {
    try {
      const url = `${environment.API_BASE_URL}/notificaciones/test`;
      const res: any = await firstValueFrom(this.http.post(url, {}));
      const mensaje = res?.message || 'Prueba enviada';
      return { exitosos: res?.exitosos ?? 0, message: mensaje };
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Error al enviar prueba';
      throw new Error(msg);
    }
  }
}
