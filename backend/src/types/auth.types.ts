export interface EmpleadoSesion {
  id?: string | null;
  idEmp: number;
  nombre: string;
  nombreEmp: string;
  apellidoPatEmp: string | null;
  apellidoMatEmp: string | null;
  correo: string;
  telefono: string | null;
  fechaIngreso: Date | null;
  fotoPerfil: string | null;
  idCargo: number;
  cargoId?: string | null;
  cargo: string | null;
  idSuc: number;
  sucursalId?: string | null;
  nombreSuc: string | null;
  estadoEmp: boolean;
}

export interface ClienteSesion {
  id?: string | null;
  idCliente: number;
  nombre: string;
  nombreCliente?: string;
  apellidoPat: string | null;
  apellidoPatCliente?: string | null;
  apellidoMat: string | null;
  apellidoMatCliente?: string | null;
  correo: string;
  correoCliente?: string;
  fotoPerfil: string | null;
  estadoCliente: boolean;
  fechaRegistro: Date | null;
  ultimoAcceso: Date | null;
  rol: 'CLIENTE';
}

export interface JwtPayloadEmpleado {
  sub: string;
  tipo: 'EMPLEADO';
  iat?: number;
  exp?: number;
  iss?: string;
}

export interface JwtPayloadCliente {
  sub: string;
  tipo: 'CLIENTE';
  iat?: number;
  exp?: number;
  iss?: string;
}

export type AnyJwtPayload = JwtPayloadEmpleado | JwtPayloadCliente;
