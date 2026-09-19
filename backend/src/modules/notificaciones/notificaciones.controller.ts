import { Request, Response, NextFunction } from 'express';
import { FcmService } from './fcm.service';

export class NotificacionesController {
  constructor(private readonly fcmService = new FcmService()) {}

  registrarToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, plataforma, dispositivo } = req.body;

      if (!token || typeof token !== 'string') {
        res.status(400).json({ message: 'El token FCM es requerido' });
        return;
      }

      const plataformaNormalizada = (plataforma || 'WEB').toUpperCase() === 'ANDROID' ? 'ANDROID' : 'WEB';

      const usuarioId = req.cliente?.idCliente || req.empleado?.idEmp;
      const tipoUsuario = req.cliente ? 'CLIENTE' : 'EMPLEADO';

      if (!usuarioId) {
        res.status(401).json({ message: 'No autenticado' });
        return;
      }

      await this.fcmService.registrarToken({
        usuarioId,
        tipoUsuario,
        token: token.trim(),
        plataforma: plataformaNormalizada,
        dispositivo: dispositivo || 'Dispositivo Desconocido',
      });

      res.status(200).json({ success: true, message: 'Token FCM registrado exitosamente' });
    } catch (error) {
      next(error);
    }
  };

  eliminarToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.params.token || req.body?.token;
      const usuarioId = req.cliente?.idCliente || req.empleado?.idEmp;
      const tipoUsuario = req.cliente ? 'CLIENTE' : 'EMPLEADO';

      if (!token) {
        res.status(400).json({ message: 'El token FCM es requerido' });
        return;
      }

      if (!usuarioId) {
        res.status(401).json({ message: 'No autenticado' });
        return;
      }

      await this.fcmService.eliminarToken(usuarioId, tipoUsuario, token.trim());
      res.status(200).json({ success: true, message: 'Token FCM desregistrado exitosamente' });
    } catch (error) {
      next(error);
    }
  };

  enviarPrueba = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usuarioId = req.cliente?.idCliente || req.empleado?.idEmp;
      const tipoUsuario = req.cliente ? 'CLIENTE' : 'EMPLEADO';

      if (!usuarioId) {
        res.status(401).json({ message: 'No autenticado' });
        return;
      }

      const payload = {
        titulo: '🔔 Notificación de Prueba DonaPaty',
        cuerpo: '¡Las notificaciones push están configuradas y funcionando correctamente!',
        data: { url: '/catalogo', fecha: new Date().toISOString() },
      };

      const resultado =
        tipoUsuario === 'CLIENTE'
          ? await this.fcmService.enviarACliente(usuarioId, payload)
          : await this.fcmService.enviarAEmpleados(payload);

      res.status(200).json({
        success: true,
        message:
          resultado.exitosos > 0
            ? `Notificación enviada exitosamente a ${resultado.exitosos} dispositivo(s).`
            : 'No se encontraron tokens registrados para este usuario o falló el despacho.',
        ...resultado,
      });
    } catch (error) {
      next(error);
    }
  };
}
