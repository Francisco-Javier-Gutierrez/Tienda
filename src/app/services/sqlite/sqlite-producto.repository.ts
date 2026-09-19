import { inject, Injectable } from '@angular/core';
import { Productos } from '../../models/productos';
import { ProductoPos } from '../../models/venta';
import { SqliteDatabaseService } from './sqlite-database.service';
import { SqliteSyncQueueRepository } from './sqlite-sync-queue.repository';

/**
 * =========================================================================
 * Single Responsibility Principle (SRP) - SQLite Producto Repository
 * =========================================================================
 * Responsabilidad única: Persistencia, consulta, actualización y reconciliación
 * de la entidad Producto en la base de datos local SQLite.
 */
@Injectable({
  providedIn: 'root',
})
export class SqliteProductoRepository {
  private readonly dbService = inject(SqliteDatabaseService);
  private readonly syncQueue = inject(SqliteSyncQueueRepository);

  get disponible(): boolean {
    return this.dbService.disponible;
  }

  async guardarProducto(producto: Productos, offline = false): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();

    const query = `
      INSERT INTO productos (
        idPro,
        nombrePro,
        precioVentaPro,
        costoPro,
        existenciaPro,
        stockMinimoPro,
        tamanoPro,
        presentacionPro,
        tipoPro,
        codigoQR,
        skuPro,
        imagenPro,
        idMarca,
        idCat,
        pendienteSync
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(codigoQR) DO UPDATE SET
        idPro = excluded.idPro,
        nombrePro = excluded.nombrePro,
        precioVentaPro = excluded.precioVentaPro,
        costoPro = excluded.costoPro,
        existenciaPro = excluded.existenciaPro,
        stockMinimoPro = excluded.stockMinimoPro,
        tamanoPro = excluded.tamanoPro,
        presentacionPro = excluded.presentacionPro,
        tipoPro = excluded.tipoPro,
        skuPro = excluded.skuPro,
        imagenPro = excluded.imagenPro,
        idMarca = excluded.idMarca,
        idCat = excluded.idCat,
        pendienteSync = excluded.pendienteSync
      ON CONFLICT(idPro) DO UPDATE SET
        nombrePro = excluded.nombrePro,
        precioVentaPro = excluded.precioVentaPro,
        costoPro = excluded.costoPro,
        existenciaPro = excluded.existenciaPro,
        stockMinimoPro = excluded.stockMinimoPro,
        tamanoPro = excluded.tamanoPro,
        presentacionPro = excluded.presentacionPro,
        tipoPro = excluded.tipoPro,
        codigoQR = excluded.codigoQR,
        skuPro = excluded.skuPro,
        imagenPro = excluded.imagenPro,
        idMarca = excluded.idMarca,
        idCat = excluded.idCat,
        pendienteSync = excluded.pendienteSync
    `;

    await db.run(query, [
      producto.id,
      producto.nombre,
      producto.precioVenta,
      producto.costo,
      producto.existencia,
      producto.stockMinimo,
      producto.tamano,
      producto.presentacion,
      producto.tipo,
      producto.codigoQR,
      producto.sku,
      producto.imagen,
      producto.marca?.id,
      producto.categoria?.id,
      offline ? 1 : 0,
    ]);
  }

  private rowAProducto(row: any): Productos {
    return {
      id: String(row.idPro),
      nombre: row.nombrePro || '',
      precio: Number(row.precioVentaPro || 0),
      precioVenta: Number(row.precioVentaPro || 0),
      costo: row.costoPro !== null && row.costoPro !== undefined ? Number(row.costoPro) : null,
      existencia: Number(row.existenciaPro || 0),
      stockMinimo: row.stockMinimoPro !== null && row.stockMinimoPro !== undefined ? Number(row.stockMinimoPro) : null,
      tamano: row.tamanoPro || null,
      presentacion: row.presentacionPro || null,
      tipo: row.tipoPro || null,
      codigoQR: row.codigoQR || null,
      sku: row.skuPro || null,
      imagen: row.imagenPro || null,
      activo: true,
      marca: row.idMarca ? { id: String(row.idMarca), nombre: null } : null,
      categoria: row.idCat ? { id: String(row.idCat), nombre: null } : null,
      idMarca: row.idMarca ? String(row.idMarca) : null,
      idCat: row.idCat ? String(row.idCat) : null,
      pendienteSync: row.pendienteSync || 0,
    };
  }

  async buscarPorQR(codigoQR: string): Promise<Productos | null> {
    if (!this.disponible) return null;
    const db = await this.dbService.getDB();

    const query = `
      SELECT * FROM productos
      WHERE codigoQR = ?
    `;

    const result = await db.query(query, [codigoQR]);

    if (result.values && result.values.length > 0) {
      return this.rowAProducto(result.values[0]);
    }

    return null;
  }

  async getProductosLocales(): Promise<Productos[]> {
    if (!this.disponible) return [];
    const db = await this.dbService.getDB();

    const result = await db.query(`SELECT * FROM productos`);
    return (result.values || []).map((r) => this.rowAProducto(r));
  }

  async getPendientesSync(): Promise<Productos[]> {
    if (!this.disponible) return [];
    const db = await this.dbService.getDB();

    const result = await db.query(`
      SELECT * FROM productos
      WHERE pendienteSync = 1
    `);

    return (result.values || []).map((r) => this.rowAProducto(r));
  }

  async marcarSincronizado(idPro: string): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();

    await db.run(
      `
      UPDATE productos
      SET pendienteSync = 0
      WHERE idPro = ?
    `,
      [idPro],
    );
  }

  async sincronizarCatalogo(productos: any[]): Promise<void> {
    if (!this.disponible || !Array.isArray(productos)) return;
    const db = await this.dbService.getDB();

    const idsValidos: string[] = [];

    for (const item of productos) {
      const idPro = item.id ? String(item.id).trim() : '';
      if (!idPro) continue;
      idsValidos.push(idPro);

      const qr = item.codigoQR ? String(item.codigoQR).trim() : null;

      if (qr) {
        await db.run('DELETE FROM productos WHERE codigoQR = ? AND idPro != ?', [qr, idPro]);
      }

      await db.run(
        `INSERT INTO productos (
          idPro,
          nombrePro,
          precioVentaPro,
          costoPro,
          existenciaPro,
          stockMinimoPro,
          tamanoPro,
          presentacionPro,
          tipoPro,
          codigoQR,
          skuPro,
          imagenPro,
          idMarca,
          idCat,
          pendienteSync
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(idPro) DO UPDATE SET
          nombrePro = excluded.nombrePro,
          precioVentaPro = excluded.precioVentaPro,
          costoPro = CASE WHEN excluded.costoPro IS NOT NULL THEN excluded.costoPro ELSE productos.costoPro END,
          existenciaPro = excluded.existenciaPro,
          stockMinimoPro = CASE WHEN excluded.stockMinimoPro IS NOT NULL THEN excluded.stockMinimoPro ELSE productos.stockMinimoPro END,
          tamanoPro = excluded.tamanoPro,
          presentacionPro = excluded.presentacionPro,
          tipoPro = CASE WHEN excluded.tipoPro IS NOT NULL THEN excluded.tipoPro ELSE productos.tipoPro END,
          codigoQR = excluded.codigoQR,
          skuPro = excluded.skuPro,
          imagenPro = excluded.imagenPro,
          idMarca = CASE WHEN excluded.idMarca IS NOT NULL THEN excluded.idMarca ELSE productos.idMarca END,
          idCat = CASE WHEN excluded.idCat IS NOT NULL THEN excluded.idCat ELSE productos.idCat END,
          pendienteSync = 0`,
        [
          idPro,
          item.nombre,
          item.precioVenta !== undefined && item.precioVenta !== null ? Number(item.precioVenta) : (item.precio ? Number(item.precio) : 0),
          item.costo !== undefined && item.costo !== null ? Number(item.costo) : null,
          item.existencia !== undefined && item.existencia !== null ? Number(item.existencia) : 0,
          item.stockMinimo !== undefined && item.stockMinimo !== null ? Number(item.stockMinimo) : null,
          item.tamano || null,
          item.presentacion || null,
          item.tipo || null,
          qr,
          item.sku || null,
          item.imagen || null,
          item.marca?.id ? String(item.marca.id) : (item.idMarca ? String(item.idMarca) : null),
          item.categoria?.id ? String(item.categoria.id) : (item.idCat ? String(item.idCat) : null),
        ],
      );
    }

    if (idsValidos.length > 0) {
      const placeholders = idsValidos.map(() => '?').join(',');
      await db.run(`DELETE FROM productos WHERE idPro NOT IN (${placeholders}) AND pendienteSync = 0`, idsValidos);
    } else {
      await db.run(`DELETE FROM productos WHERE pendienteSync = 0`);
    }
  }

  async guardarProductoPos(producto: ProductoPos): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run(
      `INSERT INTO productos(idPro,nombrePro,precioVentaPro,existenciaPro,tamanoPro,presentacionPro,codigoQR,skuPro,imagenPro,pendienteSync) VALUES(?,?,?,?,?,?,?,?,?,0) ON CONFLICT(idPro) DO UPDATE SET nombrePro=excluded.nombrePro,precioVentaPro=excluded.precioVentaPro,existenciaPro=excluded.existenciaPro,tamanoPro=excluded.tamanoPro,presentacionPro=excluded.presentacionPro,codigoQR=excluded.codigoQR,skuPro=excluded.skuPro,imagenPro=excluded.imagenPro`,
      [
        producto.id,
        producto.nombre,
        producto.precioVenta,
        producto.existencia,
        producto.tamano,
        producto.presentacion,
        producto.codigoQR,
        producto.sku,
        producto.imagen,
      ],
    );
  }

  async eliminarProductoLocal(idPro: string): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run('DELETE FROM productos WHERE idPro = ?', [Number(idPro)]);
  }

  async guardarProductoOffline(
    producto: any,
    fotoBase64?: string | null,
    fotoNombre?: string | null,
    fotoMime?: string | null,
  ): Promise<{ idProTemporal: number; uuid: string }> {
    if (!this.disponible) throw new Error('SQLite no disponible');
    const db = await this.dbService.getDB();

    const idTemp = producto.id && producto.id < 0 ? producto.id : -Math.floor(Date.now() / 1000);
    const uuid = `PROD-${Math.abs(idTemp)}-${Date.now()}`;

    await db.run(
      `INSERT INTO productos (
        idPro, nombrePro, precioVentaPro, costoPro, existenciaPro, stockMinimoPro,
        tamanoPro, presentacionPro, tipoPro, codigoQR, skuPro, imagenPro, idMarca, idCat, pendienteSync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(idPro) DO UPDATE SET
        nombrePro = excluded.nombrePro,
        precioVentaPro = excluded.precioVentaPro,
        costoPro = excluded.costoPro,
        existenciaPro = excluded.existenciaPro,
        stockMinimoPro = excluded.stockMinimoPro,
        tamanoPro = excluded.tamanoPro,
        presentacionPro = excluded.presentacionPro,
        tipoPro = excluded.tipoPro,
        codigoQR = excluded.codigoQR,
        skuPro = excluded.skuPro,
        imagenPro = excluded.imagenPro,
        idMarca = excluded.idMarca,
        idCat = excluded.idCat,
        pendienteSync = 1`,
      [
        idTemp,
        producto.nombre || '',
        Number(producto.precio ?? producto.precioVenta ?? 0),
        producto.costo !== null && producto.costo !== undefined ? Number(producto.costo) : null,
        Number(producto.existencia ?? 0),
        producto.stockMinimo !== null && producto.stockMinimo !== undefined ? Number(producto.stockMinimo) : null,
        producto.tamano || null,
        producto.presentacion || null,
        producto.tipo || null,
        producto.codigoQR ? String(producto.codigoQR).trim() : null,
        producto.sku || null,
        fotoBase64 || producto.imagen || null,
        producto.marca?.id ? Number(producto.marca.id) : null,
        producto.categoria?.id ? Number(producto.categoria.id) : null,
      ],
    );

    await this.syncQueue.encolar(
      'PRODUCTO_CREAR',
      uuid,
      {
        tempId: idTemp,
        dto: {
          nombre: producto.nombre,
          precio: Number(producto.precio ?? producto.precioVenta ?? 0),
          costo: producto.costo !== null && producto.costo !== undefined ? Number(producto.costo) : null,
          existencia: Number(producto.existencia ?? 0),
          stockMinimo: producto.stockMinimo !== null && producto.stockMinimo !== undefined ? Number(producto.stockMinimo) : null,
          tamano: producto.tamano || null,
          presentacion: producto.presentacion || null,
          tipo: producto.tipo || null,
          codigoQR: producto.codigoQR ? String(producto.codigoQR).trim() : null,
          sku: producto.sku || null,
          idMarca: producto.marca?.id ? Number(producto.marca.id) : null,
          idCat: producto.categoria?.id ? Number(producto.categoria.id) : null,
        },
        fotoBase64: fotoBase64 || null,
        fotoNombre: fotoNombre || 'producto.jpg',
        fotoMime: fotoMime || 'image/jpeg',
      },
      5,
    );

    return { idProTemporal: idTemp, uuid };
  }

  async reconciliarProductoOffline(idTemporal: number, productoReal: any): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run(`DELETE FROM productos WHERE idPro = ?`, [idTemporal]);
    await db.run(
      `INSERT INTO productos (
        idPro, nombrePro, precioVentaPro, costoPro, existenciaPro, stockMinimoPro,
        tamanoPro, presentacionPro, tipoPro, codigoQR, skuPro, imagenPro, idMarca, idCat, pendienteSync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(idPro) DO UPDATE SET
        nombrePro = excluded.nombrePro,
        precioVentaPro = excluded.precioVentaPro,
        costoPro = excluded.costoPro,
        existenciaPro = excluded.existenciaPro,
        stockMinimoPro = excluded.stockMinimoPro,
        tamanoPro = excluded.tamanoPro,
        presentacionPro = excluded.presentacionPro,
        tipoPro = excluded.tipoPro,
        codigoQR = excluded.codigoQR,
        skuPro = excluded.skuPro,
        imagenPro = excluded.imagenPro,
        idMarca = excluded.idMarca,
        idCat = excluded.idCat,
        pendienteSync = 0`,
      [
        Number(productoReal.id),
        productoReal.nombre,
        Number(productoReal.precioVenta || 0),
        productoReal.costo !== null && productoReal.costo !== undefined ? Number(productoReal.costo) : null,
        Number(productoReal.existencia || 0),
        productoReal.stockMinimo !== null && productoReal.stockMinimo !== undefined ? Number(productoReal.stockMinimo) : null,
        productoReal.tamano || null,
        productoReal.presentacion || null,
        productoReal.tipo || null,
        productoReal.codigoQR || null,
        productoReal.sku || null,
        productoReal.imagen || null,
        productoReal.marca?.id ? Number(productoReal.marca.id) : null,
        productoReal.categoria?.id ? Number(productoReal.categoria.id) : null,
      ],
    );
  }

  async reemplazarPorProductoOnline(codigoQR: string, productoOnline: any): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    if (codigoQR) {
      await db.run(`DELETE FROM productos WHERE codigoQR = ? AND (idPro < 0 OR pendienteSync = 1)`, [codigoQR]);
    }
    await this.reconciliarProductoOffline(productoOnline.id, productoOnline);
  }
}
