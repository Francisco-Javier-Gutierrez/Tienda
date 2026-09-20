import { DeleteCommand, GetCommand, PutCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamo.client';
import { getNextSequence, Keys } from '../dynamo.keys';
import { EmpleadoEntity } from './auth.repository';
import { errorFuncional } from '../../utils/formatters';

export class EmpleadoRepository {
  async listEmpleados(idSuc = 1): Promise<EmpleadoEntity[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :sucKey',
        ExpressionAttributeValues: {
          ':sucKey': `SUC#${idSuc}#EMPLEADOS`,
        },
      }),
    );
    return ((res.Items || []) as EmpleadoEntity[]).sort((a, b) => a.idEmp - b.idEmp);
  }

  async getEmpleadoById(idEmp: number): Promise<EmpleadoEntity | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: Keys.empleado(idEmp),
        ConsistentRead: true,
      }),
    );
    return (res.Item as EmpleadoEntity) || null;
  }

  async createEmpleado(data: Omit<EmpleadoEntity, 'idEmp'>): Promise<EmpleadoEntity> {
    const idEmp = await getNextSequence('empleado', 4);
    const item: EmpleadoEntity = {
      ...data,
      idEmp,
      estadoEmp: data.estadoEmp !== false,
    };

    const emailNorm = item.correoEmp.toLowerCase().trim();

    const transactItems = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.empleado(idEmp),
            GSI1PK: `SUC#${item.idSuc}#EMPLEADOS`,
            GSI1SK: `${item.apellidoPatEmp}#${item.nombreEmp}`,
            GSI2PK: `EMAIL#${emailNorm}`,
            GSI2SK: `EMP#${idEmp}`,
            ...item,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `UNIQUE_EMAIL#${emailNorm}`,
            SK: 'EMAIL',
            tipo: 'EMPLEADO',
            idEmp,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ];

    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
      return item;
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        throw errorFuncional('El correo electrónico ya está registrado por otro empleado', 409);
      }
      throw error;
    }
  }

  async updateEmpleado(idEmp: number, data: Partial<EmpleadoEntity>): Promise<EmpleadoEntity | null> {
    const existing = await this.getEmpleadoById(idEmp);
    if (!existing) return null;

    const updated: EmpleadoEntity = {
      ...existing,
      ...data,
      idEmp,
    };

    const oldEmailNorm = existing.correoEmp.toLowerCase().trim();
    const newEmailNorm = updated.correoEmp.toLowerCase().trim();

    const transactItems: any[] = [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            ...Keys.empleado(idEmp),
            GSI1PK: `SUC#${updated.idSuc}#EMPLEADOS`,
            GSI1SK: `${updated.apellidoPatEmp}#${updated.nombreEmp}`,
            GSI2PK: `EMAIL#${newEmailNorm}`,
            GSI2SK: `EMP#${idEmp}`,
            ...updated,
          },
        },
      },
    ];

    if (oldEmailNorm !== newEmailNorm) {
      transactItems.push(
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: { PK: `UNIQUE_EMAIL#${oldEmailNorm}`, SK: 'EMAIL' },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              PK: `UNIQUE_EMAIL#${newEmailNorm}`,
              SK: 'EMAIL',
              tipo: 'EMPLEADO',
              idEmp,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
          },
        },
      );
    }

    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
      return updated;
    } catch (error: any) {
      if (error.name === 'TransactionCanceledException') {
        throw errorFuncional('El nuevo correo electrónico ya está en uso', 409);
      }
      throw error;
    }
  }

  async deleteEmpleado(idEmp: number): Promise<boolean> {
    const existing = await this.getEmpleadoById(idEmp);
    if (!existing) return true;

    const emailNorm = existing.correoEmp.toLowerCase().trim();

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: TABLE_NAME,
              Key: Keys.empleado(idEmp),
            },
          },
          {
            Delete: {
              TableName: TABLE_NAME,
              Key: { PK: `UNIQUE_EMAIL#${emailNorm}`, SK: 'EMAIL' },
            },
          },
        ],
      }),
    );
    return true;
  }
}

export const empleadoRepository = new EmpleadoRepository();
