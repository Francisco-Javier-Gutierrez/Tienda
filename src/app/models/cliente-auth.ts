export interface ClienteSesion {
  id: string;
  nombre: string;
  apellidoPat: string | null;
  apellidoMat: string | null;
  correo: string;
  fotoPerfil: string | null;
  estadoCliente: boolean;
  fechaRegistro: string;
  ultimoAcceso: string | null;
  rol: 'CLIENTE';
}

export interface ClienteAuthSession {
  token: string;
  cliente: ClienteSesion;
}
