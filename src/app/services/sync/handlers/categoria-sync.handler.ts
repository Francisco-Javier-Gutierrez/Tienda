import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Categoria } from '../../../models/categoria';
import { CatalogosService } from '../../catalogos.service';
import { SqliteService } from '../../sqlite.service';
import { ItemColaSync } from '../../sqlite/sqlite-sync-queue.repository';
import { SyncOperationHandler } from '../sync-handler.interface';

/**
 * =========================================================================
 * Open/Closed Principle (OCP) - Categoria Sync Handler
 * =========================================================================
 * Estrategia de sincronización para operaciones 'CATEGORIA_CREAR'.
 */
@Injectable({
  providedIn: 'root',
})
export class CategoriaSyncHandler implements SyncOperationHandler {
  readonly tipo = 'CATEGORIA_CREAR';

  private readonly catalogos = inject(CatalogosService);
  private readonly sqlite = inject(SqliteService);

  async ejecutar(op: ItemColaSync, payload: any): Promise<void> {
    let catReal: Categoria;
    try {
      catReal = await firstValueFrom(
        this.catalogos.crearCategoria({ nombre: payload.nombre, descripcion: payload.descripcion }),
      );
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        const cats = await firstValueFrom(this.catalogos.getCategorias());
        const encontrada = cats.find(
          (c) => (c.nombre || '').toLowerCase() === (payload.nombre || '').toLowerCase(),
        );
        if (encontrada) {
          catReal = encontrada;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
    await this.sqlite.reconciliarCategoriaOffline(payload.tempId, catReal);
  }
}
