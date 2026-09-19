import { inject, Injectable } from '@angular/core';
import { SqliteDatabaseService } from './sqlite-database.service';

export interface ItemColaSync {
  id: string;
  tipo: string;
  uuid: string;
  payload: string;
  orden: number;
  estado: string;
  error: string | null;
}

/**
 * =========================================================================
 * Single Responsibility Principle (SRP) - SQLite Sync Queue Repository
 * =========================================================================
 * Responsabilidad única: Gestión de la cola Outbox ('cola_sync') y actualización
 * de estados de sincronización de entidades offline.
 */
@Injectable({
  providedIn: 'root',
})
export class SqliteSyncQueueRepository {
  private readonly dbService = inject(SqliteDatabaseService);

  get disponible(): boolean {
    return this.dbService.disponible;
  }

  async encolar(tipo: string, uuid: string, payload: unknown, orden: number): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run(
      `INSERT INTO cola_sync(tipo,uuid,payload,orden,estado,creadoEn) VALUES(?,?,?,?, 'PENDIENTE',datetime('now')) ON CONFLICT(uuid) DO NOTHING`,
      [tipo, uuid, JSON.stringify(payload), orden],
    );
  }

  async pendientesSync(): Promise<ItemColaSync[]> {
    if (!this.disponible) return [];
    const db = await this.dbService.getDB();
    const r = await db.query(`SELECT * FROM cola_sync WHERE estado IN ('PENDIENTE','CONFLICTO') ORDER BY orden,id`);
    return (r.values as ItemColaSync[]) || [];
  }

  async actualizarCola(
    uuid: string,
    estado: 'SINCRONIZADA' | 'CONFLICTO' | 'PENDIENTE',
    error: string | null = null,
  ): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run('UPDATE cola_sync SET estado=?,error=? WHERE uuid=?', [estado, error, uuid]);
  }

  async marcarEntidadSync(
    tipo: string,
    uuid: string,
    estado: 'SINCRONIZADA' | 'CONFLICTO' | 'PENDIENTE',
    error: string | null = null,
  ): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    if (tipo === 'VENTA') {
      await db.run('UPDATE ventas_local SET estadoSync=?,errorSync=? WHERE uuidVenta=?', [estado, error, uuid]);
    } else if (tipo === 'MOVIMIENTO') {
      await db.run('UPDATE movimientos_caja_local SET estadoSync=?,errorSync=? WHERE uuidMovimientoCaja=?', [
        estado,
        error,
        uuid,
      ]);
    } else if (tipo === 'APERTURA') {
      await db.run('UPDATE sesiones_caja_local SET estadoSync=?,errorSync=? WHERE uuidSesionCaja=?', [
        estado,
        error,
        uuid,
      ]);
    }
  }
}
