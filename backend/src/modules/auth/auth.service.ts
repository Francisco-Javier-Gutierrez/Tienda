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
import { authRepository, AuthRepository } from '../../db/repositories/auth.repository';

export class AuthService {
  constructor(private authRepo: AuthRepository = authRepository) {}

  async loginEmpleado(correoInput: string, passwordInput: string) {
    const correo = texto(correoInput).toLowerCase();
    const password = typeof passwordInput === 'string' ? passwordInput : '';

    if (!correo || !password) {
      throw errorFuncional('Correo y contraseña son obligatorios', 400);
    }

    const empleado = await this.authRepo.findEmpleadoByEmail(correo);
    if (!empleado?.contrasenaHash || !(await comparePassword(password, empleado.contrasenaHash))) {
      throw errorFuncional('Correo o contraseña incorrectos', 401);
    }
    if (!empleado.estadoEmp) {
      throw errorFuncional('Tu cuenta está desactivada', 403);
    }
    const cargoNombre = empleado.cargoNombre || empleado.cargo || 'ADMINISTRADOR';
    if (!['ADMINISTRADOR', 'CAJERO'].includes(cargoNombre)) {
      throw errorFuncional('Tu cuenta no tiene un cargo autorizado', 403);
    }
    const empSeguro = empleadoSeguro({
      ...empleado,
      cargo: cargoNombre,
      idSuc: empleado.idSuc || 1,
      nombreSuc: empleado.nombreSuc || 'Doña paty',
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

    let empleado = await this.authRepo.findEmpleadoByEmail(perfil.email.toLowerCase());

    if (!empleado) {
      throw errorFuncional('Esta cuenta no está autorizada para acceder', 403);
    }

    if (!empleado.estadoEmp) {
      throw errorFuncional('Tu cuenta está desactivada', 403);
    }

    const cargoNombre = empleado.cargoNombre || empleado.cargo || 'ADMINISTRADOR';
    if (!['ADMINISTRADOR', 'CAJERO'].includes(cargoNombre)) {
      throw errorFuncional('Tu cuenta no tiene un cargo autorizado', 403);
    }

    const empAny = empleado as any;
    if (empAny.googleSub && empAny.googleSub !== perfil.sub) {
      throw errorFuncional('Esta cuenta Google no coincide con la cuenta vinculada', 403);
    }

    if (!empAny.googleSub) {
      const actualizado = await this.authRepo.updateEmpleadoGoogleSub(empleado.idEmp, perfil.sub);
      if (actualizado) {
        empleado = actualizado;
      }
    }

    const empSeguro = empleadoSeguro({
      ...empleado,
      cargo: cargoNombre,
      idSuc: empleado.idSuc || 1,
      nombreSuc: empleado.nombreSuc || 'Doña paty',
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

    let cliente = await this.authRepo.findClienteByGoogleSub(googleSub);
    if (!cliente) {
      cliente = await this.authRepo.findClienteByEmail(correo);
      if (cliente && cliente.googleSub && cliente.googleSub !== googleSub) {
        throw errorFuncional('Esta cuenta Google no coincide con la cuenta de cliente vinculada', 403);
      }
    }
    if (cliente && !cliente.estadoCliente) {
      throw errorFuncional('Tu cuenta de cliente está desactivada', 403);
    }
    if (!cliente) {
      cliente = await this.authRepo.createCliente({
        nombreCliente: nombre,
        apellidoPatCliente: apellidoPat || undefined,
        correoCliente: correo,
        googleSub,
        fotoPerfil: fotoPerfil || undefined,
      });
    } else {
      const actualizado = await this.authRepo.updateClienteUltimoAcceso(
        cliente.idCliente,
        fotoPerfil || cliente.fotoPerfil,
      );
      if (actualizado) {
        cliente = actualizado;
      }
    }
    return cliente;
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
