import { comprobantesUploadDir } from '../../middlewares/upload.middleware';
import { dineroCentavos, errorFuncional, idValido, encodeId, texto, uuidValido } from '../../utils/formatters';
import { pedidoRepository } from '../../db/repositories/pedido.repository';
import { productoRepository } from '../../db/repositories/producto.repository';
import { configuracionRepository } from '../../db/repositories/configuracion.repository';
import { authRepository } from '../../db/repositories/auth.repository';
import {
  folioPedido,
  normalizarConfiguracionTransferencia,
  normalizarDetallePedido,
  normalizarPedido,
  normalizarPedidoAdmin,
  configuracionTransferenciaPedido,
} from '../../dtos/pedido.dto';
import { storageService, IStorageService } from '../../services/storage.service';
import { OrderStateMachine, defaultOrderStateMachine } from './pedido-state.machine';
import { FcmService, IFcmService } from '../notificaciones/fcm.service';

export {
  folioPedido,
  normalizarConfiguracionTransferencia,
  normalizarDetallePedido,
  normalizarPedido,
  normalizarPedidoAdmin,
  configuracionTransferenciaPedido,
};

export function resolverComprobantePrivado(nombreFisico?: string | null): string | null {
  return storageService.resolverComprobantePrivado(nombreFisico);
}

export function mimeRealComprobante(rutaArchivo: string): string | null {
  return storageService.detectarMimeReal(rutaArchivo);
}

/**
 * =========================================================================
 * Interface Segregation & Dependency Inversion Principle (ISP / DIP) - Pedidos
 * =========================================================================
 * Segregación entre la operativa de cara al cliente y la administración:
 * - IClientePedidoService: Operaciones públicas de compras y comprobantes
 * - IAdminPedidoService: Operaciones de backoffice (aprobación, rechazo, entrega)
 * Con soporte para inyección de dependencias desacopladas en el constructor.
 */
export interface IClientePedidoService {
  obtenerSucursalDisponibleCliente(): Promise<number>;
  obtenerConfiguracionTransferencia(idSuc: number, exigirActiva?: boolean): Promise<any>;
  crearPedidoCliente(idCliente: number, body: any): Promise<any>;
  liberarPedidosExpirados(idCliente?: number): Promise<any>;
  listarPedidosCliente(idCliente: number): Promise<any>;
  obtenerPedidoSeguro(idPedido: number, idCliente: number): Promise<any>;
  cancelarPedidoCliente(idPedido: number, idCliente: number): Promise<any>;
  presignComprobante(
    idPedido: number,
    idCliente: number,
    mimeType: string,
    extensionOriginal?: string,
    nombreOriginal?: string,
  ): Promise<any>;
  confirmarComprobante(
    idPedido: number,
    idCliente: number,
    keyOUrl: string,
    nombreOriginal?: string,
    mimeType?: string,
  ): Promise<any>;
}

export interface IAdminPedidoService {
  listarPedidosAdmin(idSuc: number): Promise<any>;
  obtenerPedidoAdmin(idPedido: number, idSuc: number): Promise<any>;
  rechazarPedidoAdmin(idPedido: number, idSuc: number, idEmp: number, motivoInput: string): Promise<any>;
  aprobarPedidoAdmin(idPedido: number, idSuc: number, idEmp: number): Promise<any>;
  cambiarEstadoOperativo(idPedido: number, idSuc: number, estadoActual: string, estadoNuevo: string): Promise<any>;
}

export interface IPedidosService extends IClientePedidoService, IAdminPedidoService {}

export class PedidosService implements IPedidosService {
  constructor(
    private stateMachine: OrderStateMachine = defaultOrderStateMachine,
    private storage: IStorageService = storageService,
    private pedidoRepo: any = pedidoRepository,
    private prodRepo: any = productoRepository,
    private configRepo: any = configuracionRepository,
    private authRepo: any = authRepository,
    private fcmService: IFcmService = new FcmService(),
  ) {}

  async obtenerSucursalDisponibleCliente() {
    return 1;
  }

  async obtenerConfiguracionTransferencia(idSuc: number, exigirActiva = true) {
    const conf = await this.configRepo.getConfiguracion(idSuc);
    if (!conf || (exigirActiva && !conf.activo)) {
      throw errorFuncional('Los pagos por transferencia no están disponibles en este momento.', 409);
    }
    return conf;
  }

  async liberarPedidosExpirados(_idCliente?: number | null) {
    // Single-table DynamoDB: expiraciones automáticas controladas por tiempo o TTL
    return;
  }

  async obtenerPedidoSeguro(idPedido: number, idCliente: number) {
    const p = await this.pedidoRepo.getPedidoById(idCliente, idPedido);
    if (!p) return null;

    let comprobanteUrl: string | null = null;
    const rutaComprobante = p.comprobanteRuta || p.comprobanteUrl;
    if (rutaComprobante) {
      try {
        if (this.storage.esS3(rutaComprobante)) {
          const key = this.storage.extraerKey(rutaComprobante) || rutaComprobante;
          comprobanteUrl = await this.storage.generarPresignedDownload(key, p.comprobanteNombre, p.comprobanteMime);
        } else {
          comprobanteUrl = rutaComprobante;
        }
      } catch (err) {
        console.error('Error al generar presigned download para comprobante:', err);
      }
    }

    let configuracionTransferencia: any = null;
    try {
      const conf = await this.configRepo.getConfiguracion(p.idSuc || 1);
      if (conf) {
        configuracionTransferencia = {
          banco: conf.banco,
          titular: conf.titular,
          clabe: conf.clabe || null,
          numeroCuenta: conf.numeroCuenta || null,
          instrucciones: conf.instrucciones || null,
        };
      }
    } catch (err) {
      console.error('Error al obtener configuracion de transferencia para pedido:', err);
    }

    if (
      p.estado === 'PENDIENTE_PAGO' &&
      !rutaComprobante &&
      p.fechaLimitePago &&
      new Date(p.fechaLimitePago).getTime() < Date.now()
    ) {
      await this.pedidoRepo.expirarPedido(p.idCliente, p.idPedido);
      p.estado = 'EXPIRADO';
    }

    return {
      id: encodeId(p.idPedido),
      folio: folioPedido(p.idPedido),
      uuidPedido: `pedido-${p.idPedido}`,
      fechaPedido: p.fechaCreacion,
      fechaLimitePago: p.fechaLimitePago || p.fechaCreacion,
      estado: p.estado,
      total: Number(p.totalPedido || 0),
      tieneComprobante: Boolean(rutaComprobante),
      fechaComprobante: p.fechaComprobante || p.fechaCreacion,
      motivoRechazo: p.motivoRechazo || null,
      idVenta: p.idVenta ? encodeId(p.idVenta) : null,
      fechaRevision: p.fechaRevision || null,
      comprobanteUrl,
      comprobante: rutaComprobante
        ? {
            nombre: p.comprobanteNombre || 'comprobante',
            mime: p.comprobanteMime || 'image/jpeg',
            fecha: p.fechaComprobante || p.fechaCreacion,
            url: comprobanteUrl,
          }
        : null,
      configuracionTransferencia,
      items: (p.detalles || []).map(normalizarDetallePedido),
    };
  }

  async obtenerPedidoAdmin(idPedido: number, idSuc: number) {
    const pedidos = await this.pedidoRepo.listPedidosAdmin(idSuc);
    const p = pedidos.find((item: any) => item.idPedido === idPedido);
    if (!p) return null;

    let comprobanteUrl: string | null = null;
    const rutaComprobante = p.comprobanteRuta || p.comprobanteUrl;
    if (rutaComprobante) {
      try {
        if (this.storage.esS3(rutaComprobante)) {
          const key = this.storage.extraerKey(rutaComprobante) || rutaComprobante;
          comprobanteUrl = await this.storage.generarPresignedDownload(key, p.comprobanteNombre, p.comprobanteMime);
        } else {
          comprobanteUrl = rutaComprobante;
        }
      } catch (err) {
        console.error('Error al generar presigned download para comprobante admin:', err);
      }
    }

    let clienteData = {
      id: encodeId(p.idCliente),
      nombre: p.clienteNombre || 'Cliente',
      correo: p.clienteCorreo || '',
      foto: null as string | null,
    };

    try {
      const cli = await this.authRepo.findClienteById(p.idCliente);
      if (cli) {
        const nombreCompleto = [cli.nombreCliente, cli.apellidoPatCliente, cli.apellidoMatCliente]
          .filter(Boolean)
          .join(' ');
        clienteData = {
          id: encodeId(cli.idCliente),
          nombre: nombreCompleto || cli.nombreCliente || 'Cliente',
          correo: cli.correoCliente || '',
          foto: cli.fotoPerfil || null,
        };
      }
    } catch (err) {
      console.error('Error al obtener cliente para pedido admin:', err);
    }

    let empleadoRevisa: string | null = null;
    if (p.idEmpRevisa) {
      try {
        const emp = await this.authRepo.findEmpleadoById(p.idEmpRevisa);
        if (emp) {
          empleadoRevisa = [emp.nombreEmp, emp.apellidoPatEmp, emp.apellidoMatEmp].filter(Boolean).join(' ');
        }
      } catch (err) {
        console.error('Error al obtener empleado revisa para pedido admin:', err);
      }
    }

    return {
      id: encodeId(p.idPedido),
      folio: folioPedido(p.idPedido),
      uuidPedido: `pedido-${p.idPedido}`,
      fechaPedido: p.fechaCreacion,
      fechaLimitePago: p.fechaLimitePago || p.fechaCreacion,
      estado: p.estado,
      total: Number(p.totalPedido || 0),
      tieneComprobante: Boolean(rutaComprobante),
      fechaComprobante: p.fechaComprobante || p.fechaCreacion,
      motivoRechazo: p.motivoRechazo || null,
      idVenta: p.idVenta ? encodeId(p.idVenta) : null,
      fechaRevision: p.fechaRevision || null,
      cliente: clienteData,
      comprobanteUrl,
      comprobante: rutaComprobante
        ? {
            nombre: p.comprobanteNombre || 'comprobante',
            mime: p.comprobanteMime || 'image/jpeg',
            fecha: p.fechaComprobante || p.fechaCreacion,
            url: comprobanteUrl,
          }
        : null,
      empleadoRevisa,
      configuracionTransferencia: await this.configRepo
        .getConfiguracion(idSuc || 1)
        .then((conf: any) =>
          conf
            ? {
                banco: conf.banco,
                titular: conf.titular,
                clabe: conf.clabe || null,
                numeroCuenta: conf.numeroCuenta || null,
                instrucciones: conf.instrucciones || null,
              }
            : null,
        )
        .catch(() => null),
      items: (p.detalles || []).map(normalizarDetallePedido),
    };
  }

  async crearPedidoCliente(idCliente: number, body: any) {
    const uuid = uuidValido(body.uuidPedido);
    if (!uuid) throw errorFuncional('uuidPedido no es válido', 400);

    // Idempotencia rápida: Si el pedido ya fue creado previamente, retornarlo sin duplicar
    if (this.pedidoRepo.getPedidoByUuid) {
      const existente = await this.pedidoRepo.getPedidoByUuid(uuid, idCliente);
      if (existente) {
        return await this.obtenerPedidoSeguro(existente.idPedido, idCliente);
      }
    }

    const idSuc = 1;
    if (!Array.isArray(body.items) || !body.items.length) {
      throw errorFuncional('El pedido debe incluir al menos un producto.', 400);
    }

    const cantidades = new Map<number, number>();
    for (let index = 0; index < body.items.length; index++) {
      const item = body.items[index];
      const rawId = item?.idPro ?? item?.id ?? item?.productoId;
      const idPro = idValido(rawId);
      const cantidad = Number(item?.cantidad);
      if (!idPro) {
        throw errorFuncional('El identificador del producto es requerido', 400, {
          errores: [{ campo: `items.${index}.idPro`, mensaje: 'El identificador del producto es requerido' }],
        });
      }
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw errorFuncional('Cada producto debe tener una cantidad entera mayor que cero.', 400, {
          errores: [{ campo: `items.${index}.cantidad`, mensaje: 'La cantidad debe ser mayor que cero' }],
        });
      }
      cantidades.set(idPro, (cantidades.get(idPro) || 0) + cantidad);
    }

    if (cantidades.size > 90) {
      throw errorFuncional('El pedido no puede contener más de 90 productos distintos por transacción.', 400);
    }

    await this.obtenerConfiguracionTransferencia(idSuc);

    const itemsPedido = [];
    let totalCentavos = 0;
    for (const [idPro, cantidad] of cantidades.entries()) {
      const prod = await this.prodRepo.getProductoById(idPro, idSuc);
      if (!prod) {
        throw errorFuncional('Uno de los productos ya no está disponible.', 404, { idPro });
      }
      if (!prod.activoPro) {
        throw errorFuncional(`${prod.nombrePro} ya no está disponible para venta.`, 409, { idPro });
      }
      if (cantidad > prod.existenciaPro) {
        throw errorFuncional(`Stock insuficiente para ${prod.nombrePro}.`, 409, {
          idPro,
          disponible: prod.existenciaPro,
        });
      }
      const precioCentavos = dineroCentavos(prod.precioVentaPro);
      if (precioCentavos === null || precioCentavos < 0) {
        throw errorFuncional(`${prod.nombrePro} no tiene un precio válido.`, 409, { idPro });
      }
      const subtotalCentavos = precioCentavos * cantidad;
      totalCentavos += subtotalCentavos;
      itemsPedido.push({
        idPro,
        nombrePro: prod.nombrePro,
        cantidad,
        precioUnitario: precioCentavos / 100,
        imagenPro: prod.imagenPro || undefined,
      });
    }

    const cliente = await this.authRepo.findClienteById(idCliente);
    const nombreCompleto = cliente
      ? [cliente.nombreCliente, cliente.apellidoPatCliente, cliente.apellidoMatCliente].filter(Boolean).join(' ')
      : undefined;

    const ahora = new Date();
    const fechaLimitePago = new Date(ahora.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const pedido = await this.pedidoRepo.createPedido({
      uuidPedido: uuid,
      idCliente,
      idSuc,
      clienteNombre: nombreCompleto || cliente?.nombreCliente,
      clienteCorreo: cliente?.correoCliente,
      clienteTelefono: cliente?.telefono,
      totalPedido: totalCentavos / 100,
      fechaLimitePago,
      items: itemsPedido,
    });

    const folio = folioPedido(pedido.idPedido);
    void this.fcmService.enviarACliente(idCliente, {
      titulo: 'Pedido Registrado',
      cuerpo: `Tu pedido #${folio} ha sido registrado exitosamente. Recuerda subir tu comprobante antes de vencer.`,
      data: { idPedido: String(pedido.idPedido), url: '/mis-pedidos' },
    });
    void this.fcmService.enviarAEmpleados({
      titulo: 'Nuevo Pedido en Línea',
      cuerpo: `Se registró el pedido #${folio} por un total de $${pedido.totalPedido}.`,
      data: { idPedido: String(pedido.idPedido), url: '/pedidos-admin' },
    });

    return await this.obtenerPedidoSeguro(pedido.idPedido, idCliente);
  }

  async cancelarPedidoCliente(idPedido: number, idCliente: number) {
    const pedido = await this.pedidoRepo.getPedidoById(idCliente, idPedido);
    if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);

    if (
      (pedido.estado !== 'PENDIENTE_PAGO' && pedido.estado !== 'PENDIENTE') ||
      pedido.comprobanteRuta ||
      pedido.comprobanteUrl
    ) {
      throw errorFuncional(`El pedido ya no puede cancelarse porque está ${pedido.estado}.`, 409);
    }

    await this.pedidoRepo.cancelarPedido(idCliente, idPedido);
    return await this.obtenerPedidoSeguro(idPedido, idCliente);
  }

  async presignComprobante(
    idPedido: number,
    idCliente: number,
    mimeType: string,
    extensionOriginal?: string,
    nombreOriginal?: string,
  ) {
    const pedido = await this.pedidoRepo.getPedidoById(idCliente, idPedido);
    if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);

    if (
      pedido.estado === 'PENDIENTE_PAGO' &&
      !pedido.comprobanteRuta &&
      !pedido.comprobanteUrl &&
      pedido.fechaLimitePago &&
      new Date(pedido.fechaLimitePago).getTime() < Date.now()
    ) {
      await this.pedidoRepo.expirarPedido(idCliente, idPedido);
      throw errorFuncional('Tu reserva expiró y los productos volvieron al inventario.', 409);
    }

    if (!this.stateMachine.puedeTransicionar('SUBIR_COMPROBANTE', pedido.estado)) {
      throw errorFuncional(`No se puede subir comprobante a un pedido en estado ${pedido.estado}.`, 409);
    }
    return await this.storage.generarPresignedUpload({
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
    const pedido = await this.pedidoRepo.getPedidoById(idCliente, idPedido);
    if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);

    if (
      pedido.estado === 'PENDIENTE_PAGO' &&
      !pedido.comprobanteRuta &&
      !pedido.comprobanteUrl &&
      pedido.fechaLimitePago &&
      new Date(pedido.fechaLimitePago).getTime() < Date.now()
    ) {
      await this.pedidoRepo.expirarPedido(idCliente, idPedido);
      throw errorFuncional('Tu reserva expiró y los productos volvieron al inventario.', 409);
    }

    this.stateMachine.validarTransicion('SUBIR_COMPROBANTE', pedido.estado);

    const anteriorRuta = pedido.comprobanteRuta || pedido.comprobanteUrl;
    const key = this.storage.extraerKey(keyOUrl) || keyOUrl;
    const mime = mimeType || 'image/jpeg';
    const baseFilename = key.includes('/') ? key.split('/').pop() : key;
    const nombreSeguro = this.storage.sanitizarNombre(nombreOriginal || baseFilename || 'comprobante.jpg');

    await this.pedidoRepo.updateComprobante(idCliente, idPedido, {
      comprobanteRuta: key,
      comprobanteUrl: key,
      comprobanteMime: mime,
      comprobanteNombre: nombreSeguro,
      fechaComprobante: new Date().toISOString(),
      estado: 'EN_REVISION',
    });

    if (anteriorRuta && anteriorRuta !== key) {
      void this.storage.eliminarArchivo(anteriorRuta, comprobantesUploadDir, '');
    }

    const folio = folioPedido(idPedido);
    void this.fcmService.enviarAEmpleados({
      titulo: 'Comprobante de Pago Subido',
      cuerpo: `El cliente subió comprobante para el pedido #${folio}. Requiere validación.`,
      data: { idPedido: String(idPedido), url: '/pedidos-admin' },
    });

    return await this.obtenerPedidoSeguro(idPedido, idCliente);
  }

  async rechazarPedidoAdmin(idPedido: number, idSuc: number, idEmp: number, motivoInput: string) {
    const motivo = texto(motivoInput);
    if (!idPedido) throw errorFuncional('El pedido no es válido.', 400);
    if (motivo.length < 3 || motivo.length > 255) {
      throw errorFuncional('El motivo debe tener entre 3 y 255 caracteres.', 400);
    }

    const pedidos = await this.pedidoRepo.listPedidosAdmin(idSuc);
    const pedido = pedidos.find((p: any) => p.idPedido === idPedido);
    if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);
    this.stateMachine.validarTransicion('RECHAZAR_PAGO', pedido.estado);

    const anteriorComprobante = pedido.comprobanteRuta || pedido.comprobanteUrl;
    await this.pedidoRepo.rechazarPedido(pedido.idCliente, idPedido, idEmp, motivo);

    if (anteriorComprobante) {
      void this.storage.eliminarArchivo(anteriorComprobante, comprobantesUploadDir, '');
    }

    const folio = folioPedido(idPedido);
    void this.fcmService.enviarACliente(pedido.idCliente, {
      titulo: 'Comprobante Rechazado',
      cuerpo: `Tu comprobante del pedido #${folio} fue rechazado: ${motivo}. Por favor sube uno nuevo.`,
      data: { idPedido: String(idPedido), url: '/mis-pedidos' },
    });

    return await this.obtenerPedidoAdmin(idPedido, idSuc);
  }

  async aprobarPedidoAdmin(idPedido: number, idSuc: number, idEmp: number) {
    if (!idPedido) throw errorFuncional('El pedido no es válido.', 400);

    const pedidos = await this.pedidoRepo.listPedidosAdmin(idSuc);
    const pedido = pedidos.find((p: any) => p.idPedido === idPedido);
    if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);
    if (pedido.estado === 'PAGADO') throw errorFuncional('El pedido ya fue aprobado.', 409);
    this.stateMachine.validarTransicion('APROBAR_PAGO', pedido.estado);

    await this.pedidoRepo.aprobarPedido(pedido.idCliente, idPedido, idEmp);

    const folio = folioPedido(idPedido);
    void this.fcmService.enviarACliente(pedido.idCliente, {
      titulo: '¡Pago Aprobado!',
      cuerpo: `Tu comprobante del pedido #${folio} ha sido aprobado. Lo estamos preparando.`,
      data: { idPedido: String(idPedido), url: '/mis-pedidos' },
    });

    return await this.obtenerPedidoAdmin(idPedido, idSuc);
  }

  async cambiarEstadoOperativo(idPedido: number, idSuc: number, _estadoActual: string, estadoNuevo: string) {
    if (!idPedido) throw errorFuncional('El pedido no es válido.', 400);

    const pedidos = await this.pedidoRepo.listPedidosAdmin(idSuc);
    const pedido = pedidos.find((p: any) => p.idPedido === idPedido);
    if (!pedido) throw errorFuncional('Pedido no encontrado.', 404);
    await this.pedidoRepo.updateEstado(pedido.idCliente, idPedido, estadoNuevo as any);

    if (estadoNuevo === 'LISTO') {
      const folio = folioPedido(idPedido);
      void this.fcmService.enviarACliente(pedido.idCliente, {
        titulo: '¡Tu Pedido está LISTO!',
        cuerpo: `Tu pedido #${folio} ya está listo para recoger en la tienda.`,
        data: { idPedido: String(idPedido), url: '/mis-pedidos' },
      });
    }

    return await this.obtenerPedidoAdmin(idPedido, idSuc);
  }

  async listarPedidosCliente(idCliente: number) {
    const rows = await this.pedidoRepo.listPedidosCliente(idCliente);
    return rows.map((r: any) => ({
      id: encodeId(r.idPedido),
      folio: folioPedido(r.idPedido),
      uuidPedido: `pedido-${r.idPedido}`,
      fechaPedido: r.fechaCreacion,
      fechaLimitePago: r.fechaLimitePago || r.fechaCreacion,
      estado: r.estado,
      total: Number(r.totalPedido),
      tieneComprobante: Boolean(r.comprobanteUrl),
      fechaComprobante: r.fechaCreacion,
      motivoRechazo: null,
      idVenta: r.idVenta ? encodeId(r.idVenta) : null,
      fechaRevision: null,
    }));
  }

  async listarPedidosAdmin(idSuc: number) {
    const rows = await this.pedidoRepo.listPedidosAdmin(idSuc);
    const clienteIds = [...new Set<number>(rows.map((r: any) => Number(r.idCliente)).filter(Boolean))];
    const clientesMap = new Map<number, any>();
    await Promise.all(
      clienteIds.map(async (id: number) => {
        try {
          const c = await this.authRepo.findClienteById(id);
          if (c) clientesMap.set(id, c);
        } catch {}
      }),
    );

    return rows.map((r: any) => {
      const cli = clientesMap.get(r.idCliente);
      const nombreCli = cli
        ? [cli.nombreCliente, cli.apellidoPatCliente, cli.apellidoMatCliente].filter(Boolean).join(' ')
        : r.clienteNombre || 'Cliente';
      const correoCli = cli?.correoCliente || r.clienteCorreo || '';
      const fotoCli = cli?.fotoPerfil || null;

      return {
        id: encodeId(r.idPedido),
        folio: folioPedido(r.idPedido),
        uuidPedido: `pedido-${r.idPedido}`,
        fechaPedido: r.fechaCreacion,
        fechaLimitePago: r.fechaLimitePago || r.fechaCreacion,
        estado: r.estado,
        total: Number(r.totalPedido),
        tieneComprobante: Boolean(r.comprobanteUrl),
        fechaComprobante: r.fechaCreacion,
        motivoRechazo: null,
        idVenta: r.idVenta ? encodeId(r.idVenta) : null,
        fechaRevision: null,
        cliente: {
          id: encodeId(r.idCliente),
          nombre: nombreCli,
          correo: correoCli,
          foto: fotoCli,
        },
      };
    });
  }
}

export const pedidosService = new PedidosService();
