export interface Producto {
  id: string;
  nombre: string;
  precioVenta: number;
  costo: number | null;
  existencia: number;
  stockMinimo: number | null;
  tamano: string | null;
  presentacion: string | null;
  tipo: string | null;
  codigoQR: string | null;
  sku: string | null;
  imagen: string | null;
  activo: boolean;
  marca: { id: string | null; nombre: string | null } | null;
  categoria: { id: string | null; nombre: string | null } | null;
  pendienteSync?: number;
}

export interface CrearProductoDto {
  nombre: string;
  precio: number;
  costo: number | null;
  existencia: number;
  stockMinimo: number | null;
  tamano: string;
  presentacion: string;
  tipo: string;
  codigoQR: string | null;
  sku: string | null;
  imagen: string | null;
  idMarca: string | null;
  idCat: string | null;
}

export type ProductoResponse = Producto;
export type Productos = Producto;
