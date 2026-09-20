import { Request, Response } from 'express';
import { fiadosService, IFiadosService } from './fiados.service';

export class FiadosController {
  constructor(private service: IFiadosService = fiadosService) {}

  async listarDeudores(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const deudores = await this.service.listarDeudores(req.empleado.idSuc);
    res.json(deudores);
  }

  async resumen(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const resumen = await this.service.obtenerResumen(req.empleado.idSuc);
    res.json(resumen);
  }

  async estadoCuenta(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const estado = await this.service.obtenerEstadoCuenta(id);
    res.json(estado);
  }

  async registrarAbono(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const resultado = await this.service.registrarAbono(req.empleado, id, req.body);
    res.status(201).json(resultado);
  }

  async registrarCargo(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const resultado = await this.service.registrarCargo(req.empleado, id, req.body);
    res.status(201).json(resultado);
  }

  async crearClienteRapido(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const cliente = await this.service.crearClienteRapido(req.body);
    res.status(201).json(cliente);
  }
}

export const fiadosController = new FiadosController();
