import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { CrearProductoDto, Producto, ProductoResponse } from '../models/productos';
import { environment } from '../../environments/environment';
import { ImagenesService } from './imagenes.service';

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

@Injectable({
  providedIn: 'root',
})
export class ProductosService {
  private readonly apiUrl = `${environment.API_BASE_URL}/productos`;
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
      );
  }

  resolverImagenProducto(imagenPro: string | null | undefined): string | null {
    return this.imagenes.resolver(imagenPro);
  }
}
