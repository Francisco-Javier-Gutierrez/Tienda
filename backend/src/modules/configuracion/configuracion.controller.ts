import { Request, Response } from 'express';
import { configuracionService } from './configuracion.service';
import { idValido } from '../../utils/formatters';

export class ConfiguracionController {
  async obtenerAdmin(req: Request, res: Response): Promise<void> {
    const idSuc = idValido(req.empleado?.idSuc);
    if (!idSuc) {
      res.status(409).json({ message: 'El administrador no tiene una sucursal asignada.' });
      return;
    }
    const configuracion = await configuracionService.obtenerAdmin(idSuc);
      res.json({ configuracion });
  }

  async actualizarAdmin(req: Request, res: Response): Promise<void> {
    const idSuc = idValido(req.empleado?.idSuc);
    if (!idSuc) {
      res.status(409).json({ message: 'El administrador no tiene una sucursal asignada.' });
      return;
    }
    const configuracion = await configuracionService.actualizarAdmin(idSuc, req.body);
      res.json({ configuracion });
  }

  async obtenerCliente(req: Request, res: Response): Promise<void> {
    const configuracion = await configuracionService.obtenerCliente();
      res.json({ configuracion });
  }
}

export const configuracionController = new ConfiguracionController();
