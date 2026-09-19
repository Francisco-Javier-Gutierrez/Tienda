import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, switchMap } from 'rxjs';
import { CrearProductoDto, Producto, ProductoResponse } from '../models/productos';
import { environment } from '../../environments/environment';
import { ImagenesService } from './imagenes.service';

import {
  ProductoPublico,
  ProductosOperations,
} from './productos.interface';
export { ProductoPublico };

/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - Productos Service
 * =========================================================================
 * Implementa la interfaz compuesta ProductosOperations que agrupa contratos
 * segregados (ProductoReader, ProductoWriter, ProductoMediaHandler, ProductoExternalLookup).
 */
import { API_BASE_URL } from './tokens';

@Injectable({
  providedIn: 'root',
})
export class ProductosService implements ProductosOperations {
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly apiUrl = `${this.apiBaseUrl}/productos`;
  private readonly http = inject(HttpClient);
  private readonly imagenes = inject(ImagenesService);

  getProductos(): Observable<Producto[]> {
    return this.http.get<Producto[]>(this.apiUrl);
  }

  addProducto(producto: CrearProductoDto): Observable<ProductoResponse> {
    return this.http.post<ProductoResponse>(this.apiUrl, producto);
  }

  updateProducto(id: string | number, producto: CrearProductoDto): Observable<ProductoResponse> {
    return this.http.put<ProductoResponse>(`${this.apiUrl}/${id}`, producto);
  }

  deleteProducto(id: string | number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  getByQR(codigoQR: string): Observable<Producto | null> {
    return this.http.get<Producto | null>(`${this.apiUrl}/qr/${encodeURIComponent(codigoQR)}`);
  }

  buscarInformacionPublica(codigoQR: string): Observable<ProductoPublico> {
    return this.http.get<ProductoPublico>(`${this.apiUrl}/externo/${encodeURIComponent(codigoQR)}`);
  }

  subirImagen(idPro: string | number, imagen: Blob, nombreArchivo: string): Observable<ProductoResponse> {
    const mimeType = imagen.type || 'image/jpeg';
    return this.http
      .post<{ uploadUrl: string; key: string; publicUrl: string }>(`${this.apiUrl}/${idPro}/presign-imagen`, {
        mimeType,
        filename: nombreArchivo,
      })
      .pipe(
        switchMap(({ uploadUrl, publicUrl, key }) =>
          this.http
            .put(uploadUrl, imagen, {
              headers: { 'Content-Type': mimeType },
            })
            .pipe(
              switchMap(() =>
                this.http.post<ProductoResponse>(`${this.apiUrl}/${idPro}/confirmar-imagen`, {
                  imagenUrl: publicUrl,
                  key,
                }),
              ),
            ),
        ),
        catchError(() => {
          const formData = new FormData();
          formData.append('imagen', imagen, nombreArchivo || 'producto.jpg');
          return this.http.post<ProductoResponse>(`${this.apiUrl}/${idPro}/imagen`, formData);
        }),
      );
  }

  resolverImagenProducto(imagenPro: string | null | undefined): string | null {
    return this.imagenes.resolver(imagenPro);
  }
}
