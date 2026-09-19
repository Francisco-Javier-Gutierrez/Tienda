import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

/**
 * =========================================================================
 * Single Responsibility Principle (SRP) - SQLite Database Manager
 * =========================================================================
 * Responsabilidad única: Gestionar el ciclo de vida de la conexión a la base
 * de datos SQLite nativa, creación de tablas (DDL) y ejecución de migraciones.
 */
@Injectable({
  providedIn: 'root',
})
export class SqliteDatabaseService {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private db?: SQLiteDBConnection;
  private initPromise?: Promise<void>;

  readonly disponible = Capacitor.isNativePlatform();

  initDB(): Promise<void> {
    if (!this.disponible) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = this.inicializarDB().catch((error: unknown) => {
        this.initPromise = undefined;
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`No se pudo inicializar SQLite: ${message}`);
      });
    }

    return this.initPromise;
  }

  async getDB(): Promise<SQLiteDBConnection> {
    await this.initDB();
    return this.obtenerDBInicializada();
  }

  obtenerDBInicializada(): SQLiteDBConnection {
    if (!this.db) {
      throw new Error('SQLite no está inicializada');
    }

    return this.db;
  }

  async hashTexto(texto: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(texto.trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return texto.trim();
    }
  }

  private async inicializarDB(): Promise<void> {
    this.db = await this.sqlite.createConnection('tiendaDB', false, 'no-encryption', 1, false);
    await this.db.open();
    await this.crearTablas();
  }

  private async crearTablas(): Promise<void> {
    const db = this.obtenerDBInicializada();

    const queryProductos = `
      CREATE TABLE IF NOT EXISTS productos (
        idPro TEXT PRIMARY KEY,
        nombrePro TEXT,
        precioVentaPro REAL,
        costoPro REAL,
        existenciaPro INTEGER,
        stockMinimoPro INTEGER,
        tamanoPro TEXT,
        presentacionPro TEXT,
        tipoPro TEXT,
        codigoQR TEXT UNIQUE,
        skuPro TEXT,
        imagenPro TEXT,
        idMarca TEXT,
        idCat TEXT,
        pendienteSync INTEGER DEFAULT 0
      );
    `;

    await db.execute(queryProductos);
    await this.migrarProductos(db);

    const queryVentas = `
      CREATE TABLE IF NOT EXISTS ventas (
        idVenta TEXT PRIMARY KEY AUTOINCREMENT,
        fechaVenta TEXT,
        horaVenta TEXT,
        total REAL,
        idEmp TEXT,
        idSuc TEXT,
        pendienteSync INTEGER DEFAULT 0
      );
    `;

    await db.execute(queryVentas);
    await db.execute(
      `CREATE TABLE IF NOT EXISTS usuarios_offline (
        idEmp TEXT PRIMARY KEY,
        correo TEXT UNIQUE NOT NULL,
        contrasenaHash TEXT NOT NULL,
        nombre TEXT NOT NULL,
        apellidoPat TEXT,
        apellidoMat TEXT,
        cargo TEXT NOT NULL,
        idSuc TEXT NOT NULL,
        nombreSuc TEXT NOT NULL,
        activo INTEGER DEFAULT 1
      );`,
    );
    await this.sembrarAdminOffline(db);
    await db.execute(
      `CREATE TABLE IF NOT EXISTS marcas (
        idMarca TEXT PRIMARY KEY,
        nombreMarca TEXT NOT NULL,
        descripMarca TEXT,
        pendienteSync INTEGER DEFAULT 0
      );`,
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS categorias (
        idCat TEXT PRIMARY KEY,
        nombreCat TEXT NOT NULL,
        descripCat TEXT,
        pendienteSync INTEGER DEFAULT 0
      );`,
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS sesiones_caja_local(uuidSesionCaja TEXT PRIMARY KEY,idSesionCaja TEXT,idEmp TEXT NOT NULL,idSuc TEXT NOT NULL,fechaHoraApertura TEXT NOT NULL,fondoInicial REAL NOT NULL,fechaHoraCierre TEXT,efectivoContado REAL,observaciones TEXT,estado TEXT NOT NULL,estadoSync TEXT NOT NULL DEFAULT 'PENDIENTE',errorSync TEXT)`,
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS ventas_local(uuidVenta TEXT PRIMARY KEY,idVenta TEXT,idSesionCaja TEXT,uuidSesionCaja TEXT NOT NULL,idEmp TEXT NOT NULL,idSuc TEXT NOT NULL,fechaHora TEXT NOT NULL,totalLocal REAL NOT NULL,metodoPago TEXT NOT NULL,montoRecibido REAL,estadoSync TEXT NOT NULL DEFAULT 'PENDIENTE',errorSync TEXT)`,
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS detalles_venta_local(id INTEGER PRIMARY KEY AUTOINCREMENT,uuidVenta TEXT NOT NULL,idPro TEXT NOT NULL,nombre TEXT NOT NULL,cantidad INTEGER NOT NULL,precioLocal REAL NOT NULL,subtotalLocal REAL NOT NULL)`,
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS movimientos_caja_local(uuidMovimientoCaja TEXT PRIMARY KEY,idMovimientoCaja TEXT,uuidSesionCaja TEXT NOT NULL,idEmp TEXT NOT NULL,tipoMovimiento TEXT NOT NULL,monto REAL NOT NULL,concepto TEXT NOT NULL,fechaHora TEXT NOT NULL,estadoSync TEXT NOT NULL DEFAULT 'PENDIENTE',errorSync TEXT)`,
    );
    await db.execute(
      `CREATE TABLE IF NOT EXISTS cola_sync(id INTEGER PRIMARY KEY AUTOINCREMENT,tipo TEXT NOT NULL,uuid TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,orden INTEGER NOT NULL,estado TEXT NOT NULL DEFAULT 'PENDIENTE',error TEXT,creadoEn TEXT NOT NULL)`,
    );
  }

  private async migrarProductos(db: SQLiteDBConnection): Promise<void> {
    const info = await db.query('PRAGMA table_info(productos)');
    const columnas = new Set(
      (info.values || [])
        .map((columna: { name?: string }) => columna.name)
        .filter((nombre): nombre is string => Boolean(nombre)),
    );
    const migraciones: Array<{ nombre: string; sql: string }> = [
      { nombre: 'costoPro', sql: 'ALTER TABLE productos ADD COLUMN costoPro REAL' },
      { nombre: 'stockMinimoPro', sql: 'ALTER TABLE productos ADD COLUMN stockMinimoPro INTEGER' },
      { nombre: 'skuPro', sql: 'ALTER TABLE productos ADD COLUMN skuPro TEXT' },
      { nombre: 'imagenPro', sql: 'ALTER TABLE productos ADD COLUMN imagenPro TEXT' },
    ];
    for (const migracion of migraciones) {
      if (!columnas.has(migracion.nombre)) {
        await db.execute(migracion.sql);
      }
    }
  }

  private async sembrarAdminOffline(db: SQLiteDBConnection): Promise<void> {
    const hashAdmin = await this.hashTexto('admin1234');
    await db.run(
      `INSERT INTO usuarios_offline (
        idEmp, correo, contrasenaHash, nombre, apellidoPat, apellidoMat, cargo, idSuc, nombreSuc, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(correo) DO NOTHING`,
      [
        1,
        'admin@tienda.com',
        hashAdmin,
        'Administrador Offline',
        'Sistema',
        null,
        'ADMINISTRADOR',
        1,
        'Sucursal Central',
      ],
    );
  }
}
