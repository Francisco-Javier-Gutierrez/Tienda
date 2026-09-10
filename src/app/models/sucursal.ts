export interface Sucursal {
  id?: string;
  sucursalId?: string | number;
  idSuc?: string | number;
  nombre?: string | null;
  nombreSuc?: string | null;
  descripcion?: string | null;
  descripcionSuc?: string | null;
  telefono?: string | null;
  telefonoSuc?: string | null;
  correo?: string | null;
  correoSuc?: string | null;
  paginaWeb?: string | null;
  paginaWebSuc?: string | null;
  redSocial?: string | null;
  redSocialSuc?: string | null;
  logo?: string | null;
  logoSuc?: string | null;
  idDir?: string | number | null;
  direccion?: string | null;
}

export interface SucursalDto {
  nombreSuc?: string | null;
  descripcionSuc?: string | null;
  telefonoSuc?: string | null;
  correoSuc?: string | null;
  paginaWebSuc?: string | null;
  redSocialSuc?: string | null;
  nombre?: string | null;
  descripcion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  paginaWeb?: string | null;
  redSocial?: string | null;
}
