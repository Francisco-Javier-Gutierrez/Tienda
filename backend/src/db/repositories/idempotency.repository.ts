import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamo.client';
import { Keys } from '../dynamo.keys';

export interface IdempotencyRecord {
  PK: string;
  SK: string;
  uuid: string;
  operation: 'VENTA' | 'PEDIDO' | 'CAJA' | 'MOVIMIENTO';
  targetId: number;
  idSuc?: number;
  idEmp?: number;
  idCliente?: number;
  createdAt: string;
  ttl?: number;
}

export interface IIdempotencyRepository {
  getRecord(uuid: string, operation: string): Promise<IdempotencyRecord | null>;
  buildTransactItem(
    uuid: string,
    operation: 'VENTA' | 'PEDIDO' | 'CAJA' | 'MOVIMIENTO',
    targetId: number,
    metadata?: { idSuc?: number; idEmp?: number; idCliente?: number },
  ): any;
}

export class IdempotencyRepository implements IIdempotencyRepository {
  async getRecord(uuid: string, operation: string): Promise<IdempotencyRecord | null> {
    if (!uuid) return null;
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: Keys.idempotency(uuid, operation),
        ConsistentRead: true,
      }),
    );
    return (res.Item as IdempotencyRecord) || null;
  }

  buildTransactItem(
    uuid: string,
    operation: 'VENTA' | 'PEDIDO' | 'CAJA' | 'MOVIMIENTO',
    targetId: number,
    metadata: { idSuc?: number; idEmp?: number; idCliente?: number } = {},
  ) {
    const now = new Date().toISOString();
    return {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          ...Keys.idempotency(uuid, operation),
          uuid,
          operation,
          targetId,
          ...metadata,
          createdAt: now,
          ttl: Math.floor(Date.now() / 1000) + 86400 * 7, // Retención de 7 días
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    };
  }
}

export const idempotencyRepository = new IdempotencyRepository();
