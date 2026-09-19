import { inject, Injectable } from '@angular/core';
import { SyncOperationHandler } from './sync-handler.interface';
import { MarcaSyncHandler } from './handlers/marca-sync.handler';
import { CategoriaSyncHandler } from './handlers/categoria-sync.handler';
import { CajaAperturaSyncHandler } from './handlers/caja-apertura-sync.handler';
import { CajaMovimientoSyncHandler } from './handlers/caja-movimiento-sync.handler';
import { ProductoSyncHandler } from './handlers/producto-sync.handler';
import { VentaSyncHandler } from './handlers/venta-sync.handler';
import { CierreSyncHandler } from './handlers/cierre-sync.handler';

/**
 * =========================================================================
 * Open/Closed Principle (OCP) - Sync Handler Registry
 * =========================================================================
 * Registro dinámico de estrategias de sincronización. Abierto a la extensión
 * (se pueden registrar nuevos manejadores en tiempo de ejecución o mediante
 * módulos adicionales) y cerrado a la modificación (el motor de sincronización
 * no necesita alterarse al añadir soporte para nuevas entidades).
 */
@Injectable({
  providedIn: 'root',
})
export class SyncHandlerRegistry {
  private readonly handlers = new Map<string, SyncOperationHandler>();

  constructor() {
    this.registrar(inject(MarcaSyncHandler));
    this.registrar(inject(CategoriaSyncHandler));
    this.registrar(inject(CajaAperturaSyncHandler));
    this.registrar(inject(CajaMovimientoSyncHandler));
    this.registrar(inject(ProductoSyncHandler));
    this.registrar(inject(VentaSyncHandler));
    this.registrar(inject(CierreSyncHandler));
  }

  /**
   * Registra un nuevo manejador de sincronización o sobrescribe uno existente.
   */
  registrar(handler: SyncOperationHandler): void {
    this.handlers.set(handler.tipo, handler);
  }

  /**
   * Obtiene el manejador correspondiente para un tipo de operación.
   */
  obtener(tipo: string): SyncOperationHandler | undefined {
    return this.handlers.get(tipo);
  }

  /**
   * Verifica si existe un manejador registrado para el tipo dado.
   */
  tiene(tipo: string): boolean {
    return this.handlers.has(tipo);
  }

  /**
   * Retorna la lista de todos los tipos de operación registrados.
   */
  tiposRegistrados(): string[] {
    return Array.from(this.handlers.keys());
  }
}
