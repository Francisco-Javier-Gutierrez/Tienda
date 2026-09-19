import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CrearVentaDto } from '../../../models/venta';
import { VentaService } from '../../venta.service';
import { ItemColaSync } from '../../sqlite/sqlite-sync-queue.repository';
import { SyncOperationHandler } from '../sync-handler.interface';

/**
 * =========================================================================
 * Open/Closed Principle (OCP) - Venta Sync Handler
 * =========================================================================
 * Estrategia de sincronización para operaciones 'VENTA'.
 */
@Injectable({
  providedIn: 'root',
})
export class VentaSyncHandler implements SyncOperationHandler {
  readonly tipo = 'VENTA';

  private readonly ventas = inject(VentaService);

  async ejecutar(op: ItemColaSync, payload: any): Promise<void> {
    await firstValueFrom(this.ventas.cobrar(payload as CrearVentaDto));
  }
}
