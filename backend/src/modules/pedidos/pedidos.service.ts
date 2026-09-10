import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { prisma, DbClient } from '../../config/prisma';
import { env } from '../../config/env';
import {
  eliminarObjetoS3,
  esUrlS3,
  extraerKeyS3,
  generarPresignedDownload,
  generarPresignedUpload,
  limpiarNombreArchivo,
  s3Bucket,
  s3Region,
} from '../../config/s3';
import { comprobantesUploadDir } from '../../middlewares/upload.middleware';
import { dineroCentavos, errorFuncional, idValido,
  encodeId, texto, uuidValido } from '../../utils/formatters';

const HORAS_RESERVA_PEDIDO = 2;
const MAX_TOTAL_PEDIDO_CENTAVOS = 9999999999;

export function folioPedido(idPedido: number): string {
  return `PED-${String(idPedido).padStart(6, '0')}`;
}

export function normalizarConfiguracionTransferencia(row: any, incluirAdministrativo = false) {
  if (!row) return null;
  const configuracion = {
    banco: row.banco,
    titular: row.titular,
    clabe: row.clabe,
    numeroCuenta: row.numeroCuenta,
    instrucciones: row.instrucciones,
  };
  return incluirAdministrativo
    ? {
        idConfiguracion: Number(row.idConfiguracion),
        idSuc: Number(row.idSuc),
        ...configuracion,
        activo: Boolean(row.activo),
        fechaActualizacion: row.fechaActualizacion,
      }
    : configuracion;
}

export function normalizarPedido(row: any) {
  return {
    id: encodeId(Number(row.idPedido)),
    folio: folioPedido(row.idPedido),
    uuidPedido: row.uuidPedido,
    fechaPedido: row.fechaPedido,
    fechaLimitePago: row.fechaLimitePago,
    estado: row.estado,
    total: Number(row.total),
    tieneComprobante: Boolean(row.comprobanteRuta),
    fechaComprobante: row.fechaComprobante || null,
    motivoRechazo: row.motivoRechazo || null,
    idVenta: row.idVenta === null || row.idVenta === undefined ? null : encodeId(Number(row.idVenta)),
    fechaRevision: row.fechaRevision || null,
  };
}

export function normalizarPedidoAdmin(row: any) {
  return {
    ...normalizarPedido(row),
    cliente: {
      id: encodeId(Number(row.cliente?.idCliente || row.idCliente)),
      nombre: [row.cliente?.nombreCliente, row.cliente?.apellidoPatCliente, row.cliente?.apellidoMatCliente]
        .filter(Boolean)
        .join(' '),
      correo: row.cliente?.correoCliente || '',
      foto: row.cliente?.fotoPerfil || null,
    },
  };
}

export function configuracionTransferenciaPedido(pedido: any) {
  const tieneSnapshot = [
    pedido.bancoSnapshot,
    pedido.titularSnapshot,
    pedido.clabeSnapshot,
    pedido.numeroCuentaSnapshot,
    pedido.instruccionesSnapshot,
  ].some((valor) => valor !== null && valor !== undefined);
  if (!tieneSnapshot) return null;
  return {
    banco: pedido.bancoSnapshot,
    titular: pedido.titularSnapshot,
    clabe: pedido.clabeSnapshot,
    numeroCuenta: pedido.numeroCuentaSnapshot,
    instrucciones: pedido.instruccionesSnapshot,
  };
}

export function resolverComprobantePrivado(nombreFisico?: string | null): string | null {
  if (!nombreFisico || path.basename(nombreFisico) !== nombreFisico) return null;
  const raiz = path.resolve(comprobantesUploadDir);
  const ruta = path.resolve(raiz, nombreFisico);
  const relativa = path.relative(raiz, ruta);
  if (!relativa || relativa.startsWith('..') || path.isAbsolute(relativa) || !fs.existsSync(ruta)) return null;
  return ruta;
}

export function mimeRealComprobante(rutaArchivo: string): string | null {
  const descriptor = fs.openSync(rutaArchivo, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const leidos = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    if (leidos >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (leidos >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
      return 'image/png';
    if (leidos >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')
      return 'image/webp';
    if (leidos >= 5 && buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
    return null;
  } finally {
    fs.closeSync(descriptor);
  }
}

export class PedidosService {
  async obtenerSucursalDisponibleCliente() {
    const sucursales = await prisma.sucursal.findMany({
      orderBy: { idSuc: 'asc' },
      take: 2,
      select: { idSuc: true },
    });
    if (!sucursales.length) throw errorFuncional('No hay una sucursal disponible para recibir pedidos.', 409);
    if (sucursales.length > 1) {
      throw errorFuncional('Selecciona una sucursal antes de continuar con tu pedido.', 409);
    }
    return Number(sucursales[0].idSuc);
  }

  async obtenerConfiguracionTransferencia(idSuc: number, exigirActiva = true) {
    const configuracion = await prisma.configuracionTransferencia.findUnique({
      where: { idSuc: Number(idSuc) },
    });
    if (!configuracion || (exigirActiva && !configuracion.activo)) {
      throw errorFuncional('Los pagos por transferencia no están disponibles en este momento.', 409);
    }
    return configuracion;
  }

  async restaurarStockPedido(tx: DbClient, idPedido: number) {
    const detalles = await tx.detallePedidoCliente.findMany({
      where: { idPedido: Number(idPedido) },
      orderBy: { idPro: 'asc' },
    });
    for (const d of detalles) {
      await tx.producto.update({
        where: { idPro: d.idPro },
        data: { existenciaPro: { increment: d.cantidad } },
      });
    }
  }

  async expirarPedidoBloqueado(tx: DbClient, pedido: any): Promise<boolean> {
    const vencido =
      pedido.estado === 'PENDIENTE_PAGO' &&
      !pedido.comprobanteRuta &&
      pedido.fechaLimitePago &&
      new Date(pedido.fechaLimitePago).getTime() < Date.now();
    if (!vencido) return false;

    await this.restaurarStockPedido(tx, Number(pedido.idPedido));
    await tx.pedidoCliente.update({
      where: { idPedido: Number(pedido.idPedido) },
      data: { estado: 'EXPIRADO' },
    });
    return true;
  }

  async liberarPedidosExpirados(idCliente?: number | null) {
    const where: any = {
      estado: 'PENDIENTE_PAGO',
      comprobanteRuta: null,
      fechaLimitePago: { lt: new Date() },
    };
    if (idCliente) where.idCliente = Number(idCliente);

    const candidatos = await prisma.pedidoCliente.findMany({
      where,
      select: { idPedido: true },
      orderBy: { idPedido: 'asc' },
      take: 50,
    });

    for (const candidato of candidatos) {
      try {
        await prisma.$transaction(async (tx) => {
          const p = await tx.pedidoCliente.findUnique({
            where: { idPedido: candidato.idPedido },
          });
          if (p) await this.expirarPedidoBloqueado(tx, p);
        });
      } catch (error: any) {
        console.error('No se pudo liberar un pedido expirado:', error.message);
      }
    }
  }

  async obtenerPedidoSeguro(idPedido: number, idCliente: number, client: DbClient = prisma) {
    const p = await client.pedidoCliente.findFirst({
      where: {
        idPedido: Number(idPedido),
        idCliente: Number(idCliente),
      },
      include: {
        detalles: {
          include: { producto: true },
          orderBy: { idDetallePedido: 'asc' },
        },
      },
    });
    if (!p) return null;

    let configuracionTransferencia = configuracionTransferenciaPedido(p);
    if (!configuracionTransferencia) {
      try {
        const conf = await client.configuracionTransferencia.findUnique({
          where: { idSuc: p.idSuc },
        });
        configuracionTransferencia = normalizarConfiguracionTransferencia(conf);
      } catch {
        configuracionTransferencia = null;
      }
    }

    let comprobanteUrl: string | null = null;
    if (p.comprobanteRuta) {
      try {
        if (esUrlS3(p.comprobanteRuta)) {
          const key = extraerKeyS3(p.comprobanteRuta) || p.comprobanteRuta;
          comprobanteUrl = await generarPresignedDownload(key, p.comprobanteNombre, p.comprobanteMime);
        }
      } catch (err) {
        console.error('Error al generar presigned download para comprobante:', err);
      }
    }

    return {
      ...normalizarPedido(p),
      comprobanteUrl,
      comprobante: p.comprobanteRuta
        ? {
            nombre: p.comprobanteNombre || 'comprobante',
            mime: p.comprobanteMime || 'image/jpeg',
            fecha: p.fechaComprobante,
            url: comprobanteUrl,
          }
        : null,
      items: p.detalles.map((d) => ({
        productoId: encodeId(d.idPro),
        nombre: d.producto?.nombrePro || 'Producto',
        imagen: d.producto?.imagenPro || null,
        presentacion: [d.producto?.tamanoPro, d.producto?.presentacionPro].filter(Boolean).join(' · ') || null,
        cantidad: d.cantidad,
        precioUnitario: Number(d.precioUnitario),
        subtotal: Number(d.subtotal),
      })),
      configuracionTransferencia,
    };
  }

  async obtenerPedidoAdmin(idPedido: number, idSuc: number, client: DbClient = prisma) {
    const p = await client.pedidoCliente.findFirst({
      where: {
        idPedido: Number(idPedido),
        idSuc: Number(idSuc),
      },
      include: {
        cliente: true,
        empleadoRevisa: true,
        detalles: {
          include: { producto: true },
          orderBy: { idDetallePedido: 'asc' },
        },
      },
    });
    if (!p) return null;

    let configuracionTransferencia = configuracionTransferenciaPedido(p);
    if (!configuracionTransferencia) {
      try {
        const conf = await client.configuracionTransferencia.findUnique({
          where: { idSuc: p.idSuc },
        });
        configuracionTransferencia = normalizarConfiguracionTransferencia(conf);
      } catch {
        configuracionTransferencia = null;
      }
    }

    const empRevisa = p.empleadoRevisa
      ? [p.empleadoRevisa.nombreEmp, p.empleadoRevisa.apellidoPatEmp, p.empleadoRevisa.apellidoMatEmp]
          .filter(Boolean)
          .join(' ')
      : null;

    let comprobanteUrl: string | null = null;
    if (p.comprobanteRuta) {
      try {
        if (esUrlS3(p.comprobanteRuta)) {
          const key = extraerKeyS3(p.comprobanteRuta) || p.comprobanteRuta;
          comprobanteUrl = await generarPresignedDownload(key, p.comprobanteNombre, p.comprobanteMime);
        }
      } catch (err) {
        console.error('Error al generar presigned download para comprobante admin:', err);
      }
    }

    return {
      ...normalizarPedidoAdmin(p),
      comprobanteUrl,
      comprobante: p.comprobanteRuta
        ? {
            nombre: p.comprobanteNombre || 'comprobante',
            mime: p.comprobanteMime || 'image/jpeg',
            fecha: p.fechaComprobante,
            url: comprobanteUrl,
          }
        : null,
      empleadoRevisa: empRevisa,
      configuracionTransferencia,
      items: p.detalles.map((item) => ({
        idPro: Number(item.idPro),
        nombre: item.producto?.nombrePro || 'Producto',
        imagen: item.producto?.imagenPro || null,
        presentacion: [item.producto?.tamanoPro, item.producto?.presentacionPro].filter(Boolean).join(' · ') || null,
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precioUnitario),
        subtotal: Number(item.subtotal),
      })),
    };
  }

  async crearPedidoCliente(idCliente: number, body: any) {
    const uuid = uuidValido(body?.uuidPedido);
    if (!uuid) throw errorFuncional('uuidPedido no es válido.', 400);

    let idSuc = idValido(body?.idSuc);
    if (!idSuc) {
      idSuc = await this.obtenerSucursalDisponibleCliente();
    }

    if (!Array.isArray(body?.items) || !body.items.length) {
      throw errorFuncional('El pedido debe incluir al menos un producto.', 400);
    }

    const cantidades = new Map<number, number>();
    for (const item of body.items) {
      const idPro = idValido(item?.idPro ?? item?.id ?? item?.productoId);
      const cantidad = Number(item?.cantidad);
      if (!idPro || !Number.isInteger(cantidad) || cantidad <= 0) {
        throw errorFuncional('Los productos o cantidades no son válidos.', 400);
      }
      cantidades.set(idPro, (cantidades.get(idPro) || 0) + cantidad);
    }

    const ids = [...cantidades.keys()].sort((a, b) => a - b);
    const configuracion = await this.obtenerConfiguracionTransferencia(idSuc);

    return await prisma.$transaction(async (tx) => {
      const repetido = await tx.pedidoCliente.findUnique({
        where: { uuidPedido: uuid },
      });
      if (repetido) {
        if (Number(repetido.idCliente) !== Number(idCliente)) {
          throw errorFuncional('El identificador del pedido ya está en uso.', 409);
        }
        return await this.obtenerPedidoSeguro(repetido.idPedido, idCliente, tx);
      }

      const countFn = typeof (tx.pedidoCliente as any)?.count === 'function'
        ? (tx.pedidoCliente as any).count.bind(tx.pedidoCliente)
        : async (args: any) => ((tx.pedidoCliente as any)?.findMany ? (await (tx.pedidoCliente as any).findMany(args)).length : 0);
      const pendientes = await countFn({
        where: {
          idCliente: Number(idCliente),
          estado: 'PENDIENTE_PAGO',
          comprobanteRuta: null,
          fechaLimitePago: { gt: new Date() },
        },
      });
      if (pendientes >= 3) {
        throw errorFuncional(
          'Tienes 3 pedidos pendientes de pago. Completa o cancela alguno de ellos antes de generar uno nuevo.',
          409,
        );
      }

      const productos = await tx.producto.findMany({
        where: { idPro: { in: ids } },
        orderBy: { idPro: 'asc' },
      });

      if (productos.length !== ids.length) {
        const encontrados = new Set(productos.map((p) => Number(p.idPro)));
        const faltante = ids.find((id) => !encontrados.has(id));
        throw errorFuncional('Uno de los productos ya no está disponible.', 404, { idPro: faltante });
      }

      let totalCentavos = 0;
      const itemsPedido = productos.map((producto) => {
        const cantidad = cantidades.get(Number(producto.idPro))!;
        const disponible = Number(producto.existenciaPro) || 0;
        if (!producto.activoPro) {
          throw errorFuncional(`${producto.nombrePro || 'El producto'} ya no está disponible para venta.`, 409, { idPro: producto.idPro });
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
        if (!Number.isSafeInteger(totalCentavos) || totalCentavos > MAX_TOTAL_PEDIDO_CENTAVOS) {
          throw errorFuncional('El total del pedido supera el límite permitido.', 409);
        }
        return {
          idPro: Number(producto.idPro),
          cantidad,
          precioUnitario: precioCentavos / 100,
          subtotal: subtotalCentavos / 100,
        };
      });

      const ahora = new Date();
      const fechaLimitePago = new Date(ahora.getTime() + HORAS_RESERVA_PEDIDO * 60 * 60 * 1000);

      const pedido = await tx.pedidoCliente.create({
        data: {
          uuidPedido: uuid,
          idCliente,
          idSuc,
          fechaPedido: ahora,
          total: totalCentavos / 100,
          estado: 'PENDIENTE_PAGO',
          fechaLimitePago,
          bancoSnapshot: configuracion.banco,
          titularSnapshot: configuracion.titular,
          clabeSnapshot: configuracion.clabe || null,
          numeroCuentaSnapshot: configuracion.numeroCuenta || null,
          instruccionesSnapshot: configuracion.instrucciones || null,
          detalles: {
            create: itemsPedido.map((item) => ({
              idPro: item.idPro,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
              subtotal: item.subtotal,
            })),
          },
        },
      });

      for (const item of itemsPedido) {
        await tx.producto.update({
          where: { idPro: item.idPro },
          data: { existenciaPro: { decrement: item.cantidad } },
        });
      }

      return await this.obtenerPedidoSeguro(pedido.idPedido, idCliente, tx);
    });
  }

  async cancelarPedidoCliente(idPedido: number, idCliente: number) {
    return await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoCliente.findFirst({
        where: { idPedido, idCliente },
      });
      if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);

      if (await this.expirarPedidoBloqueado(tx, pedido)) {
        throw errorFuncional('Tu reserva expiró y los productos volvieron al inventario.', 409);
      }

      if (pedido.estado !== 'PENDIENTE_PAGO' || pedido.comprobanteRuta) {
        throw errorFuncional(`El pedido ya no puede cancelarse porque está ${pedido.estado}.`, 409);
      }

      await this.restaurarStockPedido(tx, idPedido);
      await tx.pedidoCliente.update({
        where: { idPedido },
        data: { estado: 'CANCELADO' },
      });

      return await this.obtenerPedidoSeguro(idPedido, idCliente, tx);
    });
  }

  async presignComprobante(
    idPedido: number,
    idCliente: number,
    mimeType: string,
    extensionOriginal?: string,
    nombreOriginal?: string,
  ) {
    const pedido = await prisma.pedidoCliente.findFirst({
      where: { idPedido, idCliente },
    });
    if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);
    if (!['PENDIENTE_PAGO', 'EN_REVISION', 'RECHAZADO'].includes(pedido.estado)) {
      throw errorFuncional(`No se puede subir comprobante a un pedido en estado ${pedido.estado}.`, 409);
    }
    return await generarPresignedUpload({
      folder: 'comprobantes',
      mimeType,
      extensionOriginal,
      nombreArchivoOriginal: nombreOriginal || `comprobante-${idPedido}`,
    });
  }

  async confirmarComprobante(
    idPedido: number,
    idCliente: number,
    keyOUrl: string,
    nombreOriginal?: string,
    mimeType?: string,
  ) {
    return await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoCliente.findFirst({
        where: { idPedido, idCliente },
      });
      if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);

      if (await this.expirarPedidoBloqueado(tx, pedido)) {
        throw errorFuncional('Tu reserva expiró y los productos volvieron al inventario.', 409);
      }

      if (!['PENDIENTE_PAGO', 'EN_REVISION', 'RECHAZADO'].includes(pedido.estado)) {
        throw errorFuncional(`No se puede adjuntar comprobante a un pedido en estado ${pedido.estado}.`, 409);
      }

      const anteriorRuta = pedido.comprobanteRuta;
      const key = extraerKeyS3(keyOUrl) || keyOUrl;
      const mime = mimeType || 'image/jpeg';
      const nombreSeguro = limpiarNombreArchivo(nombreOriginal || path.basename(key) || 'comprobante.jpg');

      await tx.pedidoCliente.update({
        where: { idPedido },
        data: {
          comprobanteRuta: key,
          comprobanteMime: mime,
          comprobanteNombre: nombreSeguro,
          fechaComprobante: new Date(),
          estado: 'EN_REVISION',
          motivoRechazo: null,
        },
      });

      if (anteriorRuta && anteriorRuta !== key) {
        if (esUrlS3(anteriorRuta)) {
          void eliminarObjetoS3(anteriorRuta);
        } else {
          const rutaLocal = resolverComprobantePrivado(anteriorRuta);
          if (rutaLocal) fs.unlink(rutaLocal, () => undefined);
        }
      }

      return await this.obtenerPedidoSeguro(idPedido, idCliente, tx);
    });
  }

  async rechazarPedidoAdmin(idPedido: number, idSuc: number, idEmp: number, motivoInput: string) {
    const motivo = texto(motivoInput);
    if (!idPedido) throw errorFuncional('El pedido no es válido.', 400);
    if (motivo.length < 3 || motivo.length > 255) {
      throw errorFuncional('El motivo debe tener entre 3 y 255 caracteres.', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoCliente.findFirst({
        where: { idPedido, idSuc },
      });
      if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);
      if (pedido.estado !== 'EN_REVISION') {
        throw errorFuncional('Sólo pueden rechazarse pedidos con pago en revisión.', 409);
      }

      const anteriorComprobante = pedido.comprobanteRuta;

      await tx.pedidoCliente.update({
        where: { idPedido },
        data: {
          estado: 'RECHAZADO',
          idEmpRevisa: idEmp,
          fechaRevision: new Date(),
          motivoRechazo: motivo,
          comprobanteRuta: null,
          comprobanteMime: null,
          comprobanteNombre: null,
          fechaComprobante: null,
        },
      });

      if (anteriorComprobante) {
        if (esUrlS3(anteriorComprobante)) {
          void eliminarObjetoS3(anteriorComprobante);
        } else {
          const rutaLocal = resolverComprobantePrivado(anteriorComprobante);
          if (rutaLocal) fs.unlink(rutaLocal, () => undefined);
        }
      }

      return await this.obtenerPedidoAdmin(idPedido, idSuc, tx);
    });
  }

  async aprobarPedidoAdmin(idPedido: number, idSuc: number, idEmp: number) {
    if (!idPedido) throw errorFuncional('El pedido no es válido.', 400);

    return await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoCliente.findFirst({
        where: { idPedido, idSuc },
        include: {
          detalles: { orderBy: { idPro: 'asc' } },
        },
      });
      if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);
      if (pedido.estado === 'PAGADO' && pedido.idVenta) throw errorFuncional('El pedido ya fue aprobado.', 409);
      if (pedido.estado !== 'EN_REVISION')
        throw errorFuncional('Sólo pueden aprobarse pedidos con pago en revisión.', 409);
      if (!pedido.comprobanteRuta || !pedido.fechaComprobante)
        throw errorFuncional('El pedido no tiene un comprobante válido para revisar.', 409);
      if (!esUrlS3(pedido.comprobanteRuta) && !resolverComprobantePrivado(pedido.comprobanteRuta)) {
        throw errorFuncional('El archivo del comprobante no está disponible.', 409);
      }
      if (!pedido.detalles.length) throw errorFuncional('El pedido no contiene productos.', 409);

      let sumaCentavos = 0;
      for (const detalle of pedido.detalles) {
        const cantidad = Number(detalle.cantidad);
        const precioCentavos = dineroCentavos(detalle.precioUnitario);
        const subtotalCentavos = dineroCentavos(detalle.subtotal);
        if (
          !Number.isInteger(cantidad) ||
          cantidad <= 0 ||
          precioCentavos === null ||
          precioCentavos < 0 ||
          subtotalCentavos === null ||
          subtotalCentavos !== precioCentavos * cantidad
        ) {
          throw errorFuncional('Los importes históricos del pedido no son coherentes.', 409);
        }
        sumaCentavos += subtotalCentavos;
        if (!Number.isSafeInteger(sumaCentavos)) throw errorFuncional('El total del pedido no es válido.', 409);
      }
      const totalPedidoCentavos = dineroCentavos(pedido.total);
      if (totalPedidoCentavos === null || sumaCentavos !== totalPedidoCentavos)
        throw errorFuncional('El total del pedido no coincide con sus productos.', 409);

      const ahora = new Date();

      const venta = await tx.venta.create({
        data: {
          uuidVenta: crypto.randomUUID(),
          fechaVenta: ahora,
          horaVenta: ahora,
          total: totalPedidoCentavos / 100,
          metodoPago: 'TRANSFERENCIA',
          montoRecibido: null,
          cambio: 0.0,
          estadoVenta: 'COMPLETADA',
          idEmp,
          idSuc: pedido.idSuc,
          detalles: {
            create: pedido.detalles.map((d) => ({
              idPro: d.idPro,
                cantidadDetVenta: d.cantidad,
              precioUnitarioDetVenta: Number(d.precioUnitario),
              subtotalDetVenta: Number(d.subtotal),
            })),
          },
        },
      });

      await tx.pedidoCliente.update({
        where: { idPedido },
        data: {
          estado: 'PAGADO',
          idEmpRevisa: idEmp,
          fechaRevision: ahora,
          motivoRechazo: null,
          idVenta: venta.idVenta,
        },
      });

      return await this.obtenerPedidoAdmin(idPedido, idSuc, tx);
    });
  }

  async cambiarEstadoOperativo(idPedido: number, idSuc: number, estadoActual: string, estadoNuevo: string) {
    if (!idPedido) throw errorFuncional('El pedido no es válido.', 400);

    return await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoCliente.findFirst({
        where: { idPedido, idSuc },
      });
      if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);
      if (pedido.estado !== estadoActual)
        throw errorFuncional(`El pedido debe estar en estado ${estadoActual} para continuar.`, 409);

      await tx.pedidoCliente.update({
        where: { idPedido },
        data: { estado: estadoNuevo },
      });

      return await this.obtenerPedidoAdmin(idPedido, idSuc, tx);
    });
  }
}

export const pedidosService = new PedidosService();




