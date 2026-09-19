/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - Producto Domain Models
 * =========================================================================
 * Interfaces segregadas para diferentes aspectos del ciclo de vida del producto.
 */
export interface ProductoIdentidad {
  id: string;
  nombre: string;
}

export interface ProductoPrecios {
  precioVenta: number;
  precio?: number;
  costo: number | null;
}

export interface ProductoStock {
  existencia: number;
  stockMinimo: number | null;
}

export interface ProductoCodigos {
  codigoQR: string | null;
  sku: string | null;
}

export interface ProductoPresentacion {
  tamano: string | null;
  presentacion: string | null;
  tipo: string | null;
  imagen: string | null;
  activo: boolean;
}

export interface ProductoClasificacion {
  marca: { id: string | null; nombre: string | null } | null;
  categoria: { id: string | null; nombre: string | null } | null;
}

export interface ProductoSincronizable {
  pendienteSync?: number;
}

export interface Producto
  extends ProductoIdentidad,
    ProductoPrecios,
    ProductoStock,
    ProductoCodigos,
    ProductoPresentacion,
    ProductoClasificacion,
    ProductoSincronizable {
  idMarca?: string | null;
  idCat?: string | null;
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
