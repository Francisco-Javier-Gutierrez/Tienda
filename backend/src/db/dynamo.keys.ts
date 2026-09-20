import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamo.client';

export async function getNextSequence(sequenceName: string, initial = 1): Promise<number> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: 'COUNTERS', SK: sequenceName },
      UpdateExpression: 'ADD currentId :inc',
      ExpressionAttributeValues: { ':inc': 1 },
      ReturnValues: 'UPDATED_NEW',
    }),
  );
  return Number(result.Attributes?.currentId || initial);
}

export const Keys = {
  sucursal: (idSuc: number) => ({
    PK: `SUC#${idSuc}`,
    SK: 'METADATA',
  }),

  cargo: (idSuc: number, idCargo: number) => ({
    PK: `SUC#${idSuc}`,
    SK: `CARGO#${idCargo}`,
  }),

  empleado: (idEmp: number) => ({
    PK: `EMP#${idEmp}`,
    SK: 'PROFILE',
  }),

  cliente: (idCliente: number) => ({
    PK: `CLI#${idCliente}`,
    SK: 'PROFILE',
  }),

  categoria: (idSuc: number, idCat: number) => ({
    PK: `SUC#${idSuc}`,
    SK: `CAT#${idCat}`,
  }),

  marca: (idSuc: number, idMarca: number) => ({
    PK: `SUC#${idSuc}`,
    SK: `MARCA#${idMarca}`,
  }),

  producto: (idSuc: number, idPro: number) => ({
    PK: `SUC#${idSuc}`,
    SK: `PROD#${idPro}`,
  }),

  proveedor: (idSuc: number, idProv: number) => ({
    PK: `SUC#${idSuc}`,
    SK: `PROV#${idProv}`,
  }),

  configuracion: (idSuc: number) => ({
    PK: `SUC#${idSuc}`,
    SK: 'CONFIG#TRANSFER',
  }),

  sesionCaja: (idSuc: number, idSesion: number) => ({
    PK: `SUC#${idSuc}`,
    SK: `SESION#${idSesion}`,
  }),

  venta: (idSuc: number, idVenta: number) => ({
    PK: `SUC#${idSuc}`,
    SK: `VENTA#${idVenta}`,
  }),

  pedidoCliente: (idCliente: number, idPedido: number) => ({
    PK: `CLI#${idCliente}`,
    SK: `PEDIDO#${idPedido}`,
  }),

  movimientoCaja: (idSuc: number, idMovimiento: number) => ({
    PK: `SUC#${idSuc}`,
    SK: `MOVIMIENTO#${idMovimiento}`,
  }),

  merma: (idSuc: number, idMerma: number) => ({
    PK: `SUC#${idSuc}`,
    SK: `MERMA#${idMerma}`,
  }),

  movimientoCuenta: (idCliente: number, idMov: number) => ({
    PK: `CLI#${idCliente}`,
    SK: `MOV_CUENTA#${idMov}`,
  }),

  fcmTokenCliente: (idCliente: number, token: string) => ({
    PK: `CLI#${idCliente}`,
    SK: `FCM#${token}`,
  }),

  fcmTokenEmpleado: (idEmp: number, token: string) => ({
    PK: `EMP#${idEmp}`,
    SK: `FCM#${token}`,
  }),

  idempotency: (uuid: string, operation: string) => ({
    PK: `IDEMP#${uuid}`,
    SK: operation,
  }),
};
