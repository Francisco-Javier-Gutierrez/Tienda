import { Request, Response, NextFunction } from 'express';
import { clienteSeguro, verificarToken } from '../utils/security';
import { idValido } from '../utils/formatters';
import { authRepository } from '../db/repositories/auth.repository';

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

    const empleado = await authRepository.findEmpleadoById(idEmp);
    if (!empleado || !empleado.estadoEmp) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    req.empleado = {
      idEmp: empleado.idEmp,
      nombre: [empleado.nombreEmp, empleado.apellidoPatEmp, empleado.apellidoMatEmp].filter(Boolean).join(' '),
      nombreEmp: empleado.nombreEmp,
      apellidoPatEmp: empleado.apellidoPatEmp,
      apellidoMatEmp: empleado.apellidoMatEmp || null,
      correo: empleado.correoEmp,
      telefono: empleado.telefono || null,
      fechaIngreso: null,
      fotoPerfil: empleado.fotoPerfil || null,
      idCargo: empleado.idCargo || 1,
      cargo: empleado.cargoNombre || empleado.cargo || 'ADMINISTRADOR',
      idSuc: empleado.idSuc || 1,
      nombreSuc: empleado.nombreSuc || 'Doña paty',
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

    const cliente = await authRepository.findClienteById(idCliente);
    if (!cliente || !cliente.estadoCliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    req.cliente = {
      ...clienteSeguro(cliente),
      nombreCliente: cliente.nombreCliente,
      apellidoPatCliente: cliente.apellidoPatCliente || null,
      apellidoMatCliente: cliente.apellidoMatCliente || null,
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

export async function autenticarCualquiera(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization || '';
  const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];

  if (!token) {
    res.status(401).json({ message: 'Sesión no válida' });
    return;
  }

  try {
    const payload = verificarToken(token);

    if (payload.tipo === 'CLIENTE') {
      const idCliente = idValido(payload.sub);
      if (!idCliente) {
        res.status(401).json({ message: 'Sesión no válida' });
        return;
      }

      const cliente = await authRepository.findClienteById(idCliente);
      if (!cliente || !cliente.estadoCliente) {
        res.status(401).json({ message: 'Sesión no válida' });
        return;
      }

      req.cliente = {
        ...clienteSeguro(cliente),
        nombreCliente: cliente.nombreCliente,
        apellidoPatCliente: cliente.apellidoPatCliente || null,
        apellidoMatCliente: cliente.apellidoMatCliente || null,
        correoCliente: cliente.correoCliente,
      };
      next();
      return;
    }

    const idEmp = idValido(payload.sub);
    if (!idEmp) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    const empleado = await authRepository.findEmpleadoById(idEmp);
    if (!empleado || !empleado.estadoEmp) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }

    req.empleado = {
      idEmp: empleado.idEmp,
      nombre: [empleado.nombreEmp, empleado.apellidoPatEmp, empleado.apellidoMatEmp].filter(Boolean).join(' '),
      nombreEmp: empleado.nombreEmp,
      apellidoPatEmp: empleado.apellidoPatEmp,
      apellidoMatEmp: empleado.apellidoMatEmp || null,
      correo: empleado.correoEmp,
      telefono: empleado.telefono || null,
      fechaIngreso: null,
      fotoPerfil: empleado.fotoPerfil || null,
      idCargo: empleado.idCargo || 1,
      cargo: empleado.cargoNombre || empleado.cargo || 'ADMINISTRADOR',
      idSuc: empleado.idSuc || 1,
      nombreSuc: empleado.nombreSuc || 'Doña paty',
      estadoEmp: Boolean(empleado.estadoEmp),
    };
    next();
  } catch {
    res.status(401).json({ message: 'Sesión no válida' });
  }
}
