import { TABLE_NAME } from '../dynamo.client';
import { getNextSequence, Keys } from '../dynamo.keys';
import { errorFuncional } from '../../utils/formatters';
import { BaseDynamoRepository } from '../base.repository';

export interface ProductoEntity {
  idPro: number;
  idSuc: number;
  nombrePro: string;
  precioVentaPro: number;
  costoPro: number;
  existenciaPro: number;
  stockMinimoPro: number;
  tamanoPro?: string | null;
  presentacionPro?: string | null;
  tipoPro?: string | null;
  codigoQR?: string | null;
  skuPro?: string | null;
  imagenPro?: string | null;
  activoPro: boolean;
  idMarca?: number | null;
  marcaNombre?: string | null;
  idCat?: number | null;
  categoriaNombre?: string | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - Repositorio de Productos
 * =========================================================================
 * - IProductoCatalogReader: Clientes que solo necesitan consultar el catálogo
 * - IProductoCatalogWriter: Módulos administrativos encargados de mutaciones
 */
export interface IProductoCatalogReader {
  listProductos(idSuc?: number, options?: { idCat?: number; soloActivos?: boolean }): Promise<ProductoEntity[]>;
  getProductoById(idPro: number, idSuc?: number): Promise<ProductoEntity | null>;
  findByCodigoQR(codigoQR: string): Promise<ProductoEntity | null>;
}

export interface IProductoCatalogWriter {
  createProducto(data: Omit<ProductoEntity, 'idPro'>): Promise<ProductoEntity>;
  updateProducto(idPro: number, data: Partial<ProductoEntity>, idSuc?: number): Promise<ProductoEntity | null>;
  deleteProducto(idPro: number, idSuc?: number): Promise<boolean>;
}

export interface IProductoRepository extends IProductoCatalogReader, IProductoCatalogWriter {}

/**
 * ProductoRepository: Repositorio para la gestión de productos en DynamoDB Single-Table.
 * Hereda de BaseDynamoRepository e implementa IProductoRepository cumpliendo LSP e ISP.
 */
export class ProductoRepository extends BaseDynamoRepository<ProductoEntity> implements IProductoRepository {
  async listProductos(idSuc = 1, options?: { idCat?: number; soloActivos?: boolean }): Promise<ProductoEntity[]> {
    let items: ProductoEntity[] = [];

    if (options?.idCat) {
      items = await this.queryItems(
        'GSI1PK = :catKey',
        { ':catKey': `CAT#${options.idCat}#PRODS` },
        { indexName: 'GSI1' },
      );
    } else {
      items = await this.queryItems(
        'PK = :pk AND begins_with(SK, :skPrefix)',
        {
          ':pk': `SUC#${idSuc}`,
          ':skPrefix': 'PROD#',
        },
        { consistentRead: true },
      );
    }

    if (options?.soloActivos) {
      items = items.filter((p) => p.activoPro !== false);
    }

    return items.sort((a, b) => a.nombrePro.localeCompare(b.nombrePro));
  }

  async getProductoById(idPro: number, idSuc = 1): Promise<ProductoEntity | null> {
    return this.getByKey(Keys.producto(idSuc, idPro));
  }

  async findByCodigoQR(codigoQR: string): Promise<ProductoEntity | null> {
    const items = await this.queryItems(
      'GSI2PK = :qrKey',
      { ':qrKey': `QR#${codigoQR.trim()}` },
      { indexName: 'GSI2' },
    );
    if (!items || items.length === 0) return null;
    return items[0];
  }

  async createProducto(data: Omit<ProductoEntity, 'idPro'>): Promise<ProductoEntity> {
    const idPro = await getNextSequence('producto', 6);
    const now = new Date().toISOString();
    const item: ProductoEntity = {
      ...data,
      idPro,
      activoPro: data.activoPro !== false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: this.tableName,
          Item: {
            ...Keys.producto(item.idSuc, idPro),
            GSI1PK: `CAT#${item.idCat || 0}#PRODS`,
            GSI1SK: String(item.precioVentaPro).padStart(8, '0'),
            ...(item.codigoQR && { GSI2PK: `QR#${item.codigoQR}`, GSI2SK: `PROD#${idPro}` }),
            ...item,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ];

    // SQL FOREIGN KEY: Validar que la categoría exista
    if (item.idCat) {
      transactItems.push({
        ConditionCheck: {
          TableName: this.tableName,
          Key: Keys.categoria(item.idSuc, item.idCat),
          ConditionExpression: 'attribute_exists(PK)',
        },
      });
    }

    // SQL FOREIGN KEY: Validar que la marca exista
    if (item.idMarca) {
      transactItems.push({
        ConditionCheck: {
          TableName: this.tableName,
          Key: Keys.marca(item.idSuc, item.idMarca),
          ConditionExpression: 'attribute_exists(PK)',
        },
      });
    }

    await this.executeTransaction(
      transactItems,
      'Violación de clave foránea: La categoría o marca seleccionada no existe en la base de datos',
    );
    return item;
  }

  async updateProducto(idPro: number, data: Partial<ProductoEntity>, idSuc = 1): Promise<ProductoEntity | null> {
    const existing = await this.getProductoById(idPro, idSuc);
    if (!existing) return null;

    const now = new Date().toISOString();
    const currentVersion = existing.version || 1;
    const updated: ProductoEntity = {
      ...existing,
      ...data,
      idPro,
      idSuc,
      version: currentVersion + 1,
      updatedAt: now,
      createdAt: existing.createdAt || now,
    };

    const transactItems: any[] = [
      {
        Put: {
          TableName: this.tableName,
          Item: {
            ...Keys.producto(idSuc, idPro),
            GSI1PK: `CAT#${updated.idCat || 0}#PRODS`,
            GSI1SK: String(updated.precioVentaPro).padStart(8, '0'),
            ...(updated.codigoQR && { GSI2PK: `QR#${updated.codigoQR}`, GSI2SK: `PROD#${idPro}` }),
            ...updated,
          },
          // SQL Optimistic Locking: Verifica que la versión coincida para evitar Lost Updates
          ConditionExpression: 'attribute_exists(PK) AND (attribute_not_exists(version) OR version = :ver)',
          ExpressionAttributeValues: {
            ':ver': currentVersion,
          },
        },
      },
    ];

    // SQL FOREIGN KEY: Validar categoría si existe
    if (updated.idCat) {
      transactItems.push({
        ConditionCheck: {
          TableName: this.tableName,
          Key: Keys.categoria(idSuc, updated.idCat),
          ConditionExpression: 'attribute_exists(PK)',
        },
      });
    }

    // SQL FOREIGN KEY: Validar marca si existe
    if (updated.idMarca) {
      transactItems.push({
        ConditionCheck: {
          TableName: this.tableName,
          Key: Keys.marca(idSuc, updated.idMarca),
          ConditionExpression: 'attribute_exists(PK)',
        },
      });
    }

    await this.executeTransaction(
      transactItems,
      'Conflicto de concurrencia o integridad referencial: El producto fue modificado por otro usuario o la categoría/marca no existe',
    );
    return updated;
  }

  async deleteProducto(idPro: number, idSuc = 1): Promise<boolean> {
    await this.deleteByKey(Keys.producto(idSuc, idPro));
    return true;
  }
}

export const productoRepository = new ProductoRepository();
