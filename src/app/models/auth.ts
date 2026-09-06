export type Rol = 'ADMINISTRADOR' | 'CAJERO';

export interface EmpleadoSesion {
  id: string;
  idEmp?: string | number;
  nombre: string;
  nombreEmp: string | null;
  apellidoPatEmp: string | null;
  apellidoMatEmp: string | null;
  correo: string;
  telefono: string | null;
  fechaIngreso: string | null;
  fotoPerfil: string | null;
  cargoId: string;
  idCargo?: string | number;
  cargo: Rol;
  sucursalId: string;
  idSuc?: string | number;
  nombreSuc: string | null;
  estadoEmp: boolean;
  estado?: boolean;
}

export interface AuthSession {
  token: string;
  empleado: EmpleadoSesion;
}
