import { TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, docClient } from '../dynamo.client';
import { getNextSequence, Keys } from '../dynamo.keys';
import { BaseDynamoRepository } from '../base.repository';
import { idempotencyRepository } from './idempotency.repository';
import { errorFuncional } from '../../utils/formatters';

export interface MovimientoCuentaEntity {
  idMov: number;
  uuidMov?: string | null;
  idCliente: number;
  clienteNombre: string;
  clienteTelefono?: string | null;
  idSuc: number;
  idEmp: number;
  empleadoNombre: string;
  tipo: 'CARGO' | 'ABONO';
  monto: number;
  saldoAnterior: number;
  saldoNuevo: number;
  idVenta?: number | null;
  idSesionCaja?: number | null;
  concepto: string;
  metodoPago?: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
  fechaHora: string;
  fecha: string;
  createdAt: string;
}

export interface IFiadoRepository {
  listClientesDeudores(idSuc?: number): Promise<any[]>;
  getClienteById(idCliente: number): Promise<any | null>;
  getHistorialCuenta(idCliente: number): Promise<MovimientoCuentaEntity[]>;
  registrarAbono(data: {
    uuidAbono?: string | null;
    idCliente: number;
    idSuc: number;
    idEmp: number;
    empleadoNombre: string;
    monto: number;
    metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
    concepto?: string | null;
    idSesionCaja?: number | null;
  }): Promise<MovimientoCuentaEntity>;
  registrarCargo(data: {
    idCliente: number;
    idSuc: number;
    idEmp: number;
    empleadoNombre: string;
    monto: number;
    idVenta: number;
    concepto?: string | null;
  }): Promise<MovimientoCuentaEntity>;
  crearClienteRapido(data: {
    nombreCliente: string;
    apellidoPatCliente?: string;
    telefono: string;
    limiteCredito?: number | null;
  }): Promise<any>;
}

export class FiadoRepository extends BaseDynamoRepository<any> implements IFiadoRepository {
  async listClientesDeudores(_idSuc = 1): Promise<any[]> {
    const clientes = await this.queryItems('GSI1PK = :pk', { ':pk': 'CLIENTES' }, { indexName: 'GSI1' });

    return (clientes || []).sort((a, b) => {
      const saldoA = Number(a.saldoDeudor || 0);
      const saldoB = Number(b.saldoDeudor || 0);
      if (saldoB !== saldoA) {
        return saldoB - saldoA;
      }
      const nombreA = `${a.nombreCliente || ''} ${a.apellidoPatCliente || ''}`.trim();
      const nombreB = `${b.nombreCliente || ''} ${b.apellidoPatCliente || ''}`.trim();
      return nombreA.localeCompare(nombreB);
    });
  }

  async getClienteById(idCliente: number): Promise<any | null> {
    return this.getByKey(Keys.cliente(idCliente), true);
  }

  async getHistorialCuenta(idCliente: number): Promise<MovimientoCuentaEntity[]> {
    return this.queryItems(
      'PK = :pk AND begins_with(SK, :skPrefix)',
      {
        ':pk': `CLI#${idCliente}`,
        ':skPrefix': 'MOV_CUENTA#',
      },
      { scanIndexForward: false, consistentRead: true },
    );
  }

  async registrarAbono(data: {
    uuidAbono?: string | null;
    idCliente: number;
    idSuc: number;
    idEmp: number;
    empleadoNombre: string;
    monto: number;
    metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
    concepto?: string | null;
    idSesionCaja?: number | null;
  }): Promise<MovimientoCuentaEntity> {
    if (data.uuidAbono) {
      const record = await idempotencyRepository.getRecord(data.uuidAbono, 'ABONO');
      if (record) {
        const item = await this.getByKey(Keys.movimientoCuenta(data.idCliente, record.targetId));
        if (item) return item;
      }
    }

    const cliente = await this.getClienteById(data.idCliente);
    if (!cliente) {
      throw errorFuncional('Cliente no encontrado', 404);
    }

    const saldoAnterior = Number(cliente.saldoDeudor || 0);
    const monto = Number(data.monto);
    const saldoNuevo = Math.max(0, Math.round((saldoAnterior - monto) * 100) / 100);

    const idMov = await getNextSequence('movimientoCuenta', 1);
    const now = new Date().toISOString();
    const fecha = now.slice(0, 10);
    const nombreCliente = [cliente.nombreCliente, cliente.apellidoPatCliente].filter(Boolean).join(' ');
    const concepto = data.concepto?.trim() || `Abono a cuenta de fiado - ${data.metodoPago}`;

    const movItem: MovimientoCuentaEntity = {
      idMov,
      uuidMov: data.uuidAbono || null,
      idCliente: data.idCliente,
      clienteNombre: nombreCliente,
      clienteTelefono: cliente.telefono || null,
      idSuc: data.idSuc,
      idEmp: data.idEmp,
      empleadoNombre: data.empleadoNombre,
      tipo: 'ABONO',
      monto,
      saldoAnterior,
      saldoNuevo,
      idSesionCaja: data.idSesionCaja || null,
      concepto,
      metodoPago: data.metodoPago,
      fechaHora: now,
      fecha,
      createdAt: now,
    };

    const transactItems: any[] = [
      // 1. Actualizar saldo del cliente
      {
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.cliente(data.idCliente),
          UpdateExpression: 'SET saldoDeudor = :nuevo, ultimoAbono = :ahora',
          ExpressionAttributeValues: {
            ':nuevo': saldoNuevo,
            ':ahora': now,
          },
        },
      },
      // 2. Registrar movimiento de cuenta
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.movimientoCuenta(data.idCliente, idMov),
            GSI1PK: `SUC#${data.idSuc}#FIADOS`,
            GSI1SK: `${now}#MOV#${idMov}`,
            ...movItem,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ];

    // 3. Si hay sesión de caja activa y el pago fue en efectivo, abonar físicamente al cajón de caja
    if (data.idSesionCaja && data.metodoPago === 'EFECTIVO') {
      const idMovCaja = await getNextSequence('movimientoCaja', 1);
      transactItems.push(
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              ...Keys.movimientoCaja(data.idSuc, idMovCaja),
              GSI1PK: `SESION#${data.idSesionCaja}#MOVIMIENTOS`,
              GSI1SK: now,
              idMovimientoCaja: idMovCaja,
              idSuc: data.idSuc,
              idEmp: data.idEmp,
              idSesionCaja: data.idSesionCaja,
              tipoMovimiento: 'INGRESO',
              monto,
              concepto: `Abono de fiado - ${nombreCliente}`,
              fechaHora: now,
            },
          },
        },
        {
          Update: {
            TableName: TABLE_NAME,
            Key: Keys.sesionCaja(data.idSuc, data.idSesionCaja),
            UpdateExpression: 'ADD totalIngresos :monto, totalEfectivo :monto',
            ExpressionAttributeValues: {
              ':monto': monto,
            },
          },
        },
      );
    }

    // 4. Idempotencia
    if (data.uuidAbono) {
      transactItems.push(
        idempotencyRepository.buildTransactItem(data.uuidAbono, 'ABONO', idMov, {
          idSuc: data.idSuc,
          idEmp: data.idEmp,
          idCliente: data.idCliente,
        }),
      );
    }

    await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    return movItem;
  }

  async registrarCargo(data: {
    idCliente: number;
    idSuc: number;
    idEmp: number;
    empleadoNombre: string;
    monto: number;
    idVenta: number;
    concepto?: string | null;
  }): Promise<MovimientoCuentaEntity> {
    const cliente = await this.getClienteById(data.idCliente);
    if (!cliente) {
      throw errorFuncional('Cliente para cargo no encontrado', 404);
    }

    const saldoAnterior = Number(cliente.saldoDeudor || 0);
    const monto = Number(data.monto);
    const saldoNuevo = Math.round((saldoAnterior + monto) * 100) / 100;

    const idMov = await getNextSequence('movimientoCuenta', 1);
    const now = new Date().toISOString();
    const fecha = now.slice(0, 10);
    const nombreCliente = [cliente.nombreCliente, cliente.apellidoPatCliente].filter(Boolean).join(' ');

    const movItem: MovimientoCuentaEntity = {
      idMov,
      idCliente: data.idCliente,
      clienteNombre: nombreCliente,
      clienteTelefono: cliente.telefono || null,
      idSuc: data.idSuc,
      idEmp: data.idEmp,
      empleadoNombre: data.empleadoNombre,
      tipo: 'CARGO',
      monto,
      saldoAnterior,
      saldoNuevo,
      idVenta: data.idVenta,
      concepto: data.concepto || `Compra a crédito - Folio #${data.idVenta}`,
      fechaHora: now,
      fecha,
      createdAt: now,
    };

    const transactItems: any[] = [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.cliente(data.idCliente),
          UpdateExpression: 'SET saldoDeudor = :nuevo, ultimoCargo = :ahora',
          ExpressionAttributeValues: {
            ':nuevo': saldoNuevo,
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
            ...movItem,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ];

    await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    return movItem;
  }

  async crearClienteRapido(data: {
    nombreCliente: string;
    apellidoPatCliente?: string;
    telefono: string;
    limiteCredito?: number | null;
  }): Promise<any> {
    const idCliente = await getNextSequence('cliente', 4);
    const now = new Date().toISOString();
    const telLimpio = data.telefono.replace(/[^0-9]/g, '');

    const item: any = {
      idCliente,
      nombreCliente: data.nombreCliente.trim(),
      apellidoPatCliente: data.apellidoPatCliente?.trim() || '',
      correoCliente: `vecino_${idCliente}@tienda.local`,
      telefono: telLimpio,
      saldoDeudor: 0,
      limiteCredito: data.limiteCredito ? Number(data.limiteCredito) : null,
      estadoCliente: true,
      createdAt: now,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.cliente(idCliente),
            GSI1PK: 'CLIENTES',
            GSI1SK: `${item.nombreCliente} ${item.apellidoPatCliente}`.trim(),
            GSI2PK: `TEL#${telLimpio}`,
            GSI2SK: `CLI#${idCliente}`,
            ...item,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ];

    await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    return item;
  }
}

export const fiadoRepository = new FiadoRepository();
