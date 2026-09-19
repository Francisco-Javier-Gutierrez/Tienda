import { ItemColaSync } from '../sqlite/sqlite-sync-queue.repository';

export interface SyncHandlerResult {
  /** Si es true, el motor de sincronización detiene el procesamiento de la cola */
  detenerCola?: boolean;
}

/**
 * =========================================================================
 * Open/Closed Principle (OCP) - Sync Operation Handler Interface
 * =========================================================================
 * Abstracción que define el contrato de sincronización para cualquier entidad
 * u operación offline. Permite extender el sistema con nuevos tipos de sinc
 * sin modificar la lógica central del orquestador de sincronización.
 */
export interface SyncOperationHandler {
  /** Identificador único del tipo de operación (ej. MARCA_CREAR, VENTA, etc.) */
  readonly tipo: string;

  /** Ejecuta la sincronización hacia la API en AWS y reconcilia con SQLite */
  ejecutar(op: ItemColaSync, payload: any): Promise<SyncHandlerResult | void>;
}
