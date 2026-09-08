import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Caja, MovimientoCaja, TipoMovimiento } from '../models/caja';
@Injectable({ providedIn: 'root' })
export class CajaService {
  private http = inject(HttpClient);
  private api = environment.API_BASE_URL;
  actual(): Observable<{ caja: Caja | null }> {
    return this.http.get<{ caja: Caja | null }>(`${this.api}/caja/actual`);
  }
  abrir(uuidSesionCaja: string, fondoInicial: number): Observable<Caja> {
    return this.http.post<Caja>(`${this.api}/caja/abrir`, { uuidSesionCaja, fondoInicial });
  }
  resumen(): Observable<Caja> {
    return this.http.get<Caja>(`${this.api}/caja/actual/resumen`);
  }
  movimientos(): Observable<MovimientoCaja[]> {
    return this.http.get<MovimientoCaja[]>(`${this.api}/caja/movimientos`);
  }
  registrarMovimiento(
    uuidMovimientoCaja: string,
    tipoMovimiento: TipoMovimiento,
    monto: number,
    concepto: string,
  ): Observable<MovimientoCaja> {
    return this.http.post<MovimientoCaja>(`${this.api}/caja/movimientos`, {
      uuidMovimientoCaja,
      tipoMovimiento,
      monto,
      concepto,
    });
  }
  cerrar(efectivoContado: number, observaciones: string): Observable<Caja> {
    return this.http.post<Caja>(`${this.api}/caja/cerrar`, { efectivoContado, observaciones });
  }
  historial(filtros: { fecha?: string; idEmp?: number; estado?: string } = {}): Observable<Caja[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filtros)) if (v !== undefined && v !== '') params = params.set(k, String(v));
    return this.http.get<Caja[]>(`${this.api}/caja/historial`, { params });
  }
  detalle(id: string | number): Observable<Caja> {
    return this.http.get<Caja>(`${this.api}/caja/${id}`);
  }
}
