import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Categoria } from '../models/categoria';
import { Marca } from '../models/marca';

export interface CatalogoDto {
  nombre: string;
  descripcion: string;
}

@Injectable({
  providedIn: 'root',
})
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.API_BASE_URL;

  getMarcas(): Observable<Marca[]> {
    return this.http.get<Marca[]>(`${this.apiBaseUrl}/marca`);
  }

  crearMarca(dto: CatalogoDto): Observable<Marca> {
    return this.http.post<Marca>(`${this.apiBaseUrl}/marca`, dto);
  }

  actualizarMarca(id: string | number, dto: CatalogoDto): Observable<Marca> {
    return this.http.put<Marca>(`${this.apiBaseUrl}/marca/${id}`, dto);
  }

  eliminarMarca(id: string | number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBaseUrl}/marca/${id}`);
  }

  getCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.apiBaseUrl}/categoria`);
  }

  crearCategoria(dto: CatalogoDto): Observable<Categoria> {
    return this.http.post<Categoria>(`${this.apiBaseUrl}/categoria`, dto);
  }

  actualizarCategoria(id: string | number, dto: CatalogoDto): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.apiBaseUrl}/categoria/${id}`, dto);
  }

  eliminarCategoria(id: string | number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBaseUrl}/categoria/${id}`);
  }
}
