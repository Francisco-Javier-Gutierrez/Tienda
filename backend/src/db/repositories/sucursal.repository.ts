import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../dynamo.client';
import { Keys } from '../dynamo.keys';

export interface SucursalEntity {
  idSuc: number;
  nombreSuc: string;
  descripcionSuc?: string | null;
  telefonoSuc?: string | null;
  correoSuc?: string | null;
  paginaWebSuc?: string | null;
  redSocialSuc?: string | null;
  logoSuc?: string | null;
  direccion?: {
    pais?: string;
    estado?: string;
    municipio?: string;
    colonia?: string;
    calle?: string;
    noExt?: string;
    noInt?: string;
    codPostal?: string;
  };
}

export class SucursalRepository {
  async getById(idSuc = 1): Promise<SucursalEntity | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: Keys.sucursal(idSuc),
      }),
    );
    return (res.Item as SucursalEntity) || null;
  }

  async getPublic(idSuc = 1): Promise<Array<{ idSuc: number; nombreSuc: string; descripcionSuc: string | null; logoSuc: string | null }>> {
    const sucursal = await this.getById(idSuc);
    if (!sucursal) return [];
    return [
      {
        idSuc: sucursal.idSuc,
        nombreSuc: sucursal.nombreSuc,
        descripcionSuc: sucursal.descripcionSuc || null,
        logoSuc: sucursal.logoSuc || null,
      },
    ];
  }

  async updateLogo(idSuc: number, logoUrl: string | null): Promise<SucursalEntity | null> {
    const res = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: Keys.sucursal(idSuc),
        UpdateExpression: 'SET logoSuc = :logo',
        ExpressionAttributeValues: { ':logo': logoUrl },
        ReturnValues: 'ALL_NEW',
      }),
    );
    return (res.Attributes as SucursalEntity) || null;
  }

  async update(idSuc: number, datos: Partial<SucursalEntity>): Promise<SucursalEntity | null> {
    const campos: string[] = [];
    const attrValues: Record<string, any> = {};
    const attrNames: Record<string, string> = {};

    if (datos.nombreSuc !== undefined) {
      campos.push('#nom = :nom');
      attrNames['#nom'] = 'nombreSuc';
      attrValues[':nom'] = datos.nombreSuc;
    }
    if (datos.descripcionSuc !== undefined) {
      campos.push('descripcionSuc = :desc');
      attrValues[':desc'] = datos.descripcionSuc;
    }
    if (datos.telefonoSuc !== undefined) {
      campos.push('telefonoSuc = :tel');
      attrValues[':tel'] = datos.telefonoSuc;
    }
    if (datos.correoSuc !== undefined) {
      campos.push('correoSuc = :cor');
      attrValues[':cor'] = datos.correoSuc;
    }
    if (datos.paginaWebSuc !== undefined) {
      campos.push('paginaWebSuc = :web');
      attrValues[':web'] = datos.paginaWebSuc;
    }
    if (datos.redSocialSuc !== undefined) {
      campos.push('redSocialSuc = :red');
      attrValues[':red'] = datos.redSocialSuc;
    }

    if (campos.length === 0) {
      return await this.getById(idSuc);
    }

    const res = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: Keys.sucursal(idSuc),
        UpdateExpression: `SET ${campos.join(', ')}`,
        ...(Object.keys(attrNames).length > 0 && { ExpressionAttributeNames: attrNames }),
        ExpressionAttributeValues: attrValues,
        ReturnValues: 'ALL_NEW',
      }),
    );
    return (res.Attributes as SucursalEntity) || null;
  }

  async create(datos: Partial<SucursalEntity>): Promise<SucursalEntity> {
    const idSuc = datos.idSuc || 1;
    const entidad: SucursalEntity = {
      idSuc,
      nombreSuc: datos.nombreSuc || 'Mi Tienda',
      descripcionSuc: datos.descripcionSuc || null,
      telefonoSuc: datos.telefonoSuc || null,
      correoSuc: datos.correoSuc || null,
      paginaWebSuc: datos.paginaWebSuc || null,
      redSocialSuc: datos.redSocialSuc || null,
      logoSuc: datos.logoSuc || null,
    };
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.sucursal(idSuc),
          ...entidad,
        },
      }),
    );
    return entidad;
  }
}

export const sucursalRepository = new SucursalRepository();
