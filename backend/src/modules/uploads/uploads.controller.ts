import { Request, Response } from 'express';
import { uploadsService, IUploadsService } from './uploads.service';
import { verificarToken } from '../../utils/security';
import { texto } from '../../utils/formatters';

export class UploadsController {
  constructor(private service: IUploadsService = uploadsService) {}

  async presign(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization || '';
    const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];
    if (!token) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    let payload: any;
    try {
      payload = verificarToken(token);
    } catch {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const resultado = await this.service.solicitarPresign(payload, {
      tipo: req.body?.tipo,
      mimeType: req.body?.mimeType,
      extension: req.body?.extension,
      nombreOriginal: req.body?.filename || req.body?.nombreOriginal || req.body?.nombre,
    });

    res.json(resultado);
  }
}

export const uploadsController = new UploadsController();
