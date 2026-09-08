import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { encodeId } from './formatters';
import { ClienteSesion, EmpleadoSesion, JwtPayloadCliente, JwtPayloadEmpleado } from '../types/auth.types';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function emitirSesionEmpleado(empleado: { id?: string | null; idEmp?: number }): string {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET no está configurado');
  const sub = String(empleado.id || empleado.idEmp);
  return jwt.sign({ sub, tipo: 'EMPLEADO' }, env.JWT_SECRET, {
    expiresIn: '12h',
    issuer: 'tienda-api',
  });
}

export function emitirSesionCliente(cliente: { id?: string | null; idCliente?: number }): string {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET no está configurado');
  const sub = String(cliente.id || cliente.idCliente);
  return jwt.sign({ sub, tipo: 'CLIENTE' }, env.JWT_SECRET, {
    expiresIn: '12h',
    issuer: 'tienda-api',
  });
}

export function verificarToken(token: string): JwtPayloadEmpleado | JwtPayloadCliente {
  if (!env.JWT_SECRET) throw new Error('JWT_SECRET no está configurado');
  return jwt.verify(token, env.JWT_SECRET, { issuer: 'tienda-api' }) as JwtPayloadEmpleado | JwtPayloadCliente;
}

export function empleadoSeguro(empleado: any): EmpleadoSesion {
  const idEmp = Number(empleado.idEmp);
  const idCargo = Number(empleado.idCargo);
  const idSuc = Number(empleado.cargo?.idSuc || empleado.idSuc || 1);
  return {
    id: encodeId(idEmp),
    idEmp,
    nombre: [empleado.nombreEmp, empleado.apellidoPatEmp, empleado.apellidoMatEmp].filter(Boolean).join(' '),
    nombreEmp: empleado.nombreEmp || '',
    apellidoPatEmp: empleado.apellidoPatEmp || null,
    apellidoMatEmp: empleado.apellidoMatEmp || null,
    correo: empleado.correoEmp || empleado.correo || '',
    telefono: empleado.telefono || null,
    fechaIngreso: empleado.fechaIngreso ? new Date(empleado.fechaIngreso) : null,
    fotoPerfil: empleado.fotoPerfil || null,
    idCargo,
    cargoId: encodeId(idCargo),
    cargo: empleado.cargo?.nombreCargo || empleado.cargo || null,
    idSuc,
    sucursalId: encodeId(idSuc),
    nombreSuc: empleado.cargo?.sucursal?.nombreSuc || empleado.nombreSuc || null,
    estadoEmp: Boolean(empleado.estadoEmp),
  };
}

export function clienteSeguro(cliente: any): ClienteSesion {
  if (!cliente) return null as any;
  const idCliente = Number(cliente.idCliente);
  return {
    id: encodeId(idCliente),
    idCliente,
    nombre: cliente.nombreCliente || cliente.nombre || '',
    apellidoPat: cliente.apellidoPatCliente !== undefined ? cliente.apellidoPatCliente : (cliente.apellidoPat ?? null),
    apellidoMat: cliente.apellidoMatCliente !== undefined ? cliente.apellidoMatCliente : (cliente.apellidoMat ?? null),
    correo: cliente.correoCliente || cliente.correo || '',
    fotoPerfil: cliente.fotoPerfil || null,
    estadoCliente: Boolean(cliente.estadoCliente),
    fechaRegistro: cliente.fechaRegistro ? new Date(cliente.fechaRegistro) : null,
    ultimoAcceso: cliente.ultimoAcceso ? new Date(cliente.ultimoAcceso) : null,
    rol: 'CLIENTE',
  };
}
