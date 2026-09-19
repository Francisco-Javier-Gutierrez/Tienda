import { GetCommand, PutCommand, QueryCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamo.client';
import { getNextSequence, Keys } from '../dynamo.keys';
import { errorFuncional } from '../../utils/formatters';
import { idempotencyRepository } from './idempotency.repository';

export interface DetallePedidoItem {
  idPro: number;
  nombrePro: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  imagenPro?: string | null;
}

export interface PedidoClienteEntity {
  idPedido: number;
  uuidPedido?: string;
  idCliente: number;
  idSuc: number;
  clienteNombre?: string;
  clienteCorreo?: string;
  clienteTelefono?: string;
  totalPedido: number;
  estado: string;
  metodoPago: string;
  comprobanteUrl?: string | null;
  comprobanteRuta?: string | null;
  comprobanteNombre?: string | null;
  comprobanteMime?: string | null;
  fechaComprobante?: string | null;
  fechaLimitePago?: string | null;
  motivoRechazo?: string | null;
  fechaCreacion: string;
  fechaActualizacion?: string;
  fechaRevision?: string | null;
  idEmpRevisa?: number | null;
  idVenta?: number | null;
  detalles: DetallePedidoItem[];
}

export class PedidoRepository {
  async getPedidoByUuid(uuidPedido: string, idCliente?: number): Promise<PedidoClienteEntity | null> {
    const record = await idempotencyRepository.getRecord(uuidPedido, 'PEDIDO');
    if (!record) return null;
    return this.getPedidoById(record.idCliente || idCliente || 0, record.targetId);
  }

  async createPedido(data: {
    idCliente: number;
    idSuc: number;
    uuidPedido?: string;
    clienteNombre?: string;
    clienteCorreo?: string;
    clienteTelefono?: string;
    totalPedido: number;
    metodoPago?: string;
    fechaLimitePago?: string;
    comprobanteUrl?: string;
    items: Array<{ idPro: number; cantidad: number; precioUnitario: number; nombrePro?: string; imagenPro?: string }>;
  }): Promise<PedidoClienteEntity> {
    if (data.uuidPedido) {
      const existente = await this.getPedidoByUuid(data.uuidPedido, data.idCliente);
      if (existente) {
        return existente;
      }
    }

    const idPedido = await getNextSequence('pedidoCliente', 1);
    const now = new Date().toISOString();

    const detalles: DetallePedidoItem[] = data.items.map((i) => ({
      idPro: i.idPro,
      nombrePro: i.nombrePro || `Producto #${i.idPro}`,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      subtotal: Number((i.cantidad * i.precioUnitario).toFixed(2)),
      imagenPro: i.imagenPro || null,
    }));

    const pedido: PedidoClienteEntity = {
      idPedido,
      uuidPedido: data.uuidPedido,
      idCliente: data.idCliente,
      idSuc: data.idSuc,
      clienteNombre: data.clienteNombre,
      clienteCorreo: data.clienteCorreo,
      clienteTelefono: data.clienteTelefono,
      totalPedido: data.totalPedido,
      estado: 'PENDIENTE_PAGO',
      metodoPago: data.metodoPago || 'TRANSFERENCIA',
      fechaLimitePago: data.fechaLimitePago || null,
      comprobanteUrl: data.comprobanteUrl || null,
      fechaCreacion: now,
      detalles,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.pedidoCliente(data.idCliente, idPedido),
            GSI1PK: `SUC#${data.idSuc}#PEDIDOS`,
            GSI1SK: `${pedido.estado}#${now}`,
            ...pedido,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      ...data.items.map((item) => ({
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.producto(data.idSuc, item.idPro),
          UpdateExpression: 'ADD existenciaPro :negCant',
          ConditionExpression: 'attribute_exists(PK) AND existenciaPro >= :cant',
          ExpressionAttributeValues: {
            ':negCant': -item.cantidad,
            ':cant': item.cantidad,
          },
        },
      })),
    ];

    if (data.uuidPedido) {
      transactItems.push(
        idempotencyRepository.buildTransactItem(data.uuidPedido, 'PEDIDO', idPedido, {
          idSuc: data.idSuc,
          idCliente: data.idCliente,
        }),
      );
    }

    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
      return pedido;
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        if (data.uuidPedido) {
          const existenteConcurrente = await this.getPedidoByUuid(data.uuidPedido, data.idCliente);
          if (existenteConcurrente) {
            return existenteConcurrente;
          }
        }
        throw errorFuncional('No se pudo procesar el pedido. Puede que el stock de algún producto se haya agotado o sea insuficiente.', 400);
      }
      throw error;
    }
  }

  async listPedidosCliente(idCliente: number): Promise<PedidoClienteEntity[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `CLI#${idCliente}`,
          ':skPrefix': 'PEDIDO#',
        },
        ScanIndexForward: false,
        ConsistentRead: true,
      }),
    );
    return (res.Items || []) as PedidoClienteEntity[];
  }

  async listPedidosAdmin(idSuc = 1): Promise<PedidoClienteEntity[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :sucKey',
        ExpressionAttributeValues: {
          ':sucKey': `SUC#${idSuc}#PEDIDOS`,
        },
        ScanIndexForward: false,
      }),
    );
    return (res.Items || []) as PedidoClienteEntity[];
  }

  async getPedidoById(idCliente: number, idPedido: number): Promise<PedidoClienteEntity | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: Keys.pedidoCliente(idCliente, idPedido),
        ConsistentRead: true,
      }),
    );
    return (res.Item as PedidoClienteEntity) || null;
  }

  async updateEstado(
    idCliente: number,
    idPedido: number,
    nuevoEstado: 'PENDIENTE' | 'PAGADO' | 'ENVIADO' | 'ENTREGADO' | 'CANCELADO',
  ): Promise<PedidoClienteEntity | null> {
    const existing = await this.getPedidoById(idCliente, idPedido);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: PedidoClienteEntity = {
      ...existing,
      estado: nuevoEstado,
      fechaActualizacion: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.pedidoCliente(idCliente, idPedido),
          GSI1PK: `SUC#${existing.idSuc}#PEDIDOS`,
          GSI1SK: `${nuevoEstado}#${existing.fechaCreacion}`,
          ...updated,
        },
      }),
    );

    return updated;
  }

  async updateComprobante(
    idCliente: number,
    idPedido: number,
    data: {
      comprobanteRuta: string;
      comprobanteUrl?: string;
      comprobanteMime: string;
      comprobanteNombre: string;
      fechaComprobante: string;
      estado: string;
    },
  ): Promise<PedidoClienteEntity | null> {
    const existing = await this.getPedidoById(idCliente, idPedido);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: PedidoClienteEntity = {
      ...existing,
      comprobanteRuta: data.comprobanteRuta,
      comprobanteUrl: data.comprobanteUrl || data.comprobanteRuta,
      comprobanteMime: data.comprobanteMime,
      comprobanteNombre: data.comprobanteNombre,
      fechaComprobante: data.fechaComprobante,
      estado: data.estado,
      motivoRechazo: null,
      fechaActualizacion: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.pedidoCliente(idCliente, idPedido),
          GSI1PK: `SUC#${existing.idSuc}#PEDIDOS`,
          GSI1SK: `${data.estado}#${existing.fechaCreacion}`,
          ...updated,
        },
      }),
    );

    return updated;
  }

  async cancelarPedido(idCliente: number, idPedido: number): Promise<PedidoClienteEntity | null> {
    const existing = await this.getPedidoById(idCliente, idPedido);
    if (!existing) return null;
    if (existing.estado === 'CANCELADO') return existing;

    const now = new Date().toISOString();
    const updated: PedidoClienteEntity = {
      ...existing,
      estado: 'CANCELADO',
      fechaActualizacion: now,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.pedidoCliente(idCliente, idPedido),
            GSI1PK: `SUC#${existing.idSuc}#PEDIDOS`,
            GSI1SK: `CANCELADO#${existing.fechaCreacion}`,
            ...updated,
          },
          ConditionExpression: 'attribute_exists(PK) AND (estado = :pendiente OR estado = :revision)',
          ExpressionAttributeValues: {
            ':pendiente': 'PENDIENTE_PAGO',
            ':revision': 'REVISION_COMPROBANTE',
          },
        },
      },
      ...existing.detalles.map((item) => ({
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.producto(existing.idSuc, item.idPro),
          UpdateExpression: 'ADD existenciaPro :cant',
          ExpressionAttributeValues: {
            ':cant': item.cantidad,
          },
        },
      })),
    ];

    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        const refreshed = await this.getPedidoById(idCliente, idPedido);
        if (refreshed && refreshed.estado === 'CANCELADO') {
          return refreshed;
        }
        throw errorFuncional('El pedido ya no se encuentra en un estado cancelable.', 409);
      }
      throw error;
    }
    return updated;
  }

  async rechazarPedido(
    idCliente: number,
    idPedido: number,
    idEmp: number,
    motivo: string,
  ): Promise<PedidoClienteEntity | null> {
    const existing = await this.getPedidoById(idCliente, idPedido);
    if (!existing) return null;
    if (existing.estado === 'RECHAZADO') return existing;

    const now = new Date().toISOString();
    const updated: PedidoClienteEntity = {
      ...existing,
      estado: 'RECHAZADO',
      idEmpRevisa: idEmp,
      fechaRevision: now,
      motivoRechazo: motivo,
      comprobanteRuta: null,
      comprobanteUrl: null,
      comprobanteMime: null,
      comprobanteNombre: null,
      fechaComprobante: null,
      fechaActualizacion: now,
    };

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            ...Keys.pedidoCliente(idCliente, idPedido),
            GSI1PK: `SUC#${existing.idSuc}#PEDIDOS`,
            GSI1SK: `RECHAZADO#${existing.fechaCreacion}`,
            ...updated,
          },
          ConditionExpression: 'attribute_exists(PK) AND (estado = :revision OR estado = :pendiente)',
          ExpressionAttributeValues: {
            ':revision': 'REVISION_COMPROBANTE',
            ':pendiente': 'PENDIENTE_PAGO',
          },
        }),
      );
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        const refreshed = await this.getPedidoById(idCliente, idPedido);
        if (refreshed && refreshed.estado === 'RECHAZADO') {
          return refreshed;
        }
        throw errorFuncional('El pedido ya fue procesado y no puede ser rechazado.', 409);
      }
      throw error;
    }

    return updated;
  }

  async aprobarPedido(
    idCliente: number,
    idPedido: number,
    idEmp: number,
    idVentaInput?: number,
  ): Promise<PedidoClienteEntity | null> {
    const existing = await this.getPedidoById(idCliente, idPedido);
    if (!existing) return null;
    if (existing.estado === 'PAGADO') return existing;

    const idVenta = idVentaInput || existing.idVenta || (await getNextSequence('venta', 1));
    const now = new Date().toISOString();
    const updated: PedidoClienteEntity = {
      ...existing,
      estado: 'PAGADO',
      idEmpRevisa: idEmp,
      fechaRevision: now,
      motivoRechazo: null,
      idVenta,
      fechaActualizacion: now,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.pedidoCliente(idCliente, idPedido),
            GSI1PK: `SUC#${existing.idSuc}#PEDIDOS`,
            GSI1SK: `PAGADO#${existing.fechaCreacion}`,
            ...updated,
          },
          ConditionExpression: 'attribute_exists(PK) AND (estado = :revision OR estado = :pendiente)',
          ExpressionAttributeValues: {
            ':revision': 'REVISION_COMPROBANTE',
            ':pendiente': 'PENDIENTE_PAGO',
          },
        },
      },
    ];

    if (idVenta) {
      transactItems.push({
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.venta(existing.idSuc, idVenta),
            GSI1PK: `SESION#0#VENTAS`,
            GSI1SK: now,
            idVenta,
            idSuc: existing.idSuc,
            idEmp,
            idSesionCaja: 0,
            idPedido: existing.idPedido,
            totalVenta: existing.totalPedido,
            pagoCon: existing.totalPedido,
            cambio: 0,
            metodoPago: 'TRANSFERENCIA',
            estadoVenta: 'COMPLETADA',
            origen: 'ONLINE',
            fechaVenta: now,
            detalles: existing.detalles.map((d) => ({
              idPro: d.idPro,
              nombrePro: d.nombrePro,
              cantidad: d.cantidad,
              precioUnitario: d.precioUnitario,
              subtotal: d.subtotal,
            })),
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      });
    }

    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        const refreshed = await this.getPedidoById(idCliente, idPedido);
        if (refreshed && refreshed.estado === 'PAGADO') {
          return refreshed;
        }
        throw errorFuncional('El pedido ya fue procesado o no se encuentra pendiente de aprobación.', 409);
      }
      throw error;
    }

    return updated;
  }

  async expirarPedido(idCliente: number, idPedido: number): Promise<PedidoClienteEntity | null> {
    const existing = await this.getPedidoById(idCliente, idPedido);
    if (!existing) return null;
    if (existing.estado !== 'PENDIENTE_PAGO') return existing;

    const now = new Date().toISOString();
    const updated: PedidoClienteEntity = {
      ...existing,
      estado: 'EXPIRADO',
      fechaActualizacion: now,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.pedidoCliente(idCliente, idPedido),
            GSI1PK: `SUC#${existing.idSuc}#PEDIDOS`,
            GSI1SK: `EXPIRADO#${existing.fechaCreacion}`,
            ...updated,
          },
          ConditionExpression: 'attribute_exists(PK) AND estado = :pendiente',
          ExpressionAttributeValues: {
            ':pendiente': 'PENDIENTE_PAGO',
          },
        },
      },
      ...existing.detalles.map((item) => ({
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.producto(existing.idSuc, item.idPro),
          UpdateExpression: 'ADD existenciaPro :cant',
          ExpressionAttributeValues: {
            ':cant': item.cantidad,
          },
        },
      })),
    ];

    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        return await this.getPedidoById(idCliente, idPedido);
      }
      throw error;
    }
    return updated;
  }
}

export const pedidoRepository = new PedidoRepository();
