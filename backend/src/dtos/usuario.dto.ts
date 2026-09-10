import { encodeId } from '../utils/formatters';

export const toEmpleadoDto = (empleado: any) => {
  if (!empleado) return null;
  return {
    id: encodeId(empleado.idEmp),
    nombreCompleto: [empleado.nombreEmp, empleado.apellidoPatEmp, empleado.apellidoMatEmp].filter(Boolean).join(' '),
    nombre: empleado.nombreEmp,
    apellidoPat: empleado.apellidoPatEmp,
    apellidoMat: empleado.apellidoMatEmp,
    correo: empleado.correoEmp || empleado.correo,
    telefono: empleado.telefono,
    fechaIngreso: empleado.fechaIngreso,
    fotoPerfil: empleado.fotoPerfil,
    estado: empleado.estadoEmp,
    estadoEmp: empleado.estadoEmp,
    cargo: empleado.cargo?.nombreCargo || empleado.cargo || null,
    sucursal: empleado.cargo?.sucursal?.nombreSuc || empleado.nombreSuc || null,
  };
};

export const toClienteDto = (cliente: any) => {
  if (!cliente) return null;
  return {
    id: encodeId(cliente.idCliente),
    nombreCompleto: [cliente.nombreCliente, cliente.apellidoPatCliente, cliente.apellidoMatCliente].filter(Boolean).join(' '),
    nombre: cliente.nombreCliente,
    apellidoPat: cliente.apellidoPatCliente,
    apellidoMat: cliente.apellidoMatCliente,
    correo: cliente.correoCliente,
    fotoPerfil: cliente.fotoPerfil,
    estado: cliente.estadoCliente,
    fechaRegistro: cliente.fechaRegistro,
    ultimoAcceso: cliente.ultimoAcceso,
  };
};
