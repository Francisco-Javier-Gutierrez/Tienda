import { Request, Response } from 'express';
import { ventasService } from './ventas.service';
import { idValido } from '../../utils/formatters';

export class VentasController {
  async crear(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const venta = await ventasService.crearVenta(req.empleado, req.body);
      res.status(201).json(venta);
  }

  async cancelar(req: Request, res: Response): Promise<void> {
    const idVenta = idValido(req.params.id);
    if (!idVenta) {
      res.status(400).json({ message: 'El folio de venta no es válido' });
      return;
    }
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const resultado = await ventasService.cancelarVenta(
              idVenta,
              req.empleado.idEmp,
              req.empleado.idSuc,
              req.body?.motivo,
            );
      res.json({ message: 'Venta cancelada correctamente.', venta: resultado });
  }

  async listar(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const ventas = await ventasService.listarVentas({
              idEmp: req.empleado.idEmp,
              idSuc: req.empleado.idSuc,
              cargo: req.empleado.cargo || 'CAJERO',
            });
      res.json(ventas);
  }

  async detalle(req: Request, res: Response): Promise<void> {
    const idVenta = idValido(req.params.id);
    if (!idVenta) {
      res.status(400).json({ message: 'El folio de venta no es válido' });
      return;
    }
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const venta = await ventasService.detalleVenta(idVenta, {
              idEmp: req.empleado.idEmp,
              idSuc: req.empleado.idSuc,
              cargo: req.empleado.cargo || 'CAJERO',
            });
      if (!venta) {
              res.status(404).json({ message: 'Venta no encontrada' });
              return;
            }
      res.json(venta);
  }
}

export const ventasController = new VentasController();
