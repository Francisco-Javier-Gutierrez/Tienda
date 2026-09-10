import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { googleClient } from '../../config/google';
import {
  comparePassword,
  emitirSesionEmpleado,
  emitirSesionCliente,
  empleadoSeguro,
  clienteSeguro,
} from '../../utils/security';
import { texto, errorFuncional } from '../../utils/formatters';

export class AuthService {
  async loginEmpleado(correoInput: string, passwordInput: string) {
    const correo = texto(correoInput).toLowerCase();
    const password = typeof passwordInput === 'string' ? passwordInput : '';

    if (!correo || !password) {
      throw errorFuncional('Correo y contraseña son obligatorios', 400);
    }

    const empleado = await prisma.empleado.findFirst({
      where: { correoEmp: { equals: correo, mode: 'insensitive' } },
      include: {
        cargo: {
          include: { sucursal: true },
        },
      },
    });

    if (!empleado?.contrasenaHash || !(await comparePassword(password, empleado.contrasenaHash))) {
      throw errorFuncional('Correo o contraseña incorrectos', 401);
    }

    if (!empleado.estadoEmp) {
      throw errorFuncional('Tu cuenta está desactivada', 403);
    }

    if (!empleado.cargo?.nombreCargo || !['ADMINISTRADOR', 'CAJERO'].includes(empleado.cargo.nombreCargo)) {
      throw errorFuncional('Tu cuenta no tiene un cargo autorizado', 403);
    }

    const empSeguro = empleadoSeguro({
      ...empleado,
      cargo: empleado.cargo.nombreCargo,
      idSuc: empleado.cargo.idSuc,
      nombreSuc: empleado.cargo.sucursal?.nombreSuc,
    });

    return { token: emitirSesionEmpleado(empSeguro), empleado: empSeguro };
  }

  async googleAuthEmpleado(idToken: string) {
    if (!idToken) {
      throw errorFuncional('Falta la credencial de Google', 400);
    }
    if (!env.GOOGLE_CLIENT_ID) {
      throw errorFuncional('Google aún no está configurado', 503);
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const perfil = ticket.getPayload();

    if (!perfil?.sub || !perfil.email || perfil.email_verified !== true) {
      throw errorFuncional('No fue posible verificar la cuenta de Google', 401);
    }

    let empleado = await prisma.empleado.findFirst({
      where: { correoEmp: { equals: perfil.email.toLowerCase(), mode: 'insensitive' } },
      include: {
        cargo: {
          include: { sucursal: true },
        },
      },
    });

    if (!empleado) {
      throw errorFuncional('Esta cuenta no está autorizada para acceder', 403);
    }

    if (!empleado.estadoEmp) {
      throw errorFuncional('Tu cuenta está desactivada', 403);
    }

    if (!empleado.cargo?.nombreCargo || !['ADMINISTRADOR', 'CAJERO'].includes(empleado.cargo.nombreCargo)) {
      throw errorFuncional('Tu cuenta no tiene un cargo autorizado', 403);
    }

    if (empleado.googleSub && empleado.googleSub !== perfil.sub) {
      throw errorFuncional('Esta cuenta Google no coincide con la cuenta vinculada', 403);
    }

    if (!empleado.googleSub) {
      empleado = await prisma.empleado.update({
        where: { idEmp: empleado.idEmp },
        data: { googleSub: perfil.sub },
        include: {
          cargo: {
            include: { sucursal: true },
          },
        },
      });
    }

    const empSeguro = empleadoSeguro({
      ...empleado,
      cargo: empleado.cargo?.nombreCargo,
      idSuc: empleado.cargo?.idSuc,
      nombreSuc: empleado.cargo?.sucursal?.nombreSuc,
    });

    return { token: emitirSesionEmpleado(empSeguro), empleado: empSeguro };
  }

  async resolverClienteGoogle(perfil: any) {
    const correo = perfil.email.trim().toLowerCase().slice(0, 150);
    const googleSub = perfil.sub.trim().slice(0, 255);
    const nombreCompleto = texto(perfil.name);
    const nombre = (texto(perfil.given_name) || nombreCompleto || correo.split('@')[0]).slice(0, 100);
    const apellidoPat = texto(perfil.family_name).slice(0, 100) || null;
    const fotoPerfil = texto(perfil.picture) || null;

    return await prisma.$transaction(async (tx: any) => {
      let cliente = await tx.cliente.findUnique({
        where: { googleSub },
      });

      if (!cliente) {
        cliente = await tx.cliente.findFirst({
          where: { correoCliente: { equals: correo, mode: 'insensitive' } },
        });
        if (cliente && cliente.googleSub !== googleSub) {
          throw errorFuncional('Esta cuenta Google no coincide con la cuenta de cliente vinculada', 403);
        }
      }

      if (cliente && !cliente.estadoCliente) {
        throw errorFuncional('Tu cuenta de cliente está desactivada', 403);
      }

      if (!cliente) {
        cliente = await tx.cliente.create({
          data: {
            nombreCliente: nombre,
            apellidoPatCliente: apellidoPat,
            correoCliente: correo,
            googleSub,
            fotoPerfil,
            estadoCliente: true,
            ultimoAcceso: new Date(),
          },
        });
      } else {
        cliente = await tx.cliente.update({
          where: { idCliente: cliente.idCliente },
          data: {
            ultimoAcceso: new Date(),
            fotoPerfil: fotoPerfil || cliente.fotoPerfil,
          },
        });
      }

      return cliente;
    });
  }

  async googleAuthCliente(idToken: string) {
    if (!idToken) {
      throw errorFuncional('Falta la credencial de Google', 400);
    }
    if (!env.GOOGLE_CLIENT_ID) {
      throw errorFuncional('Google aún no está configurado', 503);
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const perfil = ticket.getPayload();

    if (!perfil?.sub || !perfil.email || perfil.email_verified !== true) {
      throw errorFuncional('No fue posible verificar la cuenta de Google', 401);
    }

    const cliente = await this.resolverClienteGoogle(perfil);
    return { token: emitirSesionCliente(cliente), cliente: clienteSeguro(cliente) };
  }
}

export const authService = new AuthService();

