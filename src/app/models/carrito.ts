export interface ProductoParaCarrito {
  id: string;
  nombre: string;
  precioVenta: number;
  existencia: number | null;
  imagen: string | null;
  tamano: string | null;
  presentacion: string | null;
}

export interface ItemCarrito {
  id: string;
  nombre: string;
  precioMostrado: number;
  cantidad: number;
  imagen: string | null;
  stockConocido: number;
  presentacion: string | null;
}
