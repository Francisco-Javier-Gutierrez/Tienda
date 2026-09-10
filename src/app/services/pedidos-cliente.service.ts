import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ConfiguracionTransferencia,
  CrearPedidoRequest,
  PedidoCliente,
  PedidoClienteResumen,
} from '../models/pedido-cliente';

@Injectable({ providedIn: 'root' })
export class PedidosClienteService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.API_BASE_URL}/cliente`;

  crearPedido(datos: CrearPedidoRequest): Observable<PedidoCliente> {
    return this.http.post<PedidoCliente>(`${this.url}/pedidos`, datos);
  }

  listar(): Observable<PedidoClienteResumen[]> {
    return this.http.get<PedidoClienteResumen[]>(`${this.url}/pedidos`);
  }

  detalle(idPedido: string | number): Observable<PedidoCliente> {
    return this.http.get<PedidoCliente>(`${this.url}/pedidos/${idPedido}`);
  }

  cancelar(idPedido: string | number): Observable<PedidoCliente> {
    return this.http.post<PedidoCliente>(`${this.url}/pedidos/${idPedido}/cancelar`, {});
  }

  subirComprobante(idPedido: string | number, archivo: File): Observable<PedidoCliente> {
    const mimeType = archivo.type || 'application/octet-stream';
    return this.http
      .post<{ uploadUrl: string; key: string }>(`${this.url}/pedidos/${idPedido}/presign-comprobante`, {
        mimeType,
        filename: archivo.name,
      })
      .pipe(
        switchMap(({ uploadUrl, key }) =>
          this.http
            .put(uploadUrl, archivo, {
              headers: { 'Content-Type': mimeType },
            })
            .pipe(
              switchMap(() =>
                this.http.post<PedidoCliente>(`${this.url}/pedidos/${idPedido}/confirmar-comprobante`, {
                  key,
                  mimeType,
                  nombreOriginal: archivo.name,
                }),
              ),
            ),
        ),
      );
  }

  obtenerComprobante(idPedido: string | number): Observable<Blob> {
    return this.http.get(`${this.url}/pedidos/${idPedido}/comprobante`, { responseType: 'blob' });
  }

  obtenerConfiguracionTransferencia(): Observable<{ configuracion: ConfiguracionTransferencia }> {
    return this.http.get<{ configuracion: ConfiguracionTransferencia }>(`${this.url}/configuracion-transferencia`);
  }
}
