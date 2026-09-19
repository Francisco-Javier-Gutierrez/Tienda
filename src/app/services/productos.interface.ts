import { Observable } from 'rxjs';
import { CrearProductoDto, Producto, ProductoResponse } from '../models/productos';

export interface ProductoPublico {
  id: string;
  nombre: string;
  precioVenta: number;
  existencia: number;
  codigoQR: string | null;
  sku: string | null;
  imagen: string | null;
  tamano: string | null;
  presentacion: string | null;
  marca: string | null;
  categoria: string | null;
  encontrado?: boolean;
  fuente?: string;
  imagenUrl?: string;
}

/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - Product Interfaces
 * =========================================================================
 * Interfaces segregadas para operaciones sobre productos:
 * - ProductoReader: Lectura y búsqueda por código QR
 * - ProductoWriter: Alta, modificación y eliminación
 * - ProductoMediaHandler: Presigned URLs y carga de imágenes a AWS S3
 * - ProductoExternalLookup: Búsqueda en APIs externas
 */

export interface ProductoReader {
  getProductos(): Observable<Producto[]>;
  getByQR(codigoQR: string): Observable<Producto | null>;
}

export interface ProductoWriter {
  addProducto(producto: CrearProductoDto): Observable<ProductoResponse>;
  updateProducto(id: string | number, producto: CrearProductoDto): Observable<ProductoResponse>;
  deleteProducto(id: string | number): Observable<{ message: string }>;
}

export interface ProductoMediaHandler {
  subirImagen(idPro: string | number, imagen: Blob, nombreArchivo: string): Observable<ProductoResponse>;
  resolverImagenProducto(imagenPro: string | null | undefined): string | null;
}

export interface ProductoExternalLookup {
  buscarInformacionPublica(codigoQR: string): Observable<ProductoPublico>;
}

export interface ProductosOperations
  extends ProductoReader,
    ProductoWriter,
    ProductoMediaHandler,
    ProductoExternalLookup {}
