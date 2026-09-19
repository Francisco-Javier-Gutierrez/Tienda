import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CajaService } from '../../caja.service';
import { ItemColaSync } from '../../sqlite/sqlite-sync-queue.repository';
import { SyncOperationHandler } from '../sync-handler.interface';

/**
 * =========================================================================
 * Open/Closed Principle (OCP) - Caja Movimiento Sync Handler
 * =========================================================================
 * Estrategia de sincronización para operaciones 'MOVIMIENTO'.
 */
@Injectable({
  providedIn: 'root',
})
export class CajaMovimientoSyncHandler implements SyncOperationHandler {
  readonly tipo = 'MOVIMIENTO';

  private readonly cajas = inject(CajaService);

  async ejecutar(op: ItemColaSync, payload: any): Promise<void> {
    await firstValueFrom(
      this.cajas.registrarMovimiento(
        payload.uuidMovimientoCaja,
        payload.tipoMovimiento,
        payload.monto,
        payload.concepto,
      ),
    );
  }
}
