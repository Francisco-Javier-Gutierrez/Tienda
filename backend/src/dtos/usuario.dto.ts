import { encodeId } from '../utils/formatters';

export const toEmpleadoDto = (empleado: any) => {
  if (!empleado) return null;
  const id = encodeId(empleado.idEmp);
  return {
    id,
    nombreCompleto: [empleado.nombreEmp, empleado.apellidoPatEmp, empleado.apellidoMatEmp].filter(Boolean).join(' '),
    nombre: empleado.nombreEmp,
    apellidoPat: empleado.apellidoPatEmp || null,
    apellidoMat: empleado.apellidoMatEmp || null,
    correo: empleado.correoEmp || empleado.correo,
    telefono: empleado.telefono || null,
    fechaIngreso: empleado.fechaIngreso || null,
    fotoPerfil: empleado.fotoPerfil || null,
    estado: Boolean(empleado.estadoEmp),
    cargo: empleado.cargo?.nombreCargo || empleado.cargo || null,
    sucursal: empleado.cargo?.sucursal?.nombreSuc || empleado.nombreSuc || null,
  };
};

export const toClienteDto = (cliente: any) => {
  if (!cliente) return null;
  const id = encodeId(cliente.idCliente);
  return {
    id,
    nombreCompleto: [cliente.nombreCliente, cliente.apellidoPatCliente, cliente.apellidoMatCliente].filter(Boolean).join(' '),
    nombre: cliente.nombreCliente,
    apellidoPat: cliente.apellidoPatCliente || null,
    apellidoMat: cliente.apellidoMatCliente || null,
    correo: cliente.correoCliente || cliente.correo,
    fotoPerfil: cliente.fotoPerfil || null,
    estado: Boolean(cliente.estadoCliente),
    fechaRegistro: cliente.fechaRegistro || null,
    ultimoAcceso: cliente.ultimoAcceso || null,
  };
};
