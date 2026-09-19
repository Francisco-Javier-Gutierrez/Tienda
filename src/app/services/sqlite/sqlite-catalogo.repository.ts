import { inject, Injectable } from '@angular/core';
import { SqliteDatabaseService } from './sqlite-database.service';
import { SqliteSyncQueueRepository } from './sqlite-sync-queue.repository';

/**
 * =========================================================================
 * Single Responsibility Principle (SRP) - SQLite Catalogo Repository
 * =========================================================================
 * Responsabilidad única: Persistencia, consulta, actualización y reconciliación
 * de catálogos base (Marcas y Categorías) en SQLite local.
 */
@Injectable({
  providedIn: 'root',
})
export class SqliteCatalogoRepository {
  private readonly dbService = inject(SqliteDatabaseService);
  private readonly syncQueue = inject(SqliteSyncQueueRepository);

  get disponible(): boolean {
    return this.dbService.disponible;
  }

  // =========================
  // MARCAS
  // =========================
  async sincronizarMarcas(marcas: any[]): Promise<void> {
    if (!this.disponible || !Array.isArray(marcas)) return;
    const db = await this.dbService.getDB();
    const idsValidos: number[] = [];

    for (const m of marcas) {
      const idMarca = Number(m.id);
      if (!Number.isInteger(idMarca) || idMarca <= 0) continue;
      idsValidos.push(idMarca);

      await db.run(
        `INSERT INTO marcas (idMarca, nombreMarca, descripMarca, pendienteSync)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(idMarca) DO UPDATE SET
           nombreMarca = excluded.nombreMarca,
           descripMarca = excluded.descripMarca,
           pendienteSync = 0`,
        [idMarca, m.nombre || '', m.descripMarca || null],
      );
    }

    if (idsValidos.length > 0) {
      const placeholders = idsValidos.map(() => '?').join(',');
      await db.run(`DELETE FROM marcas WHERE idMarca NOT IN (${placeholders}) AND pendienteSync = 0`, idsValidos);
    }
  }

  async getMarcasLocales(): Promise<any[]> {
    if (!this.disponible) return [];
    const db = await this.dbService.getDB();
    const r = await db.query(`SELECT * FROM marcas ORDER BY nombreMarca ASC`);
    return r.values || [];
  }

  async guardarMarcaOffline(dto: { nombre: string; descripcion?: string }): Promise<any> {
    if (!this.disponible) throw new Error('SQLite no disponible');
    const db = await this.dbService.getDB();
    const idTemp = -Math.floor(Date.now() / 1000);
    const uuid = `MARCA-${Math.abs(idTemp)}-${Date.now()}`;

    await db.run(
      `INSERT INTO marcas (idMarca, nombreMarca, descripMarca, pendienteSync)
       VALUES (?, ?, ?, 1)`,
      [idTemp, dto.nombre.trim(), dto.descripcion?.trim() || null],
    );

    await this.syncQueue.encolar(
      'MARCA_CREAR',
      uuid,
      {
        tempId: idTemp,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || '',
      },
      2,
    );

    return {
      idMarca: idTemp,
      nombreMarca: dto.nombre.trim(),
      descripMarca: dto.descripcion?.trim() || null,
      pendienteSync: 1,
    };
  }

  async reconciliarMarcaOffline(idTemporal: number, marcaReal: any): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run(`DELETE FROM marcas WHERE idMarca = ?`, [idTemporal]);
    await db.run(
      `INSERT INTO marcas (idMarca, nombreMarca, descripMarca, pendienteSync)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(idMarca) DO UPDATE SET
         nombreMarca = excluded.nombreMarca,
         descripMarca = excluded.descripMarca,
         pendienteSync = 0`,
      [Number(marcaReal.id), marcaReal.nombre, marcaReal.descripMarca || null],
    );
    await db.run(`UPDATE productos SET idMarca = ? WHERE idMarca = ?`, [Number(marcaReal.id), idTemporal]);
  }

  // =========================
  // CATEGORIAS
  // =========================
  async sincronizarCategorias(categorias: any[]): Promise<void> {
    if (!this.disponible || !Array.isArray(categorias)) return;
    const db = await this.dbService.getDB();
    const idsValidos: number[] = [];

    for (const c of categorias) {
      const idCat = Number(c.id);
      if (!Number.isInteger(idCat) || idCat <= 0) continue;
      idsValidos.push(idCat);

      await db.run(
        `INSERT INTO categorias (idCat, nombreCat, descripCat, pendienteSync)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(idCat) DO UPDATE SET
           nombreCat = excluded.nombreCat,
           descripCat = excluded.descripCat,
           pendienteSync = 0`,
        [idCat, c.nombre || '', c.descripCat || null],
      );
    }

    if (idsValidos.length > 0) {
      const placeholders = idsValidos.map(() => '?').join(',');
      await db.run(`DELETE FROM categorias WHERE idCat NOT IN (${placeholders}) AND pendienteSync = 0`, idsValidos);
    }
  }

  async getCategoriasLocales(): Promise<any[]> {
    if (!this.disponible) return [];
    const db = await this.dbService.getDB();
    const r = await db.query(`SELECT * FROM categorias ORDER BY nombreCat ASC`);
    return r.values || [];
  }

  async guardarCategoriaOffline(dto: { nombre: string; descripcion?: string }): Promise<any> {
    if (!this.disponible) throw new Error('SQLite no disponible');
    const db = await this.dbService.getDB();
    const idTemp = -Math.floor(Date.now() / 1000);
    const uuid = `CAT-${Math.abs(idTemp)}-${Date.now()}`;

    await db.run(
      `INSERT INTO categorias (idCat, nombreCat, descripCat, pendienteSync)
       VALUES (?, ?, ?, 1)`,
      [idTemp, dto.nombre.trim(), dto.descripcion?.trim() || null],
    );

    await this.syncQueue.encolar(
      'CATEGORIA_CREAR',
      uuid,
      {
        tempId: idTemp,
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || '',
      },
      2,
    );

    return {
      idCat: idTemp,
      nombreCat: dto.nombre.trim(),
      descripCat: dto.descripcion?.trim() || null,
      pendienteSync: 1,
    };
  }

  async reconciliarCategoriaOffline(idTemporal: number, categoriaReal: any): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run(`DELETE FROM categorias WHERE idCat = ?`, [idTemporal]);
    await db.run(
      `INSERT INTO categorias (idCat, nombreCat, descripCat, pendienteSync)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(idCat) DO UPDATE SET
         nombreCat = excluded.nombreCat,
         descripCat = excluded.descripCat,
         pendienteSync = 0`,
      [Number(categoriaReal.id), categoriaReal.nombre, categoriaReal.descripCat || null],
    );
    await db.run(`UPDATE productos SET idCat = ? WHERE idCat = ?`, [Number(categoriaReal.id), idTemporal]);
  }
}
