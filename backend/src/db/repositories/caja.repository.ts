import { getNextSequence, Keys } from '../dynamo.keys';
import { BaseDynamoRepository } from '../base.repository';
import { idempotencyRepository } from './idempotency.repository';

export interface SesionCajaEntity {
  idSesionCaja: number;
  idSuc: number;
  idEmp: number;
  empleadoNombre?: string;
  uuidSesionCaja?: string;
  estado: 'ABIERTA' | 'CERRADA';
  fondoInicial: number;
  totalVentas: number;
  totalEfectivo?: number;
  totalTarjeta?: number;
  totalTransferencia?: number;
  numeroVentas?: number;
  totalIngresos?: number;
  totalRetiros?: number;
  fechaApertura: string;
  fechaCierre?: string | null;
  montoReal?: number | null;
  diferencia?: number | null;
  observaciones?: string | null;
}

/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - Repositorio de Caja
 * =========================================================================
 * - ICajaReader: Clientes que solo consultan sesiones de caja o estado de arqueo
 * - ICajaOperator: Operaciones transaccionales de apertura y cierre de caja
 */
export interface ICajaReader {
  getSesionAbierta(idSuc?: number, idEmp?: number): Promise<SesionCajaEntity | null>;
  getSesionById(idSesionCaja: number, idSuc?: number): Promise<SesionCajaEntity | null>;
  listSesiones(idSuc?: number): Promise<SesionCajaEntity[]>;
}

export interface ICajaOperator {
  abrirSesion(data: {
    idSuc: number;
    idEmp: number;
    fondoInicial: number;
    uuidSesionCaja?: string;
    empleadoNombre?: string;
  }): Promise<SesionCajaEntity>;
  cerrarSesion(
    idSesionCaja: number,
    data: { montoReal: number; diferencia: number; observaciones?: string },
    idSuc?: number,
  ): Promise<SesionCajaEntity | null>;
}

export interface ICajaRepository extends ICajaReader, ICajaOperator {}

/**
 * CajaRepository: Repositorio para sesiones de caja en DynamoDB Single-Table.
 * Hereda de BaseDynamoRepository e implementa ICajaRepository cumpliendo LSP e ISP.
 */
export class CajaRepository extends BaseDynamoRepository<SesionCajaEntity> implements ICajaRepository {
  async getSesionAbierta(idSuc = 1, idEmp?: number): Promise<SesionCajaEntity | null> {
    // 1. Consultar sesión activa a nivel sucursal (rápido GetItem O(1))
    const sucursalActiva = await this.getByKey({
      PK: `SUC#${idSuc}`,
      SK: 'SESION_ACTIVA',
    });
    if ((sucursalActiva as any)?.idSesionCaja) {
      const sesion = await this.getSesionById((sucursalActiva as any).idSesionCaja, idSuc);
      if (sesion && sesion.estado === 'ABIERTA') {
        return sesion;
      }
    }

    // 2. Consultar sesión activa por empleado específico (compatibilidad)
    if (idEmp) {
      const activaRes = await this.getByKey({
        PK: `SUC#${idSuc}`,
        SK: `SESION_ACTIVA#${idEmp}`,
      });
      if ((activaRes as any)?.idSesionCaja) {
        const sesion = await this.getSesionById((activaRes as any).idSesionCaja, idSuc);
        if (sesion && sesion.estado === 'ABIERTA') {
          return sesion;
        }
      }
    }

    // 3. Fallback optimizado: consultar las últimas 10 sesiones descendentes
    const sesiones = await this.queryItems(
      'PK = :pk AND begins_with(SK, :skPrefix)',
      {
        ':pk': `SUC#${idSuc}`,
        ':skPrefix': 'SESION#',
      },
      { scanIndexForward: false, limit: 10, consistentRead: true },
    );
    const abierta = sesiones.find((s) => s.estado === 'ABIERTA');
    return abierta || null;
  }

  async getSesionById(idSesionCaja: number, idSuc = 1): Promise<SesionCajaEntity | null> {
    return this.getByKey(Keys.sesionCaja(idSuc, idSesionCaja));
  }

  async getSesionByUuid(uuidSesionCaja: string, idSuc = 1): Promise<SesionCajaEntity | null> {
    const record = await idempotencyRepository.getRecord(uuidSesionCaja, 'CAJA');
    if (!record) return null;
    return this.getSesionById(record.targetId, record.idSuc || idSuc);
  }

  async abrirSesion(data: {
    idSuc: number;
    idEmp: number;
    fondoInicial: number;
    uuidSesionCaja?: string;
    empleadoNombre?: string;
  }): Promise<SesionCajaEntity> {
    if (data.uuidSesionCaja) {
      const existente = await this.getSesionByUuid(data.uuidSesionCaja, data.idSuc);
      if (existente) {
        return existente;
      }
    }

    const idSesionCaja = await getNextSequence('sesionCaja', 4);
    const now = new Date().toISOString();
    const item: SesionCajaEntity = {
      idSesionCaja,
      idSuc: data.idSuc,
      idEmp: data.idEmp,
      empleadoNombre: data.empleadoNombre,
      uuidSesionCaja: data.uuidSesionCaja,
      estado: 'ABIERTA',
      fondoInicial: data.fondoInicial,
      totalVentas: 0,
      totalEfectivo: 0,
      totalTarjeta: 0,
      totalTransferencia: 0,
      numeroVentas: 0,
      totalIngresos: 0,
      totalRetiros: 0,
      fechaApertura: now,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: this.tableName,
          Item: {
            ...Keys.sesionCaja(data.idSuc, idSesionCaja),
            GSI1PK: `EMP#${data.idEmp}#SESIONES`,
            GSI1SK: now,
            ...item,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: {
            PK: `SUC#${data.idSuc}`,
            SK: 'SESION_ACTIVA',
            idSesionCaja,
            idEmp: data.idEmp,
            idSuc: data.idSuc,
            uuidSesionCaja: data.uuidSesionCaja,
            fechaApertura: now,
          },
        },
      },
      {
        Put: {
          TableName: this.tableName,
          Item: {
            PK: `SUC#${data.idSuc}`,
            SK: `SESION_ACTIVA#${data.idEmp}`,
            idSesionCaja,
            idEmp: data.idEmp,
            idSuc: data.idSuc,
            uuidSesionCaja: data.uuidSesionCaja,
            fechaApertura: now,
          },
        },
      },
    ];

    if (data.uuidSesionCaja) {
      transactItems.push(
        idempotencyRepository.buildTransactItem(data.uuidSesionCaja, 'CAJA', idSesionCaja, {
          idSuc: data.idSuc,
          idEmp: data.idEmp,
        }),
      );
    }

    try {
      await this.executeTransaction(
        transactItems,
        'Ya tienes una sesión de caja abierta en esta sucursal',
      );
    } catch (error: any) {
      if (data.uuidSesionCaja) {
        const existente = await this.getSesionByUuid(data.uuidSesionCaja, data.idSuc);
        if (existente) {
          return existente;
        }
      }
      throw error;
    }

    return item;
  }

  async cerrarSesion(
    idSesionCaja: number,
    data: { montoReal: number; diferencia: number; observaciones?: string },
    idSuc = 1,
  ): Promise<SesionCajaEntity | null> {
    const existing = await this.getSesionById(idSesionCaja, idSuc);
    if (!existing) return null;
    if (existing.estado === 'CERRADA') {
      return existing;
    }

    const ahora = new Date().toISOString();
    const updated: SesionCajaEntity = {
      ...existing,
      estado: 'CERRADA',
      fechaCierre: ahora,
      montoReal: data.montoReal,
      diferencia: data.diferencia,
      observaciones: data.observaciones || null,
    };

    const transactItems = [
      {
        Update: {
          TableName: this.tableName,
          Key: Keys.sesionCaja(idSuc, idSesionCaja),
          UpdateExpression:
            'SET estado = :cerrada, fechaCierre = :ahora, montoReal = :montoReal, diferencia = :diferencia, observaciones = :observaciones',
          ConditionExpression: 'attribute_exists(PK) AND estado = :abierta',
          ExpressionAttributeValues: {
            ':cerrada': 'CERRADA',
            ':abierta': 'ABIERTA',
            ':ahora': ahora,
            ':montoReal': data.montoReal,
            ':diferencia': data.diferencia,
            ':observaciones': data.observaciones || null,
          },
        },
      },
      {
        Delete: {
          TableName: this.tableName,
          Key: {
            PK: `SUC#${idSuc}`,
            SK: 'SESION_ACTIVA',
          },
        },
      },
      {
        Delete: {
          TableName: this.tableName,
          Key: {
            PK: `SUC#${idSuc}`,
            SK: `SESION_ACTIVA#${updated.idEmp}`,
          },
        },
      },
    ];

    try {
      await this.executeTransaction(
        transactItems,
        'La caja ya fue cerrada por otro usuario o no se encuentra abierta.',
      );
    } catch (error: any) {
      const refreshed = await this.getSesionById(idSesionCaja, idSuc);
      if (refreshed && refreshed.estado === 'CERRADA') {
        return refreshed;
      }
      throw error;
    }

    return updated;
  }

  async listSesiones(idSuc = 1): Promise<SesionCajaEntity[]> {
    return this.queryItems(
      'PK = :pk AND begins_with(SK, :skPrefix)',
      {
        ':pk': `SUC#${idSuc}`,
        ':skPrefix': 'SESION#',
      },
      { scanIndexForward: false, consistentRead: true },
    );
  }

  async getMovimientoByUuid(uuidMovimientoCaja: string, idSuc = 1): Promise<any | null> {
    const record = await idempotencyRepository.getRecord(uuidMovimientoCaja, 'MOVIMIENTO');
    if (!record) return null;
    return this.getByKey(Keys.movimientoCaja(record.idSuc || idSuc, record.targetId));
  }

  async registrarMovimiento(data: {
    idSuc: number;
    idEmp: number;
    idSesionCaja: number;
    uuidMovimientoCaja: string;
    tipoMovimiento: 'INGRESO' | 'RETIRO';
    monto: number;
    concepto: string;
  }): Promise<any> {
    if (data.uuidMovimientoCaja) {
      const existente = await this.getMovimientoByUuid(data.uuidMovimientoCaja, data.idSuc);
      if (existente) {
        return existente;
      }
    }

    const idMovimientoCaja = await getNextSequence('movimientoCaja', 1);
    const fechaHora = new Date().toISOString();
    const item = {
      idMovimientoCaja,
      idSuc: data.idSuc,
      idEmp: data.idEmp,
      idSesionCaja: data.idSesionCaja,
      uuidMovimientoCaja: data.uuidMovimientoCaja,
      tipoMovimiento: data.tipoMovimiento,
      monto: data.monto,
      concepto: data.concepto,
      fechaHora,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: this.tableName,
          Item: {
            ...Keys.movimientoCaja(data.idSuc, idMovimientoCaja),
            GSI1PK: `SESION#${data.idSesionCaja}#MOVIMIENTOS`,
            GSI1SK: fechaHora,
            ...item,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Update: {
          TableName: this.tableName,
          Key: Keys.sesionCaja(data.idSuc, data.idSesionCaja),
          UpdateExpression:
            data.tipoMovimiento === 'INGRESO'
              ? 'ADD totalIngresos :montoMov'
              : 'ADD totalRetiros :montoMov',
          ConditionExpression: 'attribute_exists(PK) AND estado = :abierta',
          ExpressionAttributeValues: {
            ':montoMov': Number(Number(data.monto).toFixed(2)),
            ':abierta': 'ABIERTA',
          },
        },
      },
    ];

    if (data.uuidMovimientoCaja) {
      transactItems.push(
        idempotencyRepository.buildTransactItem(data.uuidMovimientoCaja, 'MOVIMIENTO', idMovimientoCaja, {
          idSuc: data.idSuc,
          idEmp: data.idEmp,
        }),
      );
    }

    try {
      await this.executeTransaction(transactItems);
    } catch (error: any) {
      if (data.uuidMovimientoCaja) {
        const existente = await this.getMovimientoByUuid(data.uuidMovimientoCaja, data.idSuc);
        if (existente) {
          return existente;
        }
      }
      throw error;
    }

    return item;
  }

  async listMovimientos(idSesionCaja: number): Promise<any[]> {
    const items = await this.queryItems(
      'GSI1PK = :sesionKey',
      {
        ':sesionKey': `SESION#${idSesionCaja}#MOVIMIENTOS`,
      },
      {
        indexName: 'GSI1',
        scanIndexForward: false,
      },
    );
    return items.map((m: any) => ({
      ...m,
      monto: Number(m.monto),
    }));
  }
}

export const cajaRepository = new CajaRepository();
