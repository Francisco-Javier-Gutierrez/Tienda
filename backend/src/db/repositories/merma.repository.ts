import { TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME, docClient } from '../dynamo.client';
import { getNextSequence, Keys } from '../dynamo.keys';
import { BaseDynamoRepository } from '../base.repository';
import { idempotencyRepository } from './idempotency.repository';
import { errorFuncional } from '../../utils/formatters';

export interface MermaEntity {
  idMerma: number;
  uuidMerma?: string | null;
  idSuc: number;
  idEmp: number;
  empleadoNombre: string;
  idPro: number;
  productoNombre: string;
  codigoQR?: string | null;
  cantidad: number;
  tipo: 'CADUCADO' | 'DANADO' | 'DEVOLUCION_PROVEEDOR' | 'CONSUMO_INTERNO' | 'OTRO';
  motivo: string;
  costoUnitario: number;
  costoTotal: number;
  precioVentaUnitario: number;
  idProv?: number | null;
  proveedorNombre?: string | null;
  estado: 'APLICADO' | 'PENDIENTE_REPOSICION' | 'DEVUELTO_PROVEEDOR';
  fecha: string;
  fechaHora: string;
  createdAt: string;
  updatedAt: string;
}

export interface IMermaRepository {
  createMerma(
    data: Omit<MermaEntity, 'idMerma' | 'createdAt' | 'updatedAt' | 'fecha' | 'fechaHora'>,
  ): Promise<MermaEntity>;
  listMermas(
    idSuc: number,
    options?: { tipo?: string; estado?: string; idProv?: number; fechaDesde?: string; fechaHasta?: string },
  ): Promise<MermaEntity[]>;
  getMermaById(idMerma: number, idSuc?: number): Promise<MermaEntity | null>;
  getMermaByUuid(uuidMerma: string, idSuc?: number): Promise<MermaEntity | null>;
  updateEstadoMerma(
    idMerma: number,
    estado: 'APLICADO' | 'PENDIENTE_REPOSICION' | 'DEVUELTO_PROVEEDOR',
    idSuc?: number,
  ): Promise<MermaEntity | null>;
}

export class MermaRepository extends BaseDynamoRepository<MermaEntity> implements IMermaRepository {
  async createMerma(
    data: Omit<MermaEntity, 'idMerma' | 'createdAt' | 'updatedAt' | 'fecha' | 'fechaHora'>,
  ): Promise<MermaEntity> {
    if (data.uuidMerma) {
      const record = await idempotencyRepository.getRecord(data.uuidMerma, 'MERMA');
      if (record) {
        const existente = await this.getMermaById(record.targetId, data.idSuc);
        if (existente) return existente;
      }
    }

    const idMerma = await getNextSequence('merma', 1);
    const now = new Date().toISOString();
    const fecha = now.slice(0, 10);

    const mermaItem: MermaEntity = {
      ...data,
      idMerma,
      fecha,
      fechaHora: now,
      createdAt: now,
      updatedAt: now,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.merma(data.idSuc, idMerma),
            GSI1PK: `SUC#${data.idSuc}#MERMAS`,
            GSI1SK: `${now}#MERMA#${idMerma}`,
            ...mermaItem,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Update: {
          TableName: TABLE_NAME,
          Key: Keys.producto(data.idSuc, data.idPro),
          UpdateExpression: 'ADD existenciaPro :negCant',
          ConditionExpression: 'attribute_exists(PK) AND existenciaPro >= :cant',
          ExpressionAttributeValues: {
            ':negCant': -data.cantidad,
            ':cant': data.cantidad,
          },
        },
      },
    ];

    if (data.uuidMerma) {
      transactItems.push(
        idempotencyRepository.buildTransactItem(data.uuidMerma, 'MERMA', idMerma, {
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
        if (data.uuidMerma) {
          const existente = await this.getMermaByUuid(data.uuidMerma, data.idSuc);
          if (existente) return existente;
        }
        throw errorFuncional(
          'No se pudo registrar la merma. Verifique que haya existencias suficientes del producto.',
          400,
        );
      }
      throw error;
    }

    return mermaItem;
  }

  async listMermas(
    idSuc = 1,
    options?: { tipo?: string; estado?: string; idProv?: number; fechaDesde?: string; fechaHasta?: string },
  ): Promise<MermaEntity[]> {
    let items = await this.queryItems(
      'GSI1PK = :gsi1pk',
      { ':gsi1pk': `SUC#${idSuc}#MERMAS` },
      { indexName: 'GSI1', scanIndexForward: false },
    );

    if (options?.tipo) {
      items = items.filter((m) => m.tipo === options.tipo);
    }
    if (options?.estado) {
      items = items.filter((m) => m.estado === options.estado);
    }
    if (options?.idProv) {
      items = items.filter((m) => m.idProv === options.idProv);
    }
    if (options?.fechaDesde) {
      items = items.filter((m) => m.fecha >= options.fechaDesde!);
    }
    if (options?.fechaHasta) {
      items = items.filter((m) => m.fecha <= options.fechaHasta!);
    }

    return items;
  }

  async getMermaById(idMerma: number, idSuc = 1): Promise<MermaEntity | null> {
    return this.getByKey(Keys.merma(idSuc, idMerma));
  }

  async getMermaByUuid(uuidMerma: string, idSuc = 1): Promise<MermaEntity | null> {
    const record = await idempotencyRepository.getRecord(uuidMerma, 'MERMA');
    if (!record) return null;
    return this.getMermaById(record.targetId, idSuc);
  }

  async updateEstadoMerma(
    idMerma: number,
    estado: 'APLICADO' | 'PENDIENTE_REPOSICION' | 'DEVUELTO_PROVEEDOR',
    idSuc = 1,
  ): Promise<MermaEntity | null> {
    const existing = await this.getMermaById(idMerma, idSuc);
    if (!existing) return null;

    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: Keys.merma(idSuc, idMerma),
        UpdateExpression: 'SET estado = :estado, updatedAt = :now',
        ExpressionAttributeValues: {
          ':estado': estado,
          ':now': now,
        },
      }),
    );

    return {
      ...existing,
      estado,
      updatedAt: now,
    };
  }
}

export const mermaRepository = new MermaRepository();
