import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CrearVentaDto,
  ProductoPos,
  VentaCancelada,
  VentaDetalle,
  VentaRegistrada,
  VentaResumen,
} from '../models/venta';

@Injectable({ providedIn: 'root' })
export class VentaService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.API_BASE_URL;
  productos(): Observable<ProductoPos[]> {
    return this.http.get<ProductoPos[]>(`${this.api}/pos/productos`);
  }
  cobrar(venta: CrearVentaDto): Observable<VentaRegistrada> {
    return this.http.post<VentaRegistrada>(`${this.api}/ventas`, venta);
  }
  historial(): Observable<VentaResumen[]> {
    return this.http.get<VentaResumen[]>(`${this.api}/ventas`);
  }
  detalle(idVenta: string | number): Observable<VentaDetalle> {
    return this.http.get<VentaDetalle>(`${this.api}/ventas/${idVenta}`);
  }
  cancelarVenta(idVenta: string, motivo: string): Observable<{ message: string; venta: VentaCancelada }> {
    return this.http.post<{ message: string; venta: VentaCancelada }>(`${this.api}/ventas/${idVenta}/cancelar`, {
      motivo,
    });
  }
}

