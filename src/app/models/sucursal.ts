export interface Sucursal {
  id: string;
  nombre: string;
  descripcion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  paginaWeb?: string | null;
  redSocial?: string | null;
  logo?: string | null;
  direccion?: string | null;
  // Campos retrocompatibles opcionales para evitar roturas
  nombreSuc?: string | null;
  logoSuc?: string | null;
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
