import { DeleteCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamo.client';
import { Keys } from '../dynamo.keys';

export interface FcmTokenEntity {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  token: string;
  usuarioId: number;
  tipoUsuario: 'CLIENTE' | 'EMPLEADO';
  plataforma: 'ANDROID' | 'WEB';
  dispositivo?: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export class FcmRepository {
  async guardarToken(data: {
    usuarioId: number;
    tipoUsuario: 'CLIENTE' | 'EMPLEADO';
    token: string;
    plataforma: 'ANDROID' | 'WEB';
    dispositivo?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const key =
      data.tipoUsuario === 'CLIENTE'
        ? Keys.fcmTokenCliente(data.usuarioId, data.token)
        : Keys.fcmTokenEmpleado(data.usuarioId, data.token);

    const item: FcmTokenEntity = {
      ...key,
      GSI1PK: 'FCM#DEVICE',
      GSI1SK: data.token,
      token: data.token,
      usuarioId: data.usuarioId,
      tipoUsuario: data.tipoUsuario,
      plataforma: data.plataforma,
      dispositivo: data.dispositivo || 'Unknown',
      activo: true,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }),
    );
  }

  async eliminarToken(usuarioId: number, tipoUsuario: 'CLIENTE' | 'EMPLEADO', token: string): Promise<void> {
    const key =
      tipoUsuario === 'CLIENTE' ? Keys.fcmTokenCliente(usuarioId, token) : Keys.fcmTokenEmpleado(usuarioId, token);

    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: key,
      }),
    );
  }

  async eliminarTokenInvalido(token: string): Promise<void> {
    try {
      const queryResult = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk AND GSI1SK = :token',
          ExpressionAttributeValues: {
            ':gsi1pk': 'FCM#DEVICE',
            ':token': token,
          },
        }),
      );

      if (queryResult.Items && queryResult.Items.length > 0) {
        for (const item of queryResult.Items) {
          await docClient.send(
            new DeleteCommand({
              TableName: TABLE_NAME,
              Key: { PK: item.PK, SK: item.SK },
            }),
          );
        }
      }
    } catch (e) {
      console.warn(`[FCM] No se pudo eliminar token inválido ${token}:`, e);
    }
  }

  async obtenerTokensUsuario(usuarioId: number, tipoUsuario: 'CLIENTE' | 'EMPLEADO'): Promise<FcmTokenEntity[]> {
    const pk = tipoUsuario === 'CLIENTE' ? `CLI#${usuarioId}` : `EMP#${usuarioId}`;
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': 'FCM#',
        },
      }),
    );

    return (result.Items as FcmTokenEntity[]) || [];
  }

  async obtenerTokensEmpleados(): Promise<FcmTokenEntity[]> {
    // Escanea o consulta empleados con tokens activos
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk',
        FilterExpression: 'tipoUsuario = :tipo AND activo = :activo',
        ExpressionAttributeValues: {
          ':gsi1pk': 'FCM#DEVICE',
          ':tipo': 'EMPLEADO',
          ':activo': true,
        },
      }),
    );

    return (result.Items as FcmTokenEntity[]) || [];
  }
}
