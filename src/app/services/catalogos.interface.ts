import { Observable } from 'rxjs';
import { Categoria } from '../models/categoria';
import { Marca } from '../models/marca';

export interface CatalogoDto {
  nombre: string;
  descripcion: string;
}

/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - Catalog Interfaces
 * =========================================================================
 * Interfaces segregadas para operaciones de lectura y escritura de catálogos
 * (Marcas y Categorías). Los consumidores solo dependen de los métodos que necesitan.
 */

export interface MarcaCatalogReader {
  getMarcas(): Observable<Marca[]>;
}

export interface MarcaCatalogWriter {
  crearMarca(dto: CatalogoDto): Observable<Marca>;
  actualizarMarca(id: string | number, dto: CatalogoDto): Observable<Marca>;
  eliminarMarca(id: string | number): Observable<{ message: string }>;
}

export interface MarcaCatalogService extends MarcaCatalogReader, MarcaCatalogWriter {}

export interface CategoriaCatalogReader {
  getCategorias(): Observable<Categoria[]>;
}

export interface CategoriaCatalogWriter {
  crearCategoria(dto: CatalogoDto): Observable<Categoria>;
  actualizarCategoria(id: string | number, dto: CatalogoDto): Observable<Categoria>;
  eliminarCategoria(id: string | number): Observable<{ message: string }>;
}

export interface CategoriaCatalogService extends CategoriaCatalogReader, CategoriaCatalogWriter {}
