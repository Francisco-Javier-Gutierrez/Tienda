import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Sucursal, SucursalDto } from '../models/sucursal';
import { ImagenesService } from './imagenes.service';

@Injectable({ providedIn: 'root' })
export class SucursalService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.API_BASE_URL}/sucursal`;
  private readonly imagenes = inject(ImagenesService);

  obtenerSucursales(): Observable<Sucursal[]> {
    return this.http.get<Sucursal[]>(this.apiUrl);
  }

  crearSucursal(datos: SucursalDto): Observable<Sucursal> {
    return this.http.post<Sucursal>(this.apiUrl, datos);
  }

  actualizarSucursal(idSuc: string | number, datos: SucursalDto): Observable<Sucursal> {
    return this.http.put<Sucursal>(`${this.apiUrl}/${idSuc}`, datos);
  }

  subirLogo(idSuc: string | number, imagen: Blob, nombre: string): Observable<Sucursal> {
    const mimeType = imagen.type || 'image/jpeg';
    return this.http
      .post<{ uploadUrl: string; key: string; publicUrl: string }>(`${this.apiUrl}/${idSuc}/presign-logo`, {
        mimeType,
        filename: nombre,
      })
      .pipe(
        switchMap(({ uploadUrl, publicUrl, key }) =>
          this.http
            .put(uploadUrl, imagen, {
              headers: { 'Content-Type': mimeType },
            })
            .pipe(
              switchMap(() =>
                this.http.post<Sucursal>(`${this.apiUrl}/${idSuc}/confirmar-logo`, {
                  logoUrl: publicUrl,
                  key,
                }),
              ),
            ),
        ),
      );
  }

  quitarLogo(idSuc: string | number): Observable<Sucursal> {
    return this.http.delete<Sucursal>(`${this.apiUrl}/${idSuc}/logo`);
  }

  resolverImagen(ruta: string | null | undefined): string | null {
    return this.imagenes.resolver(ruta);
  }
}
