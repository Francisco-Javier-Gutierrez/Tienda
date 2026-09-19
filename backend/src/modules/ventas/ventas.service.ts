import {
  dineroCentavos,
  errorFuncional,
  idValido,
  texto,
  uuidValido,
} from '../../utils/formatters';
import { toVentaRegistradaDto, toVentaListDto, toVentaDetalleDto } from '../../dtos/venta.dto';
import { cajaRepository } from '../../db/repositories/caja.repository';
import { productoRepository } from '../../db/repositories/producto.repository';
import { ventaRepository } from '../../db/repositories/venta.repository';
import { PaymentStrategyRegistry, defaultPaymentRegistry } from './payment.strategy';

export interface IVentasService {
  obtenerVentaRegistrada(idVenta: number, empleado: any): Promise<any>;
  crearVenta(empleado: any, body: any): Promise<any>;
  cancelarVenta(idVenta: number, idEmp: number, idSuc: number, motivo?: string): Promise<any>;
  listarVentas(empleado: any): Promise<any>;
  detalleVenta(idVenta: number, empleado: any): Promise<any>;
}

export class VentasService implements IVentasService {
  constructor(
    private paymentRegistry: PaymentStrategyRegistry = defaultPaymentRegistry,
    private cajaRepo: any = cajaRepository,
    private prodRepo: any = productoRepository,
    private ventaRepo: any = ventaRepository,
  ) {}

  async obtenerVentaRegistrada(idVenta: number, empleado: any) {
    const v = await this.ventaRepo.getVentaById(idVenta, empleado?.idSuc || 1);
    if (!v) return null;
    return toVentaRegistradaDto(v, empleado);
  }

  async crearVenta(empleado: any, body: any) {
    const uuidVenta = uuidValido(body.uuidVenta);
    if (!uuidVenta) throw errorFuncional('uuidVenta no es válido', 400);

    // Idempotencia rápida: Si la venta ya fue registrada previamente, retornarla sin duplicar
    if (this.ventaRepo.getVentaByUuid) {
      const existente = await this.ventaRepo.getVentaByUuid(uuidVenta, empleado?.idSuc || 1);
      if (existente) {
        return toVentaRegistradaDto(existente, empleado);
      }
    }

    const metodoPago = texto(body.metodoPago).toUpperCase();
    const strategy = this.paymentRegistry.get(metodoPago);

    const montoNota = Number(body.montoNota || 0);
    const hasItems = Array.isArray(body.items) && body.items.length > 0;

    if (!hasItems && montoNota <= 0) {
      throw errorFuncional('La venta debe contener al menos un producto o un importe adicional', 400);
    }

    const cantidades = new Map<number, number>();
    if (hasItems) {
      for (const item of body.items) {
        const idPro = idValido(item?.idPro ?? item?.id ?? item?.productoId);
        const cantidad = Number(item?.cantidad);
        if (!idPro || !Number.isInteger(cantidad) || cantidad <= 0) {
          throw errorFuncional('Los productos o cantidades no son válidos', 400);
        }
        cantidades.set(idPro, (cantidades.get(idPro) || 0) + cantidad);
      }

      if (cantidades.size > 90) {
        throw errorFuncional('La venta no puede contener más de 90 productos distintos por transacción.', 400);
      }
    }

    strategy.validarEntrada(body);

    const caja = await this.cajaRepo.getSesionAbierta(empleado?.idSuc || 1, empleado?.idEmp);
    if (!caja) {
      throw errorFuncional('Debes abrir caja antes de registrar ventas.', 409);
    }

    let totalCalculado = 0;
    let costoTotalCalculado = 0;
    const itemsParaVenta = [];
    for (const [idPro, cantidad] of cantidades.entries()) {
      const prod = await this.prodRepo.getProductoById(idPro, empleado?.idSuc || 1);
      if (!prod) throw errorFuncional('El producto no existe', 404);
      if (prod.existenciaPro < cantidad) {
        throw errorFuncional(`Existencias insuficientes para "${prod.nombrePro}". Disponibles: ${prod.existenciaPro}`, 409);
      }
      const precio = Number(prod.precioVentaPro);
      const costo = Number(prod.costoPro || 0);
      totalCalculado += Number((precio * cantidad).toFixed(2));
      costoTotalCalculado += Number((costo * cantidad).toFixed(2));
      itemsParaVenta.push({
        idPro,
        nombrePro: prod.nombrePro,
        cantidad,
        precioUnitario: precio,
        costoUnitario: costo,
      });
    }

    if (montoNota > 0) {
      totalCalculado += Number(montoNota.toFixed(2));
    }

    totalCalculado = Number(totalCalculado.toFixed(2));
    costoTotalCalculado = Number(costoTotalCalculado.toFixed(2));
    const ganancia = Number((totalCalculado - costoTotalCalculado).toFixed(2));
    const margenPorcentaje = totalCalculado > 0 ? Number(((ganancia / totalCalculado) * 100).toFixed(1)) : 0;
    const pagoResult = strategy.validarYCalcular(totalCalculado, body);

    const nota = body.nota ? String(body.nota).trim() : null;

    const venta = await this.ventaRepo.createVenta({
      uuidVenta,
      idSuc: empleado?.idSuc || 1,
      idEmp: empleado?.idEmp || 1,
      idSesionCaja: caja.idSesionCaja,
      totalVenta: totalCalculado,
      costoTotal: costoTotalCalculado,
      ganancia,
      margenPorcentaje,
      nota,
      montoNota: montoNota > 0 ? Number(montoNota.toFixed(2)) : null,
      pagoCon: pagoResult.pagoCon,
      cambio: pagoResult.cambio,
      metodoPago,
      items: itemsParaVenta,
    });

    return toVentaRegistradaDto(venta, empleado);
  }

  async cancelarVenta(idVenta: number, idEmp: number, idSuc: number, motivoInput: string) {
    const motivo = texto(motivoInput);
    if (!idVenta) throw errorFuncional('El folio de venta no es válido', 400);
    if (motivo.length < 3 || motivo.length > 255) {
      throw errorFuncional('El motivo debe tener entre 3 y 255 caracteres', 400);
    }

    return await this.ventaRepo.cancelarVenta(idVenta, idEmp, idSuc, motivo);
  }

  async listarVentas(empleado: { idEmp: number; idSuc: number; cargo: string }) {
    const ventas = await this.ventaRepo.listVentas(empleado?.idSuc || 1);

    const enriched = ventas.map((v: any) => {
      let costoTotal = v.costoTotal;
      if (costoTotal === undefined || costoTotal === null) {
        costoTotal = (v.detalles || v.items || []).reduce((acc: number, d: any) => {
          const c = Number(d.costoUnitario || 0);
          return acc + c * Number(d.cantidad || 0);
        }, 0);
        costoTotal = Number(costoTotal.toFixed(2));
      }
      const totalVenta = Number(v.totalVenta ?? v.total ?? 0);
      const ganancia = v.ganancia !== undefined ? Number(v.ganancia) : Number((totalVenta - costoTotal).toFixed(2));
      const margenPorcentaje = v.margenPorcentaje !== undefined 
        ? Number(v.margenPorcentaje) 
        : (totalVenta > 0 ? Number(((ganancia / totalVenta) * 100).toFixed(1)) : 0);

      return {
        ...v,
        costoTotal,
        ganancia,
        margenPorcentaje,
      };
    });

    if (empleado.cargo === 'CAJERO') {
      return enriched.filter((v: any) => v.idEmp === empleado.idEmp).map(toVentaListDto);
    }
    return enriched.map(toVentaListDto);
  }

  async detalleVenta(idVenta: number, empleado: { idEmp: number; idSuc: number; cargo: string }) {
    const v: any = await this.ventaRepo.getVentaById(idVenta, empleado?.idSuc || 1);
    if (!v) return null;
    if (empleado.cargo === 'CAJERO' && v.idEmp !== empleado.idEmp) {
      return null;
    }

    let costoTotal = v.costoTotal;
    if (costoTotal === undefined || costoTotal === null) {
      costoTotal = (v.detalles || v.items || []).reduce((acc: number, d: any) => {
        const c = Number(d.costoUnitario || 0);
        return acc + c * Number(d.cantidad || 0);
      }, 0);
      costoTotal = Number(costoTotal.toFixed(2));
    }
    const totalVenta = Number(v.totalVenta ?? v.total ?? 0);
    const ganancia = v.ganancia !== undefined ? Number(v.ganancia) : Number((totalVenta - costoTotal).toFixed(2));
    const margenPorcentaje = v.margenPorcentaje !== undefined 
      ? Number(v.margenPorcentaje) 
      : (totalVenta > 0 ? Number(((ganancia / totalVenta) * 100).toFixed(1)) : 0);

    return toVentaDetalleDto({
      ...v,
      costoTotal,
      ganancia,
      margenPorcentaje,
    });
  }
}

export const ventasService = new VentasService();
