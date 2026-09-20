import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ClienteDeudor,
  CrearClienteRapidoDto,
  FiadoResumen,
  MovimientoCuenta,
  RegistrarAbonoDto,
  RegistrarCargoDto,
} from '../models/fiado';

@Injectable({ providedIn: 'root' })
export class FiadoService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.API_BASE_URL}/fiados`;

  listarDeudores(): Observable<ClienteDeudor[]> {
    return this.http.get<ClienteDeudor[]>(this.api);
  }

  resumen(): Observable<FiadoResumen> {
    return this.http.get<FiadoResumen>(`${this.api}/resumen`);
  }

  estadoCuenta(idCliente: string | number): Observable<{ cliente: ClienteDeudor; movimientos: MovimientoCuenta[] }> {
    return this.http.get<{ cliente: ClienteDeudor; movimientos: MovimientoCuenta[] }>(
      `${this.api}/${idCliente}/cuenta`,
    );
  }

  registrarAbono(
    idCliente: string | number,
    dto: RegistrarAbonoDto,
  ): Observable<{ abono: MovimientoCuenta; nuevoSaldo: number; mensaje: string }> {
    return this.http.post<{ abono: MovimientoCuenta; nuevoSaldo: number; mensaje: string }>(
      `${this.api}/${idCliente}/abono`,
      dto,
    );
  }

  registrarCargo(
    idCliente: string | number,
    dto: RegistrarCargoDto,
  ): Observable<{ cargo: MovimientoCuenta; nuevoSaldo: number; mensaje: string }> {
    return this.http.post<{ cargo: MovimientoCuenta; nuevoSaldo: number; mensaje: string }>(
      `${this.api}/${idCliente}/cargo`,
      dto,
    );
  }

  crearClienteRapido(dto: CrearClienteRapidoDto): Observable<ClienteDeudor> {
    return this.http.post<ClienteDeudor>(`${this.api}/clientes/rapido`, dto);
  }

  generarMensajeWhatsApp(cliente: ClienteDeudor, nombreTienda?: string): string {
    const tienda = nombreTienda || 'Tienda Doña Paty';
    const nombre = cliente.nombreCompleto || cliente.nombre || 'Estimado cliente';
    const saldoFormateado = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number(cliente.saldoDeudor || 0));

    let msg = `👋 *Hola ${nombre}, un cordial saludo.*\n\n`;
    msg += `🏪 Le escribimos de *${tienda.toUpperCase()}* para compartirle su estado de cuenta al día de hoy:\n\n`;
    msg += `💳 *Saldo pendiente:* *${saldoFormateado} MXN*\n\n`;
    msg += `Le recordamos que puede pasar a realizar su abono en la tienda en su horario habitual.\n\n`;
    msg += `¡Muchas gracias por su preferencia y que tenga un excelente día! 😊✨`;

    return msg;
  }

  enviarRecordatorioWhatsApp(cliente: ClienteDeudor, nombreTienda?: string): void {
    const texto = this.generarMensajeWhatsApp(cliente, nombreTienda);
    const telLimpio = (cliente.telefono || '').replace(/[^0-9]/g, '');

    let url = '';
    if (telLimpio.length >= 10) {
      const prefijo = telLimpio.length === 10 ? '52' : '';
      url = `https://api.whatsapp.com/send?phone=${prefijo}${telLimpio}&text=${encodeURIComponent(texto)}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    }

    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }
}
