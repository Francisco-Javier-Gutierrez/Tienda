import { Request, Response } from 'express';
import { authService } from './auth.service';
import { empleadoSeguro, clienteSeguro } from '../../utils/security';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.loginEmpleado(req.body?.correo, req.body?.password);
      res.json(result);
  }

  async googleEmpleado(req: Request, res: Response): Promise<void> {
    const result = await authService.googleAuthEmpleado(req.body?.idToken);
      res.json(result);
  }

  async googleCliente(req: Request, res: Response): Promise<void> {
    const result = await authService.googleAuthCliente(req.body?.idToken);
      res.json(result);
  }

  meEmpleado(req: Request, res: Response): void {
    if (!req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    res.json({ empleado: empleadoSeguro(req.empleado) });
  }

  meCliente(req: Request, res: Response): void {
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    res.json({ cliente: clienteSeguro(req.cliente) });
  }
}

export const authController = new AuthController();
