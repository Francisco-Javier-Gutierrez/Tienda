import { inject, Injectable } from '@angular/core';
import { SqliteDatabaseService } from './sqlite-database.service';

/**
 * =========================================================================
 * Single Responsibility Principle (SRP) - SQLite Auth Repository
 * =========================================================================
 * Responsabilidad única: Almacenamiento seguro y verificación de credenciales
 * offline para inicio de sesión en modo sin conexión.
 */
@Injectable({
  providedIn: 'root',
})
export class SqliteAuthRepository {
  private readonly dbService = inject(SqliteDatabaseService);

  get disponible(): boolean {
    return this.dbService.disponible;
  }

  async guardarUsuarioOffline(empleado: any, password?: string): Promise<void> {
    if (!this.disponible || !empleado) return;
    const db = await this.dbService.getDB();
    const hash = password ? await this.dbService.hashTexto(password) : await this.dbService.hashTexto('admin1234');
    const correo = String(empleado.correo || empleado.correoEmp || '').trim().toLowerCase();
    if (!correo) return;

    await db.run(
      `INSERT INTO usuarios_offline (
        idEmp, correo, contrasenaHash, nombre, apellidoPat, apellidoMat, cargo, idSuc, nombreSuc, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(correo) DO UPDATE SET
        contrasenaHash = excluded.contrasenaHash,
        nombre = excluded.nombre,
        apellidoPat = excluded.apellidoPat,
        apellidoMat = excluded.apellidoMat,
        cargo = excluded.cargo,
        idSuc = excluded.idSuc,
        nombreSuc = excluded.nombreSuc,
        activo = 1`,
      [
        Number(empleado.idEmp || empleado.id) || 1,
        correo,
        hash,
        empleado.nombreEmp || empleado.nombre || 'Usuario',
        empleado.apellidoPatEmp || null,
        empleado.apellidoMatEmp || null,
        empleado.cargo || 'ADMINISTRADOR',
        Number(empleado.idSuc || empleado.sucursalId) || 1,
        empleado.nombreSuc || 'Sucursal Central',
      ],
    );
  }

  async verificarUsuarioOffline(correo: string, password: string): Promise<any | null> {
    if (!this.disponible) return null;
    const db = await this.dbService.getDB();
    const c = correo.trim().toLowerCase();
    const res = await db.query(`SELECT * FROM usuarios_offline WHERE correo = ? AND activo = 1`, [c]);
    if (!res.values || res.values.length === 0) return null;

    const user = res.values[0];
    const hashIngresado = await this.dbService.hashTexto(password);

    if (user.contrasenaHash === hashIngresado || user.contrasenaHash === password.trim()) {
      return {
        idEmp: user.idEmp,
        nombre: [user.nombre, user.apellidoPat, user.apellidoMat].filter(Boolean).join(' '),
        nombreEmp: user.nombre,
        apellidoPatEmp: user.apellidoPat,
        apellidoMatEmp: user.apellidoMat,
        correo: user.correo,
        cargo: user.cargo,
        idSuc: user.idSuc,
        nombreSuc: user.nombreSuc,
        estadoEmp: true,
      };
    }
    return null;
  }
}
