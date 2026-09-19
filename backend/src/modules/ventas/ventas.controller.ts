import { Request, Response } from 'express';
import { ventasService, IVentasService } from './ventas.service';
import { idValido } from '../../utils/formatters';

/**
 * VentasController: Controlador desacoplado mediante el Principio de Inversión
 * de Dependencias (DIP). Acepta IVentasService inyectado.
 */
export class VentasController {
  constructor(private service: any = ventasService) {}

  async crear(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const venta = await this.service.crearVenta(req.empleado, req.body);
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
    const resultado = await this.service.cancelarVenta(
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
    const ventas = await this.service.listarVentas({
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
    const venta = await this.service.detalleVenta(idVenta, {
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
