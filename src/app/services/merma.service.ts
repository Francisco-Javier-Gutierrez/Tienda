import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Merma, MermaResumen, RegistrarMermaDto, EstadoMerma } from '../models/merma';

@Injectable({ providedIn: 'root' })
export class MermaService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.API_BASE_URL}/mermas`;

  registrar(dto: RegistrarMermaDto): Observable<Merma> {
    return this.http.post<Merma>(this.api, dto);
  }

  listar(filtros?: {
    tipo?: string;
    estado?: string;
    idProv?: string | number;
    fechaDesde?: string;
    fechaHasta?: string;
  }): Observable<Merma[]> {
    let params = new HttpParams();
    if (filtros) {
      if (filtros.tipo) params = params.set('tipo', filtros.tipo);
      if (filtros.estado) params = params.set('estado', filtros.estado);
      if (filtros.idProv) params = params.set('idProv', String(filtros.idProv));
      if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    }
    return this.http.get<Merma[]>(this.api, { params });
  }

  resumen(filtros?: { fechaDesde?: string; fechaHasta?: string }): Observable<MermaResumen> {
    let params = new HttpParams();
    if (filtros) {
      if (filtros.fechaDesde) params = params.set('fechaDesde', filtros.fechaDesde);
      if (filtros.fechaHasta) params = params.set('fechaHasta', filtros.fechaHasta);
    }
    return this.http.get<MermaResumen>(`${this.api}/resumen`, { params });
  }

  detalle(id: string | number): Observable<Merma> {
    return this.http.get<Merma>(`${this.api}/${id}`);
  }

  actualizarEstado(id: string | number, estado: EstadoMerma, notas?: string): Observable<Merma> {
    return this.http.patch<Merma>(`${this.api}/${id}/estado`, { estado, notas });
  }
}
