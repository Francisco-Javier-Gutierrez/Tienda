import { getMessaging } from '../../config/firebase';
import { FcmRepository } from '../../db/repositories/fcm.repository';

export interface PushNotificationPayload {
  titulo: string;
  cuerpo: string;
  data?: Record<string, string>;
}

export interface IFcmService {
  registrarToken(data: {
    usuarioId: number;
    tipoUsuario: 'CLIENTE' | 'EMPLEADO';
    token: string;
    plataforma: 'ANDROID' | 'WEB';
    dispositivo?: string;
  }): Promise<void>;
  eliminarToken(usuarioId: number, tipoUsuario: 'CLIENTE' | 'EMPLEADO', token: string): Promise<void>;
  enviarACliente(idCliente: number, payload: PushNotificationPayload): Promise<{ exitosos: number; fallidos: number }>;
  enviarAEmpleados(payload: PushNotificationPayload): Promise<{ exitosos: number; fallidos: number }>;
}

export class FcmService implements IFcmService {
  constructor(private readonly fcmRepo = new FcmRepository()) {}

  async registrarToken(data: {
    usuarioId: number;
    tipoUsuario: 'CLIENTE' | 'EMPLEADO';
    token: string;
    plataforma: 'ANDROID' | 'WEB';
    dispositivo?: string;
  }): Promise<void> {
    if (!data.token) return;
    try {
      await this.fcmRepo.guardarToken(data);
    } catch (err) {
      console.warn('[FCM] Error guardando token:', err);
    }
  }

  async eliminarToken(usuarioId: number, tipoUsuario: 'CLIENTE' | 'EMPLEADO', token: string): Promise<void> {
    if (!token) return;
    try {
      await this.fcmRepo.eliminarToken(usuarioId, tipoUsuario, token);
    } catch (err) {
      console.warn('[FCM] Error eliminando token:', err);
    }
  }

  async enviarACliente(
    idCliente: number,
    payload: PushNotificationPayload,
  ): Promise<{ exitosos: number; fallidos: number }> {
    if (process.env.NODE_ENV === 'test') {
      return { exitosos: 0, fallidos: 0 };
    }
    try {
      const tokens = await this.fcmRepo.obtenerTokensUsuario(idCliente, 'CLIENTE');
      return await this.despacharNotificaciones(
        tokens.map((t) => t.token),
        payload,
      );
    } catch (err) {
      console.warn(`[FCM] No se pudieron enviar notificaciones al cliente ${idCliente}:`, err);
      return { exitosos: 0, fallidos: 0 };
    }
  }

  async enviarAEmpleados(payload: PushNotificationPayload): Promise<{ exitosos: number; fallidos: number }> {
    if (process.env.NODE_ENV === 'test') {
      return { exitosos: 0, fallidos: 0 };
    }
    try {
      const tokens = await this.fcmRepo.obtenerTokensEmpleados();
      return await this.despacharNotificaciones(
        tokens.map((t) => t.token),
        payload,
      );
    } catch (err) {
      console.warn('[FCM] No se pudieron enviar notificaciones a empleados:', err);
      return { exitosos: 0, fallidos: 0 };
    }
  }

  private async despacharNotificaciones(
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{ exitosos: number; fallidos: number }> {
    if (tokens.length === 0) {
      return { exitosos: 0, fallidos: 0 };
    }

    const messaging = getMessaging();
    if (!messaging) {
      console.warn('[FCM] Firebase messaging no está inicializado. Omitiendo envío de push.');
      return { exitosos: 0, fallidos: tokens.length };
    }

    let exitosos = 0;
    let fallidos = 0;

    const envios = tokens.map(async (token) => {
      try {
        await messaging.send({
          token,
          notification: {
            title: payload.titulo,
            body: payload.cuerpo,
          },
          data: payload.data || {},
          android: {
            priority: 'high',
            notification: {
              channelId: 'pedidos_channel',
              sound: 'default',
              clickAction: payload.data?.url || '/mis-pedidos',
            },
          },
          webpush: {
            notification: {
              title: payload.titulo,
              body: payload.cuerpo,
              icon: '/assets/icon/favicon.png',
              badge: '/assets/icon/favicon.png',
            },
            fcmOptions: {
              link: payload.data?.url || '/mis-pedidos',
            },
          },
        });
        exitosos++;
      } catch (err: any) {
        fallidos++;
        const errCode = err?.code || err?.errorInfo?.code;
        if (
          errCode === 'messaging/registration-token-not-registered' ||
          errCode === 'messaging/invalid-registration-token'
        ) {
          console.log(`[FCM] Token obsoleto detectado, eliminando: ${token}`);
          await this.fcmRepo.eliminarTokenInvalido(token);
        } else {
          console.warn(`[FCM] Error enviando notificación al token ${token}:`, err?.message || err);
        }
      }
    });

    await Promise.allSettled(envios);
    return { exitosos, fallidos };
  }
}
