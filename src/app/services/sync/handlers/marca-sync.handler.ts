import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Marca } from '../../../models/marca';
import { CatalogosService } from '../../catalogos.service';
import { SqliteService } from '../../sqlite.service';
import { ItemColaSync } from '../../sqlite/sqlite-sync-queue.repository';
import { SyncOperationHandler } from '../sync-handler.interface';

/**
 * =========================================================================
 * Open/Closed Principle (OCP) - Marca Sync Handler
 * =========================================================================
 * Estrategia de sincronización para operaciones 'MARCA_CREAR'.
 */
@Injectable({
  providedIn: 'root',
})
export class MarcaSyncHandler implements SyncOperationHandler {
  readonly tipo = 'MARCA_CREAR';

  private readonly catalogos = inject(CatalogosService);
  private readonly sqlite = inject(SqliteService);

  async ejecutar(op: ItemColaSync, payload: any): Promise<void> {
    let marcaReal: Marca;
    try {
      marcaReal = await firstValueFrom(
        this.catalogos.crearMarca({ nombre: payload.nombre, descripcion: payload.descripcion }),
      );
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse && err.status === 409) {
        const marcas = await firstValueFrom(this.catalogos.getMarcas());
        const encontrada = marcas.find(
          (m) => (m.nombre || '').toLowerCase() === (payload.nombre || '').toLowerCase(),
        );
        if (encontrada) {
          marcaReal = encontrada;
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
    await this.sqlite.reconciliarMarcaOffline(payload.tempId, marcaReal);
  }
}
