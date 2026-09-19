import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CajaService } from '../../caja.service';
import { SqliteService } from '../../sqlite.service';
import { ItemColaSync } from '../../sqlite/sqlite-sync-queue.repository';
import { SyncHandlerResult, SyncOperationHandler } from '../sync-handler.interface';

/**
 * =========================================================================
 * Open/Closed Principle (OCP) - Cierre Sync Handler
 * =========================================================================
 * Estrategia de sincronización para operaciones 'CIERRE'.
 * Si existen operaciones previas sin sincronizar, detiene la cola hasta que se completen.
 */
@Injectable({
  providedIn: 'root',
})
export class CierreSyncHandler implements SyncOperationHandler {
  readonly tipo = 'CIERRE';

  private readonly cajas = inject(CajaService);
  private readonly sqlite = inject(SqliteService);

  async ejecutar(op: ItemColaSync, payload: any): Promise<SyncHandlerResult | void> {
    const pendientes = await this.sqlite.pendientesSync();
    if (pendientes.some((x) => Number(x.id) < Number(op.id) && x.estado !== 'SINCRONIZADA')) {
      return { detenerCola: true };
    }
    const caja = await firstValueFrom(this.cajas.cerrar(payload.efectivoContado, payload.observaciones));
    await this.sqlite.marcarCajaCerrada(payload.uuidSesionCaja, 'SINCRONIZADA', caja);
  }
}
