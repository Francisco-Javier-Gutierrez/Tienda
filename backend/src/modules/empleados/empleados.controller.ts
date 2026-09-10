import { Request, Response } from 'express';
import { empleadosService } from './empleados.service';
import { idValido } from '../../utils/formatters';

export class EmpleadosController {
  async listar(req: Request, res: Response): Promise<void> {
    const empleados = await empleadosService.listar();
      res.json(empleados);
  }

  async crear(req: Request, res: Response): Promise<void> {
    const empleado = await empleadosService.crear(req.body);
      res.status(201).json(empleado);
  }

  async actualizar(req: Request, res: Response): Promise<void> {
    const idEmp = idValido(req.params.id);
    if (!idEmp) {
      res.status(400).json({ message: 'El ID del empleado no es válido' });
      return;
    }
    const empleado = await empleadosService.actualizar(idEmp, req.body);
      res.json(empleado);
  }

  async cambiarEstado(req: Request, res: Response): Promise<void> {
    const idEmp = idValido(req.params.id);
    if (!idEmp) {
      res.status(400).json({ message: 'El ID del empleado no es válido' });
      return;
    }
    const estado = req.body?.estado === true || req.body?.estado === 1;
    const idEmpSesion = req.empleado?.idEmp || 0;

    const empleado = await empleadosService.cambiarEstado(idEmp, idEmpSesion, estado);
      res.json(empleado);
  }
}

export const empleadosController = new EmpleadosController();
