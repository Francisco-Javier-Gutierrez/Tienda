import { Request, Response } from 'express';
import { cajaService } from './caja.service';
import { idValido } from '../../utils/formatters';

export class CajaController {
  async abrir(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const caja = await cajaService.abrirCaja(
              req.empleado.idEmp,
              req.empleado.idSuc,
              req.body?.uuidSesionCaja,
              req.body?.fondoInicial,
            );
      res.status(201).json(caja);
  }

  async actual(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const caja = await cajaService.obtenerCajaActual(req.empleado.idEmp);
      res.json({ caja });
  }

  async actualResumen(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const caja = await cajaService.obtenerCajaActual(req.empleado.idEmp);
      if (!caja) {
              res.status(404).json({ message: 'No tienes una caja abierta.' });
              return;
            }
      const resumen = await cajaService.calcularResumenCaja(caja);
      res.json(resumen);
  }

  async registrarMovimiento(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const mov = await cajaService.registrarMovimiento(
              req.empleado.idEmp,
              req.body?.uuidMovimientoCaja,
              req.body?.tipoMovimiento,
              req.body?.concepto,
              req.body?.monto,
            );
      res.status(201).json(mov);
  }

  async listarMovimientos(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const movimientos = await cajaService.listarMovimientos(req.empleado.idEmp);
      res.json(movimientos);
  }

  async cerrar(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const cerrada = await cajaService.cerrarCaja(
              req.empleado.idEmp,
              req.body?.efectivoContado,
              req.body?.observaciones,
            );
      res.json(cerrada);
  }

  async historial(req: Request, res: Response): Promise<void> {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const items = await cajaService.historial(
              {
                idEmp: req.empleado.idEmp,
                idSuc: req.empleado.idSuc,
                cargo: req.empleado.cargo || 'CAJERO',
              },
              req.query,
            );
      res.json(items);
  }

  async detalle(req: Request, res: Response): Promise<void> {
    const id = idValido(req.params.id);
    if (!id) {
      res.status(400).json({ message: 'El folio de caja no es válido' });
      return;
    }
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const caja = await cajaService.detalle(id, {
              idEmp: req.empleado.idEmp,
              idSuc: req.empleado.idSuc,
              cargo: req.empleado.cargo || 'CAJERO',
            });
      if (!caja) {
              res.status(404).json({ message: 'Caja no encontrada' });
              return;
            }
      res.json(caja);
  }
}

export const cajaController = new CajaController();
