import { hashPassword } from '../../utils/security';
import { toEmpleadoDto } from '../../dtos/usuario.dto';
import { idValido, texto, textoNullable, errorFuncional } from '../../utils/formatters';
import { empleadoRepository } from '../../db/repositories/empleado.repository';

export class EmpleadosService {
  async listar() {
    const empleados = await empleadoRepository.listEmpleados(1);
    return empleados.map(toEmpleadoDto);
  }

  async crear(body: any) {
    const correo = texto(body.correo).toLowerCase();
    const nombre = texto(body.nombre);
    const password = typeof body.password === 'string' ? body.password : '';
    const idCargo = idValido(body.idCargo);

    if (!nombre || !correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || !idCargo) {
      throw errorFuncional('Nombre, correo y cargo válidos son obligatorios', 400);
    }
    if (password && password.length < 8) {
      throw errorFuncional('La contraseña debe tener al menos 8 caracteres', 400);
    }

    const hash = password ? await hashPassword(password) : null;
    const nombreCargo = idCargo === 1 ? 'ADMINISTRADOR' : 'CAJERO';
    const nuevo = await empleadoRepository.createEmpleado({
      idSuc: 1,
      idCargo,
      nombreEmp: nombre,
      apellidoPatEmp: textoNullable(body.apellidoPat) || '',
      apellidoMatEmp: textoNullable(body.apellidoMat) || '',
      correoEmp: correo,
      contrasenaHash: hash || '',
      estadoEmp: true,
      cargo: nombreCargo,
      cargoNombre: nombreCargo,
      nombreSuc: 'Doña paty',
      telefono: textoNullable(body.telefono) || undefined,
      fotoPerfil: textoNullable(body.fotoPerfil) || undefined,
    });
    return toEmpleadoDto(nuevo);
  }

  async actualizar(idEmp: number, body: any) {
    const correo = texto(body.correo).toLowerCase();
    const nombre = texto(body.nombre);
    const password = typeof body.password === 'string' ? body.password : '';
    const idCargo = idValido(body.idCargo);

    if (!idEmp || !nombre || !correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || !idCargo) {
      throw errorFuncional('Los datos del empleado no son válidos', 400);
    }
    if (password && password.length < 8) {
      throw errorFuncional('La contraseña debe tener al menos 8 caracteres', 400);
    }

    const nombreCargo = idCargo === 1 ? 'ADMINISTRADOR' : 'CAJERO';
    const dataUpdate: any = {
      nombreEmp: nombre,
      apellidoPatEmp: textoNullable(body.apellidoPat) || '',
      apellidoMatEmp: textoNullable(body.apellidoMat) || '',
      correoEmp: correo,
      cargo: nombreCargo,
      cargoNombre: nombreCargo,
      telefono: textoNullable(body.telefono) || undefined,
      fotoPerfil: textoNullable(body.fotoPerfil) || undefined,
    };
    if (password) {
      dataUpdate.contrasenaHash = await hashPassword(password);
    }
    const actualizado = await empleadoRepository.updateEmpleado(idEmp, dataUpdate);
    if (!actualizado) throw errorFuncional('Empleado no encontrado', 404);
    return toEmpleadoDto(actualizado);
  }

  async cambiarEstado(idEmp: number, idEmpSesion: number, estado: boolean) {
    if (idEmp === idEmpSesion && !estado) {
      throw errorFuncional('No puedes desactivar tu propia sesión', 400);
    }

    const actualizado = await empleadoRepository.updateEmpleado(idEmp, { estadoEmp: estado });
    if (!actualizado) throw errorFuncional('Empleado no encontrado', 404);
    return toEmpleadoDto(actualizado);
  }
}

export const empleadosService = new EmpleadosService();
