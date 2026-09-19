import { inject, Injectable } from '@angular/core';
import { SqliteDatabaseService } from './sqlite-database.service';

export interface ResumenCajaLocal {
  totalVentas: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
  totalIngresos: number;
  totalRetiros: number;
  numeroVentas: number;
}

/**
 * =========================================================================
 * Single Responsibility Principle (SRP) - SQLite Caja Repository
 * =========================================================================
 * Responsabilidad única: Persistencia y consulta de sesiones de caja, ventas
 * locales y movimientos de caja en la base de datos SQLite local.
 */
@Injectable({
  providedIn: 'root',
})
export class SqliteCajaRepository {
  private readonly dbService = inject(SqliteDatabaseService);

  get disponible(): boolean {
    return this.dbService.disponible;
  }

  async guardarCajaLocal(
    caja: {
      uuidSesionCaja?: string;
      id?: string;
      empleadoId?: string;
      sucursalId?: string;
      fechaHoraApertura?: string;
      fondoInicial?: number;
      estado?: string;
    },
    estadoSync: string,
  ): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    const uuid = caja.uuidSesionCaja || caja.id || `caja-${Date.now()}`;
    const fecha = caja.fechaHoraApertura || (caja as any).fechaApertura || new Date().toISOString();
    await db.run(
      `INSERT INTO sesiones_caja_local(uuidSesionCaja,idSesionCaja,idEmp,idSuc,fechaHoraApertura,fondoInicial,estado,estadoSync) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(uuidSesionCaja) DO UPDATE SET idSesionCaja=excluded.idSesionCaja,estado=excluded.estado,estadoSync=excluded.estadoSync`,
      [
        uuid,
        caja.id || null,
        caja.empleadoId || '',
        caja.sucursalId || '',
        fecha,
        Number(caja.fondoInicial) || 0,
        caja.estado || 'ABIERTA',
        estadoSync,
      ],
    );
  }

  async cajaLocalAbierta(idEmp?: string): Promise<Record<string, unknown> | null> {
    if (!this.disponible) return null;
    const db = await this.dbService.getDB();
    const r = idEmp
      ? await db.query(
          `SELECT * FROM sesiones_caja_local WHERE (idEmp=? OR idEmp IS NOT NULL) AND estado='ABIERTA' ORDER BY fechaHoraApertura DESC LIMIT 1`,
          [idEmp],
        )
      : await db.query(
          `SELECT * FROM sesiones_caja_local WHERE estado='ABIERTA' ORDER BY fechaHoraApertura DESC LIMIT 1`,
        );
    return r.values?.[0] || null;
  }

  async guardarVentaOffline(venta: {
    uuidVenta: string;
    uuidSesionCaja: string;
    empleadoId: string;
    sucursalId: string;
    total: number;
    metodoPago: string;
    montoRecibido: number | null;
    items: Array<{ id: string; nombre: string; cantidad: number; precioUnitario: number; subtotal: number }>;
  }): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.execute('BEGIN TRANSACTION');
    try {
      await db.run(
        `INSERT INTO ventas_local(uuidVenta,uuidSesionCaja,idEmp,idSuc,fechaHora,totalLocal,metodoPago,montoRecibido,estadoSync) VALUES(?,?,?,?,datetime('now'),?,?,?,'PENDIENTE')`,
        [
          venta.uuidVenta,
          venta.uuidSesionCaja,
          venta.empleadoId,
          venta.sucursalId,
          venta.total,
          venta.metodoPago,
          venta.montoRecibido,
        ],
      );
      for (const i of venta.items) {
        await db.run(
          `INSERT INTO detalles_venta_local(uuidVenta,idPro,nombre,cantidad,precioLocal,subtotalLocal) VALUES(?,?,?,?,?,?)`,
          [venta.uuidVenta, i.id, i.nombre, i.cantidad, i.precioUnitario, i.subtotal],
        );
        await db.run('UPDATE productos SET existenciaPro=existenciaPro-? WHERE idPro=? AND existenciaPro>=?', [
          i.cantidad,
          i.id,
          i.cantidad,
        ]);
      }
      await db.execute('COMMIT');
    } catch (e) {
      await db.execute('ROLLBACK');
      throw e;
    }
  }

  async guardarMovimientoOffline(m: {
    uuidMovimientoCaja: string;
    uuidSesionCaja: string;
    empleadoId: string;
    tipoMovimiento: string;
    monto: number;
    concepto: string;
  }): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run(
      `INSERT INTO movimientos_caja_local(uuidMovimientoCaja,uuidSesionCaja,idEmp,tipoMovimiento,monto,concepto,fechaHora,estadoSync) VALUES(?,?,?,?,?,?,datetime('now'),'PENDIENTE') ON CONFLICT(uuidMovimientoCaja) DO NOTHING`,
      [m.uuidMovimientoCaja, m.uuidSesionCaja, m.empleadoId, m.tipoMovimiento, m.monto, m.concepto],
    );
  }

  async cerrarCajaOffline(uuidSesionCaja: string, efectivoContado: number, observaciones: string): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run(
      `UPDATE sesiones_caja_local SET fechaHoraCierre=datetime('now'),efectivoContado=?,observaciones=?,estado='CIERRE_PENDIENTE',estadoSync='PENDIENTE' WHERE uuidSesionCaja=?`,
      [efectivoContado, observaciones, uuidSesionCaja],
    );
  }

  async marcarCajaCerrada(
    uuidSesionCaja: string,
    estadoSync: 'SINCRONIZADA' | 'PENDIENTE',
    cierre?: { fechaHoraCierre?: string | null; efectivoContado?: number | null; observaciones?: string | null },
  ): Promise<void> {
    if (!this.disponible) return;
    const db = await this.dbService.getDB();
    await db.run(
      `UPDATE sesiones_caja_local SET fechaHoraCierre=COALESCE(?,fechaHoraCierre),efectivoContado=COALESCE(?,efectivoContado),observaciones=COALESCE(?,observaciones),estado='CERRADA',estadoSync=?,errorSync=NULL WHERE uuidSesionCaja=?`,
      [
        cierre?.fechaHoraCierre || null,
        cierre?.efectivoContado ?? null,
        cierre?.observaciones || null,
        estadoSync,
        uuidSesionCaja,
      ],
    );
  }

  async resumenCajaLocal(uuidSesionCaja: string): Promise<ResumenCajaLocal> {
    if (!this.disponible) {
      return {
        totalVentas: 0,
        totalEfectivo: 0,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalIngresos: 0,
        totalRetiros: 0,
        numeroVentas: 0,
      };
    }
    const db = await this.dbService.getDB();
    const v = await db.query(
      `SELECT COALESCE(SUM(totalLocal),0) totalVentas,COALESCE(SUM(CASE WHEN metodoPago='EFECTIVO' THEN totalLocal ELSE 0 END),0) totalEfectivo,COALESCE(SUM(CASE WHEN metodoPago='TARJETA' THEN totalLocal ELSE 0 END),0) totalTarjeta,COALESCE(SUM(CASE WHEN metodoPago='TRANSFERENCIA' THEN totalLocal ELSE 0 END),0) totalTransferencia,COUNT(*) numeroVentas FROM ventas_local WHERE uuidSesionCaja=?`,
      [uuidSesionCaja],
    );
    const m = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN tipoMovimiento='INGRESO' THEN monto ELSE 0 END),0) totalIngresos,COALESCE(SUM(CASE WHEN tipoMovimiento='RETIRO' THEN monto ELSE 0 END),0) totalRetiros FROM movimientos_caja_local WHERE uuidSesionCaja=?`,
      [uuidSesionCaja],
    );
    return { ...v.values![0], ...m.values![0] };
  }
}
