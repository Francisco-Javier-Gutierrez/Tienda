import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { clienteSeguro, verificarToken } from '../utils/security';
import { idValido } from '../utils/formatters';

export async function autenticar(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization || '';
  const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];

  if (!token) {
    res.status(401).json({ message: 'Sesión no válida' });
    return;
  }

  try {
    const payload = verificarToken(token);

    if (payload.tipo && payload.tipo !== 'EMPLEADO') {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const idEmp = idValido(payload.sub);
    if (!idEmp) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const empleado = await prisma.empleado.findUnique({
      where: { idEmp },
      include: {
        cargo: {
          include: { sucursal: true },
        },
      },
    });

    if (!empleado || !empleado.estadoEmp || !empleado.cargo) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    req.empleado = {
      idEmp: empleado.idEmp,
      nombre: [empleado.nombreEmp, empleado.apellidoPatEmp, empleado.apellidoMatEmp].filter(Boolean).join(' '),
      nombreEmp: empleado.nombreEmp,
      apellidoPatEmp: empleado.apellidoPatEmp,
      apellidoMatEmp: empleado.apellidoMatEmp,
      correo: empleado.correoEmp,
      telefono: empleado.telefono,
      fechaIngreso: empleado.fechaIngreso,
      fotoPerfil: empleado.fotoPerfil,
      idCargo: empleado.idCargo || 0,
      cargo: empleado.cargo.nombreCargo,
      idSuc: empleado.cargo.idSuc || 1,
      nombreSuc: empleado.cargo.sucursal?.nombreSuc || null,
      estadoEmp: Boolean(empleado.estadoEmp),
    };

    next();
  } catch {
    res.status(401).json({ message: 'Sesión no válida' });
  }
}

export async function autenticarCliente(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization || '';
  const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];

  if (!token) {
    res.status(401).json({ message: 'Sesión no válida' });
    return;
  }

  try {
    const payload = verificarToken(token);

    if (payload.tipo !== 'CLIENTE') {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const idCliente = idValido(payload.sub);
    if (!idCliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const cliente = await prisma.cliente.findUnique({
      where: { idCliente },
    });

    if (!cliente || !cliente.estadoCliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    req.cliente = {
      ...clienteSeguro(cliente),
      nombreCliente: cliente.nombreCliente,
      apellidoPatCliente: cliente.apellidoPatCliente,
      apellidoMatCliente: cliente.apellidoMatCliente,
      correoCliente: cliente.correoCliente,
    };

    next();
  } catch {
    res.status(401).json({ message: 'Sesión no válida' });
  }
}

export function autorizarRoles(...roles: Array<string | null | undefined>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.empleado?.cargo && roles.includes(req.empleado.cargo)) {
      next();
      return;
    }
    res.status(403).json({ message: 'No tienes permisos para realizar esta acción' });
  };
}

export const soloAdministrador = autorizarRoles('ADMINISTRADOR');
export const rolesPos = autorizarRoles('ADMINISTRADOR', 'CAJERO');
