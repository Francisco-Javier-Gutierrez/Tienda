import { Request, Response } from 'express';
import { mermasService, IMermasService } from './mermas.service';

export class MermasController {
  constructor(private service: IMermasService = mermasService) {}

  async registrar(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const merma = await this.service.registrarMerma(req.empleado, req.body);
    res.status(201).json(merma);
  }

  async listar(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const mermas = await this.service.listarMermas(req.empleado.idSuc, req.query);
    res.json(mermas);
  }

  async resumen(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const resumen = await this.service.obtenerResumen(req.empleado.idSuc, req.query);
    res.json(resumen);
  }

  async detalle(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const merma = await this.service.obtenerPorId(id, req.empleado.idSuc);
    res.json(merma);
  }

  async actualizarEstado(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const merma = await this.service.actualizarEstado(id, req.body?.estado, req.empleado.idSuc);
    res.json(merma);
  }
}

export const mermasController = new MermasController();
