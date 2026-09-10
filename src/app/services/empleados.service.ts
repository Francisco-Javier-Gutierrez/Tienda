import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EmpleadoSesion } from '../models/auth';
import { Cargo } from '../models/cargo';

export interface EmpleadoDto {
  nombre: string;
  apellidoPat: string;
  apellidoMat: string;
  correo: string;
  telefono: string;
  fechaIngreso: string;
  fotoPerfil: string;
  idCargo: string | number | null;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class EmpleadosService {
  private http = inject(HttpClient);
  private url = `${environment.API_BASE_URL}/empleados`;

  listar(): Observable<EmpleadoSesion[]> {
    return this.http.get<EmpleadoSesion[]>(this.url);
  }
  cargos(): Observable<Cargo[]> {
    return this.http.get<Cargo[]>(`${environment.API_BASE_URL}/cargos`);
  }
  crear(d: EmpleadoDto) {
    return this.http.post<EmpleadoSesion>(this.url, d);
  }
  editar(id: string | number, d: EmpleadoDto) {
    return this.http.put<EmpleadoSesion>(`${this.url}/${id}`, d);
  }
  estado(id: string | number, estado: boolean) {
    return this.http.patch<EmpleadoSesion>(`${this.url}/${id}/estado`, { estado });
  }
}
