import { prisma, DbClient } from '../../config/prisma';
import {
  dineroCentavos,
  errorFuncional,
  formatearFechaVenta,
  formatearHoraVenta,
  idValido,
  texto,
  uuidValido,
  encodeId,
} from '../../utils/formatters';
import { empleadoSeguro } from '../../utils/security';
import { toVentaRegistradaDto, toVentaListDto, toVentaDetalleDto } from '../../dtos/venta.dto';

export class VentasService {
  async obtenerVentaRegistrada(idVenta: number, empleado: any, client: DbClient = prisma) {
    const v = await client.venta.findUnique({
      where: { idVenta: Number(idVenta) },
      include: {
        empleado: true,
        detalles: {
          include: { producto: true },
          orderBy: { idDetVenta: 'asc' },
        },
      },
    });
    if (!v) return null;

    return toVentaRegistradaDto(v, empleado);
  }

  async crearVenta(empleado: any, body: any) {
    const uuidVenta = uuidValido(body.uuidVenta);
    if (!uuidVenta) throw errorFuncional('uuidVenta no es válido', 400);

    const metodoPago = texto(body.metodoPago).toUpperCase();
    const metodosValidos = new Set(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']);
    if (!metodosValidos.has(metodoPago)) throw errorFuncional('El método de pago no es válido', 400);

    if (!Array.isArray(body.items) || !body.items.length) {
      throw errorFuncional('La venta no contiene productos', 400);
    }

    const cantidades = new Map<number, number>();
    for (const item of body.items) {
      const idPro = idValido(item?.idPro ?? item?.id ?? item?.productoId);
      const cantidad = Number(item?.cantidad);
      if (!idPro || !Number.isInteger(cantidad) || cantidad <= 0) {
        throw errorFuncional('Los productos o cantidades no son válidos', 400);
      }
      cantidades.set(idPro, (cantidades.get(idPro) || 0) + cantidad);
    }

    const ids = [...cantidades.keys()].sort((a, b) => a - b);
    const montoRecibidoCentavos = metodoPago === 'EFECTIVO' ? dineroCentavos(body.montoRecibido) : null;
    if (metodoPago === 'EFECTIVO' && (montoRecibidoCentavos === null || montoRecibidoCentavos < 0)) {
      throw errorFuncional('El monto recibido no es válido', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const repetida = await tx.venta.findUnique({
        where: { uuidVenta },
      });
      if (repetida) {
        if (Number(repetida.idEmp) !== Number(empleado.idEmp) || Number(repetida.idSuc) !== Number(empleado.idSuc)) {
          throw errorFuncional('El identificador de venta ya está en uso.', 409);
        }
        return await this.obtenerVentaRegistrada(repetida.idVenta, empleado, tx);
      }

      const caja = await tx.sesionCaja.findFirst({
        where: { idEmp: empleado.idEmp, estado: 'ABIERTA' },
      });
      if (!caja) {
        throw errorFuncional('Debes abrir caja antes de registrar ventas.', 409);
      }

      const productos = await tx.producto.findMany({
        where: { idPro: { in: ids } },
        orderBy: { idPro: 'asc' },
      });

      if (productos.length !== ids.length) {
        const encontrados = new Set(productos.map((p) => Number(p.idPro)));
        const faltante = ids.find((id) => !encontrados.has(id));
        throw errorFuncional('Uno de los productos ya no está disponible', 404, { idPro: faltante });
      }

      let totalCentavos = 0;
      const itemsVenta = productos.map((producto) => {
        const cantidad = cantidades.get(Number(producto.idPro))!;
        const disponible = Number(producto.existenciaPro) || 0;
        if (!producto.activoPro) {
          throw errorFuncional(`${producto.nombrePro || 'El producto'} no está disponible para venta.`, 409, { idPro: producto.idPro });
        }
        if (cantidad > disponible) {
          throw errorFuncional(`Stock insuficiente para ${producto.nombrePro || 'el producto'}.`, 409, { idPro: producto.idPro, disponible });
        }
        const precioCentavos = dineroCentavos(producto.precioVentaPro);
        if (precioCentavos === null || precioCentavos < 0) {
          throw errorFuncional(`${producto.nombrePro || 'El producto'} no tiene un precio válido.`, 409, { idPro: producto.idPro });
        }
        const subtotalCentavos = precioCentavos * cantidad;
        totalCentavos += subtotalCentavos;
        return {
          idPro: Number(producto.idPro),
          nombre: producto.nombrePro,
          cantidad,
          precioUnitario: precioCentavos / 100,
          subtotal: subtotalCentavos / 100,
        };
      });

      if (metodoPago === 'EFECTIVO' && montoRecibidoCentavos! < totalCentavos) {
        throw errorFuncional('El efectivo recibido es insuficiente.', 400);
      }
      const cambioCentavos = metodoPago === 'EFECTIVO' ? montoRecibidoCentavos! - totalCentavos : 0;
      const montoDb = metodoPago === 'EFECTIVO' ? montoRecibidoCentavos! / 100 : null;

      const ahora = new Date();

      const venta = await tx.venta.create({
        data: {
          uuidVenta,
          fechaVenta: ahora,
          horaVenta: ahora,
          total: totalCentavos / 100,
          metodoPago,
          montoRecibido: montoDb,
          cambio: cambioCentavos / 100,
          estadoVenta: 'COMPLETADA',
          idEmp: empleado.idEmp,
          idSuc: empleado.idSuc,
          idSesionCaja: caja.idSesionCaja,
          detalles: {
            create: itemsVenta.map((item) => ({
              idPro: item.idPro,
              cantidadDetVenta: item.cantidad,
              precioUnitarioDetVenta: item.precioUnitario,
              subtotalDetVenta: item.subtotal,
            })),
          },
        },
      });

      for (const item of itemsVenta) {
        await tx.producto.update({
          where: { idPro: item.idPro },
          data: { existenciaPro: { decrement: item.cantidad } },
        });
      }

      return await this.obtenerVentaRegistrada(venta.idVenta, empleado, tx);
    });
  }

  async cancelarVenta(idVenta: number, idEmp: number, idSuc: number, motivoInput: string) {
    const motivo = texto(motivoInput);
    if (!idVenta) throw errorFuncional('El folio de venta no es válido', 400);
    if (motivo.length < 3 || motivo.length > 255) {
      throw errorFuncional('El motivo debe tener entre 3 y 255 caracteres', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findFirst({
        where: { idVenta },
        include: {
          sesionCaja: true,
          pedidos: true,
          detalles: true,
        },
      });
      if (!venta || Number(venta.idSuc) !== Number(idSuc)) {
        throw errorFuncional('Venta no encontrada', 404);
      }
      if (venta.estadoVenta === 'CANCELADA') {
        throw errorFuncional('La venta ya fue cancelada.', 409);
      }
      if (venta.estadoVenta !== 'COMPLETADA') {
        throw errorFuncional('La venta no se encuentra en un estado cancelable.', 409);
      }
      if (venta.idSesionCaja && venta.sesionCaja?.estado === 'CERRADA') {
        throw errorFuncional('La venta pertenece a una caja cerrada.', 409);
      }
      if (venta.pedidos && venta.pedidos.length > 0) {
        throw errorFuncional('Las ventas de pedidos online deben gestionarse desde el pedido.', 409);
      }
      if (!venta.detalles.length) {
        throw errorFuncional('La venta no contiene detalles para restaurar.', 409);
      }

      for (const d of venta.detalles) {
        await tx.producto.update({
          where: { idPro: d.idPro },
          data: { existenciaPro: { increment: d.cantidadDetVenta } },
        });
      }

      const ahora = new Date();
      const actualizada = await tx.venta.update({
        where: { idVenta },
        data: {
          estadoVenta: 'CANCELADA',
          fechaCancelacion: ahora,
          motivoCancelacion: motivo,
          idEmpCancela: idEmp,
        },
      });

      return { id: encodeId(actualizada.idVenta), estado: actualizada.estadoVenta, fechaCancelacion: actualizada.fechaCancelacion?.toISOString() || null, motivoCancelacion: actualizada.motivoCancelacion, cajeroCancelaId: encodeId(actualizada.idEmpCancela), };
    });
  }

  async listarVentas(empleado: { idEmp: number; idSuc: number; cargo: string }) {
    const where = empleado.cargo === 'CAJERO' ? { idEmp: empleado.idEmp } : { idSuc: empleado.idSuc };

    const ventas = await prisma.venta.findMany({
      where,
      orderBy: [{ fechaVenta: 'desc' }, { horaVenta: 'desc' }, { idVenta: 'desc' }],
      include: {
        empleado: true,
        pedidos: { select: { idPedido: true } },
      },
    });

    return ventas.map(toVentaListDto);
  }

  async detalleVenta(idVenta: number, empleado: { idEmp: number; idSuc: number; cargo: string }) {
    const where = {
      idVenta,
      ...(empleado.cargo === 'CAJERO' ? { idEmp: empleado.idEmp } : { idSuc: empleado.idSuc }),
    };

    const v = await prisma.venta.findFirst({
      where,
      include: {
        empleado: true,
        empleadoCancela: true,
        sucursal: true,
        pedidos: { select: { idPedido: true } },
        detalles: {
          include: { producto: true },
          orderBy: { idDetVenta: 'asc' },
        },
      },
    });

    if (!v) return null;

    const cajeroStr = v.empleado
      ? [v.empleado.nombreEmp, v.empleado.apellidoPatEmp, v.empleado.apellidoMatEmp].filter(Boolean).join(' ')
      : null;
    const canceladorStr = v.empleadoCancela
      ? [v.empleadoCancela.nombreEmp, v.empleadoCancela.apellidoPatEmp, v.empleadoCancela.apellidoMatEmp]
          .filter(Boolean)
          .join(' ')
      : null;
    const origenVenta = v.pedidos && v.pedidos.length > 0 ? 'ONLINE' : 'POS';

    return toVentaDetalleDto(v);
  }
}

export const ventasService = new VentasService();
