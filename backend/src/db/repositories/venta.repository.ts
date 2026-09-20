import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamo.client';
import { getNextSequence, Keys } from '../dynamo.keys';
import { errorFuncional, encodeId } from '../../utils/formatters';
import { idempotencyRepository } from './idempotency.repository';

export interface DetalleVentaItem {
  idPro: number;
  nombrePro: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  costoUnitario?: number;
  ganancia?: number;
  margenPorcentaje?: number;
}

export interface VentaEntity {
  idVenta: number;
  uuidVenta?: string;
  idSuc: number;
  idEmp: number;
  idSesionCaja: number;
  totalVenta: number;
  costoTotal?: number;
  ganancia?: number;
  margenPorcentaje?: number;
  nota?: string | null;
  montoNota?: number | null;
  pagoCon?: number;
  cambio?: number;
  metodoPago: string;
  idCliente?: number | null;
  clienteNombre?: string | null;
  fechaVenta: string;
  detalles: DetalleVentaItem[];
  estadoVenta?: string;
  origen?: string;
  fechaCancelacion?: string;
  motivoCancelacion?: string;
  idEmpCancela?: number;
}

export class VentaRepository {
  async getVentaByUuid(uuidVenta: string, idSuc = 1): Promise<VentaEntity | null> {
    const record = await idempotencyRepository.getRecord(uuidVenta, 'VENTA');
    if (!record) return null;
    return this.getVentaById(record.targetId, record.idSuc || idSuc);
  }

  async createVenta(data: {
    idSuc: number;
    idEmp: number;
    idSesionCaja: number;
    idCliente?: number | null;
    clienteNombre?: string | null;
    totalVenta: number;
    costoTotal?: number;
    ganancia?: number;
    margenPorcentaje?: number;
    nota?: string | null;
    montoNota?: number | null;
    pagoCon?: number;
    cambio?: number;
    metodoPago?: string;
    uuidVenta?: string;
    items: Array<{
      idPro: number;
      cantidad: number;
      precioUnitario: number;
      costoUnitario?: number;
      nombrePro?: string;
    }>;
  }): Promise<VentaEntity> {
    // Si se proporciona uuidVenta, verificar primero si ya existe (idempotencia rápida)
    if (data.uuidVenta) {
      const existente = await this.getVentaByUuid(data.uuidVenta, data.idSuc);
      if (existente) {
        return existente;
      }
    }

    const idVenta = await getNextSequence('venta', 1);
    const now = new Date().toISOString();

    const detalles: DetalleVentaItem[] = data.items.map((i) => {
      const costoUnitario = Number(i.costoUnitario || 0);
      const subtotal = Number((i.cantidad * i.precioUnitario).toFixed(2));
      const subtotalCosto = Number((i.cantidad * costoUnitario).toFixed(2));
      const ganancia = Number((subtotal - subtotalCosto).toFixed(2));
      const margenPorcentaje = subtotal > 0 ? Number(((ganancia / subtotal) * 100).toFixed(1)) : 0;
      return {
        idPro: i.idPro,
        nombrePro: i.nombrePro || `Producto #${i.idPro}`,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        subtotal,
        costoUnitario,
        ganancia,
        margenPorcentaje,
      };
    });

    if (data.montoNota && Number(data.montoNota) > 0) {
      const montoExtra = Number(Number(data.montoNota).toFixed(2));
      detalles.push({
        idPro: 0,
        nombrePro: data.nota ? `Extra: ${data.nota}` : 'Artículo adicional sin código',
        cantidad: 1,
        precioUnitario: montoExtra,
        subtotal: montoExtra,
        costoUnitario: 0,
        ganancia: montoExtra,
        margenPorcentaje: 100,
      });
    }

    const ventaItem: VentaEntity = {
      idVenta,
      uuidVenta: data.uuidVenta,
      idSuc: data.idSuc,
      idEmp: data.idEmp,
      idSesionCaja: data.idSesionCaja,
      totalVenta: data.totalVenta,
      costoTotal: data.costoTotal,
      ganancia: data.ganancia,
      margenPorcentaje: data.margenPorcentaje,
      nota: data.nota || null,
      montoNota: data.montoNota ? Number(data.montoNota) : null,
      pagoCon: data.pagoCon,
      cambio: data.cambio,
      metodoPago: data.metodoPago || 'EFECTIVO',
      idCliente: data.idCliente || null,
      clienteNombre: data.clienteNombre || null,
      estadoVenta: 'COMPLETADA',
      origen: 'POS',
      fechaVenta: now,
      detalles,
    };

    const totalVenta = Number(Number(data.totalVenta || 0).toFixed(2));
    const metodoPago = (data.metodoPago || 'EFECTIVO').toUpperCase();

    let updateCajaExpr = 'ADD totalVentas :monto, numeroVentas :uno';
    const exprCajaValues: any = {
      ':monto': totalVenta,
      ':uno': 1,
    };

    if (metodoPago === 'EFECTIVO') {
      updateCajaExpr += ', totalEfectivo :montoEf';
      exprCajaValues[':montoEf'] = totalVenta;
    } else if (metodoPago === 'TARJETA') {
      updateCajaExpr += ', totalTarjeta :montoTar';
      exprCajaValues[':montoTar'] = totalVenta;
    } else if (metodoPago === 'TRANSFERENCIA') {
      updateCajaExpr += ', totalTransferencia :montoTrans';
      exprCajaValues[':montoTrans'] = totalVenta;
    }

    // Construir Transacción Atómica
    const transactItems: any[] = [
      // 1. Insertar registro de venta
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.venta(data.idSuc, idVenta),
            GSI1PK: `SESION#${data.idSesionCaja}#VENTAS`,
            GSI1SK: now,
            ...ventaItem,
            totalVenta,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      // 2. Incrementar totales de la sesión de caja atómicamente
      {
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.sesionCaja(data.idSuc, data.idSesionCaja),
          UpdateExpression: updateCajaExpr,
          ExpressionAttributeValues: exprCajaValues,
        },
      },
      // 3. Decrementar existencias de cada producto
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

    // Si la venta fue a crédito (FIADO), registrar cargo en la cuenta del cliente
    if (metodoPago === 'FIADO' && data.idCliente) {
      const idMov = await getNextSequence('movimientoCuenta', 1);
      transactItems.push(
        {
          Update: {
            TableName: TABLE_NAME,
            Key: Keys.cliente(data.idCliente),
            UpdateExpression: 'SET saldoDeudor = if_not_exists(saldoDeudor, :cero) + :monto, ultimoCargo = :ahora',
            ExpressionAttributeValues: {
              ':monto': totalVenta,
              ':cero': 0,
              ':ahora': now,
            },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...Keys.movimientoCuenta(data.idCliente, idMov),
              GSI1PK: `SUC#${data.idSuc}#FIADOS`,
              GSI1SK: `${now}#MOV#${idMov}`,
              idMov,
              idCliente: data.idCliente,
              clienteNombre: data.clienteNombre || 'Cliente',
              idSuc: data.idSuc,
              idEmp: data.idEmp,
              tipo: 'CARGO',
              monto: totalVenta,
              idVenta,
              concepto: `Compra a crédito - Folio #${idVenta}`,
              fechaHora: now,
              fecha: now.slice(0, 10),
              createdAt: now,
            },
          },
        },
      );
    }

    // 4. Bloqueo de idempotencia atómico
    if (data.uuidVenta) {
      transactItems.push(
        idempotencyRepository.buildTransactItem(data.uuidVenta, 'VENTA', idVenta, {
          idSuc: data.idSuc,
          idEmp: data.idEmp,
        }),
      );
    }

    try {
      await docClient.send(
        new TransactWriteCommand({
          TransactItems: transactItems,
        }),
      );
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        // Si falló por colisión concurrente de idempotencia, recuperar la venta creada por la otra petición
        if (data.uuidVenta) {
          const existenteConcurrente = await this.getVentaByUuid(data.uuidVenta, data.idSuc);
          if (existenteConcurrente) {
            return existenteConcurrente;
          }
        }
        throw errorFuncional(
          'No se pudo procesar la venta. Verifique que haya existencias suficientes de todos los productos.',
          400,
        );
      }
      throw error;
    }

    return ventaItem;
  }

  async listVentas(idSuc = 1, options?: { idSesionCaja?: number }): Promise<VentaEntity[]> {
    if (options?.idSesionCaja) {
      const res = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :sesionKey',
          ExpressionAttributeValues: {
            ':sesionKey': `SESION#${options.idSesionCaja}#VENTAS`,
          },
          ScanIndexForward: false,
        }),
      );
      return (res.Items || []) as VentaEntity[];
    }

    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `SUC#${idSuc}`,
          ':skPrefix': 'VENTA#',
        },
        ScanIndexForward: false,
        ConsistentRead: true,
      }),
    );
    return (res.Items || []) as VentaEntity[];
  }

  async getVentaById(idVenta: number, idSuc = 1): Promise<VentaEntity | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: Keys.venta(idSuc, idVenta),
        ConsistentRead: true,
      }),
    );
    return (res.Item as VentaEntity) || null;
  }

  async cancelarVenta(idVenta: number, idEmp: number, idSuc = 1, motivo: string): Promise<any> {
    const venta = await this.getVentaById(idVenta, idSuc);
    if (!venta) {
      throw errorFuncional('Venta no encontrada', 404);
    }
    if ((venta as any).estadoVenta === 'CANCELADA') {
      throw errorFuncional('La venta ya fue cancelada.', 409);
    }
    if ((venta as any).estadoVenta && (venta as any).estadoVenta !== 'COMPLETADA') {
      throw errorFuncional('La venta no se encuentra en un estado cancelable.', 409);
    }
    if (!venta.detalles || !venta.detalles.length) {
      throw errorFuncional('La venta no contiene detalles para restaurar.', 409);
    }

    const ahora = new Date().toISOString();
    const transactItems: any[] = [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.venta(idSuc, idVenta),
          UpdateExpression:
            'SET estadoVenta = :cancelada, fechaCancelacion = :ahora, motivoCancelacion = :motivo, idEmpCancela = :idEmp',
          ConditionExpression:
            'attribute_exists(PK) AND (attribute_not_exists(estadoVenta) OR estadoVenta = :completada)',
          ExpressionAttributeValues: {
            ':cancelada': 'CANCELADA',
            ':ahora': ahora,
            ':motivo': motivo,
            ':idEmp': idEmp,
            ':completada': 'COMPLETADA',
          },
        },
      },
      ...venta.detalles.map((item) => ({
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.producto(idSuc, item.idPro),
          UpdateExpression: 'ADD existenciaPro :cant',
          ExpressionAttributeValues: {
            ':cant': item.cantidad,
          },
        },
      })),
    ];

    if (venta.idSesionCaja && venta.totalVenta) {
      const totalVentaNeg = -Number(Number(venta.totalVenta || 0).toFixed(2));
      const metodo = (venta.metodoPago || 'EFECTIVO').toUpperCase();

      let updateCancelExpr = 'ADD totalVentas :negTotal, numeroVentas :negUno';
      const cancelValues: any = {
        ':negTotal': totalVentaNeg,
        ':negUno': -1,
      };

      if (metodo === 'EFECTIVO') {
        updateCancelExpr += ', totalEfectivo :negEf';
        cancelValues[':negEf'] = totalVentaNeg;
      } else if (metodo === 'TARJETA') {
        updateCancelExpr += ', totalTarjeta :negTar';
        cancelValues[':negTar'] = totalVentaNeg;
      } else if (metodo === 'TRANSFERENCIA') {
        updateCancelExpr += ', totalTransferencia :negTrans';
        cancelValues[':negTrans'] = totalVentaNeg;
      }

      transactItems.push({
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.sesionCaja(idSuc, venta.idSesionCaja),
          UpdateExpression: updateCancelExpr,
          ExpressionAttributeValues: cancelValues,
        },
      });
    }

    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        throw errorFuncional('La venta ya fue cancelada previamente o no se encuentra en estado cancelable.', 409);
      }
      throw error;
    }

    return {
      id: encodeId(idVenta),
      estado: 'CANCELADA',
      fechaCancelacion: ahora,
      motivoCancelacion: motivo,
      cajeroCancelaId: encodeId(idEmp),
    };
  }
}

export const ventaRepository = new VentaRepository();
