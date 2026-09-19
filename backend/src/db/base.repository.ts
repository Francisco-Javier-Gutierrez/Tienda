import {
  GetCommand,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamo.client';
import { errorFuncional } from '../utils/formatters';

export interface QueryOptions {
  indexName?: string;
  scanIndexForward?: boolean;
  consistentRead?: boolean;
  limit?: number;
}

/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - Repositorios
 * =========================================================================
 * Clientes de sólo lectura (como catálogos públicos o validadores de stock)
 * no deben depender de métodos destructivos (deleteByKey) ni de transacciones.
 */
export interface IReadOnlyRepository<T> {
  readonly tableName: string;
  getByKey(key: Record<string, any>, consistentRead?: boolean): Promise<T | null>;
  queryItems(keyCondition: string, values: Record<string, any>, options?: QueryOptions): Promise<T[]>;
}

export interface IWriteOnlyRepository<T> {
  putItem(item: Record<string, any>, conditionExpression?: string): Promise<void>;
  deleteByKey(key: Record<string, any>): Promise<void>;
}

export interface ITransactionalRepository {
  executeTransaction(transactItems: any[], conflictErrorMessage?: string): Promise<void>;
}

/**
 * Contrato completo compuesto para repositorios que requieren lectura, escritura y transacciones.
 */
export interface IRepository<T>
  extends IReadOnlyRepository<T>,
    IWriteOnlyRepository<T>,
    ITransactionalRepository {}

/**
 * BaseDynamoRepository: Supertipo abstracto para repositorios en AWS DynamoDB Single-Table.
 * Cumple LSP e ISP:
 * - Implementa interfaces segregadas permitiendo que los consumidores utilicen sólo la interfaz requerida.
 * - Garantiza un contrato consistente para todas las operaciones de persistencia.
 */
export abstract class BaseDynamoRepository<T> implements IRepository<T> {
  readonly tableName: string;

  constructor(tableName: string = TABLE_NAME) {
    this.tableName = tableName;
  }

  /**
   * Obtiene un registro por su clave primaria (PK y opcional SK).
   */
  async getByKey(key: Record<string, any>, consistentRead = true): Promise<T | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: key,
        ConsistentRead: consistentRead,
      }),
    );
    return (res.Item as T) || null;
  }

  /**
   * Consulta registros utilizando expresión de condición de clave (GSI o clave principal).
   */
  async queryItems(
    keyCondition: string,
    values: Record<string, any>,
    options?: QueryOptions,
  ): Promise<T[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: options?.indexName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: values,
        ScanIndexForward: options?.scanIndexForward ?? true,
        ConsistentRead: options?.indexName ? false : (options?.consistentRead ?? true),
        Limit: options?.limit,
      }),
    );
    return (res.Items || []) as T[];
  }

  /**
   * Guarda o reemplaza un ítem completo en DynamoDB.
   */
  async putItem(item: Record<string, any>, conditionExpression?: string): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: conditionExpression,
      }),
    );
  }

  /**
   * Elimina un ítem por su clave primaria.
   */
  async deleteByKey(key: Record<string, any>): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: key,
      }),
    );
  }

  /**
   * Ejecuta transacciones atómicas de escritura en DynamoDB con manejo consistente
   * de excepciones.
   */
  async executeTransaction(
    transactItems: any[],
    conflictErrorMessage = 'Conflicto de concurrencia o integridad referencial en DynamoDB',
  ): Promise<void> {
    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        throw errorFuncional(conflictErrorMessage, 409);
      }
      throw error;
    }
  }
}
