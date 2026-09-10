import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { Productos } from '../models/productos';
import { ProductoPos } from '../models/venta';

@Injectable({
  providedIn: 'root',
})
export class SqliteService {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private db?: SQLiteDBConnection;
  private initPromise?: Promise<void>;

  constructor() {}

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

  private async getDB(): Promise<SQLiteDBConnection> {
    await this.initDB();
    return this.obtenerDBInicializada();
  }

  private obtenerDBInicializada(): SQLiteDBConnection {
    if (!this.db) {
      throw new Error('SQLite no está inicializada');
    }

    return this.db;
  }

  // =========================
  // GUARDAR PRODUCTO
  // =========================
  async guardarProducto(producto: Productos, offline = false) {
    if (!this.disponible) return;
    const db = await this.getDB();

    const query = `
      INSERT INTO productos (
        idPro,
        nombrePro,
        precioVentaPro,
        costoPro,
        existenciaPro,
        stockMinimoPro,
        tamanoPro,
        presentacionPro,
        tipoPro,
        codigoQR,
        skuPro,
        imagenPro,
        idMarca,
        idCat,
        pendienteSync
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(codigoQR) DO UPDATE SET
        idPro = excluded.id,
        nombrePro = excluded.nombre,
        precioVentaPro = excluded.precioVenta,
        costoPro = excluded.costo,
        existenciaPro = excluded.existencia,
        stockMinimoPro = excluded.stockMinimo,
        tamanoPro = excluded.tamano,
        presentacionPro = excluded.presentacion,
        tipoPro = excluded.tipo,
        skuPro = excluded.sku,
        imagenPro = excluded.imagen,
        idMarca = excluded.id,
        idCat = excluded.id,
        pendienteSync = excluded.pendienteSync
      ON CONFLICT(idPro) DO UPDATE SET
        nombrePro = excluded.nombre,
        precioVentaPro = excluded.precioVenta,
        costoPro = excluded.costo,
        existenciaPro = excluded.existencia,
        stockMinimoPro = excluded.stockMinimo,
        tamanoPro = excluded.tamano,
        presentacionPro = excluded.presentacion,
        tipoPro = excluded.tipo,
        codigoQR = excluded.codigoQR,
        skuPro = excluded.sku,
        imagenPro = excluded.imagen,
        idMarca = excluded.id,
        idCat = excluded.id,
        pendienteSync = excluded.pendienteSync
    `;

    await db.run(query, [
      producto.id,
      producto.nombre,
      producto.precioVenta,
      producto.costo,
      producto.existencia,
      producto.stockMinimo,
      producto.tamano,
      producto.presentacion,
      producto.tipo,
      producto.codigoQR,
      producto.sku,
      producto.imagen,
      producto.marca?.id,
      producto.categoria?.id,
      offline ? 1 : 0,
    ]);
  }

  // =========================
  // BUSCAR POR QR LOCAL
  // =========================
  async buscarPorQR(codigoQR: string): Promise<Productos | null> {
    if (!this.disponible) return null;
    const db = await this.getDB();

    const query = `
      SELECT * FROM productos
      WHERE codigoQR = ?
    `;

    const result = await db.query(query, [codigoQR]);

    if (result.values && result.values.length > 0) {
      return result.values[0] as Productos;
    }

    return null;
  }

  // =========================
  // OBTENER PRODUCTOS
  // =========================
  async getProductosLocales(): Promise<Productos[]> {
    if (!this.disponible) return [];
    const db = await this.getDB();

    const result = await db.query(`SELECT * FROM productos`);

    return (result.values as Productos[]) || [];
  }

  // =========================
  // PRODUCTOS PENDIENTES
  // =========================
  async getPendientesSync(): Promise<Productos[]> {
    if (!this.disponible) return [];
    const db = await this.getDB();

    const result = await db.query(`
      SELECT * FROM productos
      WHERE pendienteSync = 1
    `);

    return (result.values as Productos[]) || [];
  }

  // =========================
  // MARCAR SINCRONIZADO
  // =========================
  async marcarSincronizado(idPro: string) {
    if (!this.disponible) return;
    const db = await this.getDB();

    await db.run(
      `
      UPDATE productos
      SET pendienteSync = 0
      WHERE idPro = ?
    `,
      [idPro],
    );
  }
  async sincronizarCatalogo(productos: any[]): Promise<void> {
    if (!this.disponible || !Array.isArray(productos)) return;
    const db = await this.getDB();

    const idsValidos: number[] = [];

    for (const item of productos) {
      const idPro = Number(item.id);
      if (!Number.isInteger(idPro) || idPro <= 0) continue;
      idsValidos.push(idPro);

      const qr = item.codigoQR ? String(item.codigoQR).trim() : null;

      if (qr) {
        await db.run('DELETE FROM productos WHERE codigoQR = ? AND idPro != ?', [qr, idPro]);
      }

      await db.run(
        `INSERT INTO productos (
          idPro,
          nombrePro,
          precioVentaPro,
          costoPro,
          existenciaPro,
          stockMinimoPro,
          tamanoPro,
          presentacionPro,
          tipoPro,
          codigoQR,
          skuPro,
          imagenPro,
          idMarca,
          idCat,
          pendienteSync
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(idPro) DO UPDATE SET
          nombrePro = excluded.nombre,
          precioVentaPro = excluded.precioVenta,
          costoPro = CASE WHEN excluded.costo IS NOT NULL THEN excluded.costo ELSE productos.costo END,
          existenciaPro = excluded.existencia,
          stockMinimoPro = CASE WHEN excluded.stockMinimo IS NOT NULL THEN excluded.stockMinimo ELSE productos.stockMinimo END,
          tamanoPro = excluded.tamano,
          presentacionPro = excluded.presentacion,
          tipoPro = CASE WHEN excluded.tipo IS NOT NULL THEN excluded.tipo ELSE productos.tipo END,
          codigoQR = excluded.codigoQR,
          skuPro = excluded.sku,
          imagenPro = excluded.imagen,
          idMarca = CASE WHEN excluded.id IS NOT NULL THEN excluded.id ELSE productos.id END,
          idCat = CASE WHEN excluded.id IS NOT NULL THEN excluded.id ELSE productos.id END,
          pendienteSync = 0`,
        [
          idPro,
          item.nombre || '',
          item.precioVenta !== undefined && item.precioVenta !== null ? Number(item.precioVenta) : 0,
          item.costo !== undefined && item.costo !== null ? Number(item.costo) : null,
          Number(item.existencia) || 0,
          item.stockMinimo !== undefined && item.stockMinimo !== null ? Number(item.stockMinimo) : null,
          item.tamano || null,
          item.presentacion || null,
          item.tipo || null,
          qr,
          item.sku || null,
          item.imagen || null,
          item.id ? Number(item.id) : null,
          item.id ? Number(item.id) : null,
        ],
      );
    }

    if (idsValidos.length > 0) {
      const placeholders = idsValidos.map(() => '?').join(',');
      await db.run(`DELETE FROM productos WHERE idPro NOT IN (${placeholders}) AND pendienteSync = 0`, idsValidos);
    } else {
      await db.run(`DELETE FROM productos WHERE pendienteSync = 0`);
    }
  }

  async guardarProductoPos(producto: ProductoPos): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    await db.run(
      `INSERT INTO productos(idPro,nombrePro,precioVentaPro,existenciaPro,tamanoPro,presentacionPro,codigoQR,skuPro,imagenPro,pendienteSync) VALUES(?,?,?,?,?,?,?,?,?,0) ON CONFLICT(idPro) DO UPDATE SET nombrePro=excluded.nombre,precioVentaPro=excluded.precioVenta,existenciaPro=excluded.existencia,tamanoPro=excluded.tamano,presentacionPro=excluded.presentacion,codigoQR=excluded.codigoQR,skuPro=excluded.sku,imagenPro=excluded.imagen`,
      [
        producto.id,
        producto.nombre,
        producto.precioVenta,
        producto.existencia,
        producto.tamano,
        producto.presentacion,
        producto.codigoQR,
        producto.sku,
        producto.imagen,
      ],
    );
  }

  async eliminarProductoLocal(idPro: string): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    await db.run('DELETE FROM productos WHERE idPro = ?', [Number(idPro)]);
  }

  async encolar(tipo: string, uuid: string, payload: unknown, orden: number): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    await db.run(
      `INSERT INTO cola_sync(tipo,uuid,payload,orden,estado,creadoEn) VALUES(?,?,?,?, 'PENDIENTE',datetime('now')) ON CONFLICT(uuid) DO NOTHING`,
      [tipo, uuid, JSON.stringify(payload), orden],
    );
  }
  async pendientesSync(): Promise<
    Array<{
      id: string;
      tipo: string;
      uuid: string;
      payload: string;
      orden: number;
      estado: string;
      error: string | null;
    }>
  > {
    if (!this.disponible) return [];
    const db = await this.getDB();
    const r = await db.query(`SELECT * FROM cola_sync WHERE estado IN ('PENDIENTE','CONFLICTO') ORDER BY orden,id`);
    return r.values || [];
  }
  async actualizarCola(
    uuid: string,
    estado: 'SINCRONIZADA' | 'CONFLICTO' | 'PENDIENTE',
    error: string | null = null,
  ): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    await db.run('UPDATE cola_sync SET estado=?,error=? WHERE uuid=?', [estado, error, uuid]);
  }
  async marcarEntidadSync(
    tipo: string,
    uuid: string,
    estado: 'SINCRONIZADA' | 'CONFLICTO' | 'PENDIENTE',
    error: string | null = null,
  ): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    if (tipo === 'VENTA')
      await db.run('UPDATE ventas_local SET estadoSync=?,errorSync=? WHERE uuidVenta=?', [estado, error, uuid]);
    else if (tipo === 'MOVIMIENTO')
      await db.run('UPDATE movimientos_caja_local SET estadoSync=?,errorSync=? WHERE uuidMovimientoCaja=?', [
        estado,
        error,
        uuid,
      ]);
    else if (tipo === 'APERTURA')
      await db.run('UPDATE sesiones_caja_local SET estadoSync=?,errorSync=? WHERE uuidSesionCaja=?', [
        estado,
        error,
        uuid,
      ]);
  }
  async guardarCajaLocal(
    caja: {
      uuidSesionCaja: string;
      id?: string;
      empleadoId: string;
      sucursalId: string;
      fechaHoraApertura: string;
      fondoInicial: number;
      estado: string;
    },
    estadoSync: string,
  ): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    await db.run(
      `INSERT INTO sesiones_caja_local(uuidSesionCaja,idSesionCaja,idEmp,idSuc,fechaHoraApertura,fondoInicial,estado,estadoSync) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(uuidSesionCaja) DO UPDATE SET idSesionCaja=excluded.id,estado=excluded.estado,estadoSync=excluded.estadoSync`,
      [
        caja.uuidSesionCaja,
        caja.id || null,
        caja.empleadoId,
        caja.sucursalId,
        caja.fechaHoraApertura,
        caja.fondoInicial,
        caja.estado,
        estadoSync,
      ],
    );
  }
  async cajaLocalAbierta(idEmp: string): Promise<Record<string, unknown> | null> {
    if (!this.disponible) return null;
    const db = await this.getDB();
    const r = await db.query(
      `SELECT * FROM sesiones_caja_local WHERE idEmp=? AND estado='ABIERTA' ORDER BY fechaHoraApertura DESC LIMIT 1`,
      [idEmp],
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
    const db = await this.getDB();
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
    const db = await this.getDB();
    await db.run(
      `INSERT INTO movimientos_caja_local(uuidMovimientoCaja,uuidSesionCaja,idEmp,tipoMovimiento,monto,concepto,fechaHora,estadoSync) VALUES(?,?,?,?,?,?,datetime('now'),'PENDIENTE') ON CONFLICT(uuidMovimientoCaja) DO NOTHING`,
      [m.uuidMovimientoCaja, m.uuidSesionCaja, m.empleadoId, m.tipoMovimiento, m.monto, m.concepto],
    );
  }
  async cerrarCajaOffline(uuidSesionCaja: string, efectivoContado: number, observaciones: string): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
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
    const db = await this.getDB();
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
  async resumenCajaLocal(uuidSesionCaja: string): Promise<{
    totalVentas: number;
    totalEfectivo: number;
    totalTarjeta: number;
    totalTransferencia: number;
    totalIngresos: number;
    totalRetiros: number;
    numeroVentas: number;
  }> {
    if (!this.disponible)
      return {
        totalVentas: 0,
        totalEfectivo: 0,
        totalTarjeta: 0,
        totalTransferencia: 0,
        totalIngresos: 0,
        totalRetiros: 0,
        numeroVentas: 0,
      };
    const db = await this.getDB();
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

  // =========================
  // USUARIOS OFFLINE
  // =========================
  async guardarUsuarioOffline(empleado: any, password?: string): Promise<void> {
    if (!this.disponible || !empleado) return;
    const db = await this.getDB();
    const hash = password ? await this.hashTexto(password) : await this.hashTexto('admin1234');
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
        idSuc = excluded.sucursalId,
        nombreSuc = excluded.nombreSuc,
        activo = 1`,
      [
        Number(empleado.id) || 1,
        correo,
        hash,
        empleado.nombreEmp || empleado.nombre || 'Usuario',
        empleado.apellidoPatEmp || null,
        empleado.apellidoMatEmp || null,
        empleado.cargo || 'ADMINISTRADOR',
        Number(empleado.sucursalId) || 1,
        empleado.nombreSuc || 'Sucursal Central',
      ],
    );
  }

  async verificarUsuarioOffline(correo: string, password: string): Promise<any | null> {
    if (!this.disponible) return null;
    const db = await this.getDB();
    const c = correo.trim().toLowerCase();
    const res = await db.query(`SELECT * FROM usuarios_offline WHERE correo = ? AND activo = 1`, [c]);
    if (!res.values || res.values.length === 0) return null;

    const user = res.values[0];
    const hashIngresado = await this.hashTexto(password);

    if (user.contrasenaHash === hashIngresado || user.contrasenaHash === password.trim()) {
      return {
        idEmp: user.id,
        nombre: [user.nombre, user.apellidoPat, user.apellidoMat].filter(Boolean).join(' '),
        nombreEmp: user.nombre,
        apellidoPatEmp: user.apellidoPat,
        apellidoMatEmp: user.apellidoMat,
        correo: user.correo,
        cargo: user.cargo,
        idSuc: user.sucursalId,
        nombreSuc: user.nombreSuc,
        estadoEmp: true,
      };
    }
    return null;
  }

  // =========================
  // CREACIÓN Y RECONCILIACIÓN OFFLINE DE PRODUCTOS
  // =========================
  async guardarProductoOffline(
    producto: any,
    fotoBase64?: string | null,
    fotoNombre?: string | null,
    fotoMime?: string | null,
  ): Promise<{ idProTemporal: number; uuid: string }> {
    if (!this.disponible) throw new Error('SQLite no disponible');
    const db = await this.getDB();

    const idTemp = producto.id && producto.id < 0 ? producto.id : -Math.floor(Date.now() / 1000);
    const uuid = `PROD-${Math.abs(idTemp)}-${Date.now()}`;

    await db.run(
      `INSERT INTO productos (
        idPro, nombrePro, precioVentaPro, costoPro, existenciaPro, stockMinimoPro,
        tamanoPro, presentacionPro, tipoPro, codigoQR, skuPro, imagenPro, idMarca, idCat, pendienteSync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(idPro) DO UPDATE SET
        nombrePro = excluded.nombre,
        precioVentaPro = excluded.precioVenta,
        costoPro = excluded.costo,
        existenciaPro = excluded.existencia,
        stockMinimoPro = excluded.stockMinimo,
        tamanoPro = excluded.tamano,
        presentacionPro = excluded.presentacion,
        tipoPro = excluded.tipo,
        codigoQR = excluded.codigoQR,
        skuPro = excluded.sku,
        imagenPro = excluded.imagen,
        idMarca = excluded.id,
        idCat = excluded.id,
        pendienteSync = 1`,
      [
        idTemp,
        producto.nombre || producto.nombre || '',
        Number(producto.precio ?? producto.precioVenta ?? 0),
        producto.costo !== null && producto.costo !== undefined ? Number(producto.costo ?? producto.costo) : null,
        Number(producto.existencia ?? producto.existencia ?? 0),
        producto.stockMinimo !== null && producto.stockMinimo !== undefined ? Number(producto.stockMinimo ?? producto.stockMinimo) : null,
        producto.tamano || producto.tamano || null,
        producto.presentacion || producto.presentacion || null,
        producto.tipo || producto.tipo || null,
        producto.codigoQR ? String(producto.codigoQR).trim() : null,
        producto.sku || producto.sku || null,
        fotoBase64 || producto.imagen || producto.imagen || null,
        producto.marca?.id ? Number(producto.marca?.id) : null,
        producto.categoria?.id ? Number(producto.categoria?.id) : null,
      ],
    );

    await this.encolar('PRODUCTO_CREAR', uuid, {
      tempId: idTemp,
      dto: {
        nombre: producto.nombre || producto.nombre,
        precio: Number(producto.precio ?? producto.precioVenta ?? 0),
        costo: producto.costo !== null && producto.costo !== undefined ? Number(producto.costo ?? producto.costo) : null,
        existencia: Number(producto.existencia ?? producto.existencia ?? 0),
        stockMinimo: producto.stockMinimo !== null && producto.stockMinimo !== undefined ? Number(producto.stockMinimo ?? producto.stockMinimo) : null,
        tamano: producto.tamano || producto.tamano || null,
        presentacion: producto.presentacion || producto.presentacion || null,
        tipo: producto.tipo || producto.tipo || null,
        codigoQR: producto.codigoQR ? String(producto.codigoQR).trim() : null,
        sku: producto.sku || producto.sku || null,
        idMarca: producto.marca?.id ? Number(producto.marca?.id) : null,
        idCat: producto.categoria?.id ? Number(producto.categoria?.id) : null,
      },
      fotoBase64: fotoBase64 || null,
      fotoNombre: fotoNombre || 'producto.jpg',
      fotoMime: fotoMime || 'image/jpeg',
    }, 5);

    return { idProTemporal: idTemp, uuid };
  }

  async reconciliarProductoOffline(idTemporal: number, productoReal: any): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    await db.run(`DELETE FROM productos WHERE idPro = ?`, [idTemporal]);
    await db.run(
      `INSERT INTO productos (
        idPro, nombrePro, precioVentaPro, costoPro, existenciaPro, stockMinimoPro,
        tamanoPro, presentacionPro, tipoPro, codigoQR, skuPro, imagenPro, idMarca, idCat, pendienteSync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(idPro) DO UPDATE SET
        nombrePro = excluded.nombre,
        precioVentaPro = excluded.precioVenta,
        costoPro = excluded.costo,
        existenciaPro = excluded.existencia,
        stockMinimoPro = excluded.stockMinimo,
        tamanoPro = excluded.tamano,
        presentacionPro = excluded.presentacion,
        tipoPro = excluded.tipo,
        codigoQR = excluded.codigoQR,
        skuPro = excluded.sku,
        imagenPro = excluded.imagen,
        idMarca = excluded.id,
        idCat = excluded.id,
        pendienteSync = 0`,
      [
        Number(productoReal.id),
        productoReal.nombre,
        Number(productoReal.precioVenta || 0),
        productoReal.costo !== null && productoReal.costo !== undefined ? Number(productoReal.costo) : null,
        Number(productoReal.existencia || 0),
        productoReal.stockMinimo !== null && productoReal.stockMinimo !== undefined ? Number(productoReal.stockMinimo) : null,
        productoReal.tamano || null,
        productoReal.presentacion || null,
        productoReal.tipo || null,
        productoReal.codigoQR || null,
        productoReal.sku || null,
        productoReal.imagen || null,
        productoReal.id ? Number(productoReal.id) : null,
        productoReal.id ? Number(productoReal.id) : null,
      ],
    );
  }

  async reemplazarPorProductoOnline(codigoQR: string, productoOnline: any): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    if (codigoQR) {
      await db.run(`DELETE FROM productos WHERE codigoQR = ? AND (idPro < 0 OR pendienteSync = 1)`, [codigoQR]);
    }
    await this.reconciliarProductoOffline(productoOnline.id, productoOnline);
  }

  // =========================
  // MARCAS
  // =========================
  async sincronizarMarcas(marcas: any[]): Promise<void> {
    if (!this.disponible || !Array.isArray(marcas)) return;
    const db = await this.getDB();
    const idsValidos: number[] = [];

    for (const m of marcas) {
      const idMarca = Number(m.id);
      if (!Number.isInteger(idMarca) || idMarca <= 0) continue;
      idsValidos.push(idMarca);

      await db.run(
        `INSERT INTO marcas (idMarca, nombreMarca, descripMarca, pendienteSync)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(idMarca) DO UPDATE SET
           nombreMarca = excluded.nombre,
           descripMarca = excluded.descripMarca,
           pendienteSync = 0`,
        [idMarca, m.nombre || '', m.descripMarca || null],
      );
    }

    if (idsValidos.length > 0) {
      const placeholders = idsValidos.map(() => '?').join(',');
      await db.run(`DELETE FROM marcas WHERE idMarca NOT IN (${placeholders}) AND pendienteSync = 0`, idsValidos);
    }
  }

  async getMarcasLocales(): Promise<any[]> {
    if (!this.disponible) return [];
    const db = await this.getDB();
    const r = await db.query(`SELECT * FROM marcas ORDER BY nombreMarca ASC`);
    return r.values || [];
  }

  async guardarMarcaOffline(dto: { nombre: string; descripcion?: string }): Promise<any> {
    if (!this.disponible) throw new Error('SQLite no disponible');
    const db = await this.getDB();
    const idTemp = -Math.floor(Date.now() / 1000);
    const uuid = `MARCA-${Math.abs(idTemp)}-${Date.now()}`;

    await db.run(
      `INSERT INTO marcas (idMarca, nombreMarca, descripMarca, pendienteSync)
       VALUES (?, ?, ?, 1)`,
      [idTemp, dto.nombre.trim(), dto.descripcion?.trim() || null],
    );

    await this.encolar('MARCA_CREAR', uuid, {
      tempId: idTemp,
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || '',
    }, 2);

    return {
      idMarca: idTemp,
      nombreMarca: dto.nombre.trim(),
      descripMarca: dto.descripcion?.trim() || null,
      pendienteSync: 1,
    };
  }

  async reconciliarMarcaOffline(idTemporal: number, marcaReal: any): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    await db.run(`DELETE FROM marcas WHERE idMarca = ?`, [idTemporal]);
    await db.run(
      `INSERT INTO marcas (idMarca, nombreMarca, descripMarca, pendienteSync)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(idMarca) DO UPDATE SET
         nombreMarca = excluded.nombre,
         descripMarca = excluded.descripMarca,
         pendienteSync = 0`,
      [Number(marcaReal.id), marcaReal.nombre, marcaReal.descripMarca || null],
    );
    await db.run(`UPDATE productos SET idMarca = ? WHERE idMarca = ?`, [Number(marcaReal.id), idTemporal]);
  }

  // =========================
  // CATEGORIAS
  // =========================
  async sincronizarCategorias(categorias: any[]): Promise<void> {
    if (!this.disponible || !Array.isArray(categorias)) return;
    const db = await this.getDB();
    const idsValidos: number[] = [];

    for (const c of categorias) {
      const idCat = Number(c.id);
      if (!Number.isInteger(idCat) || idCat <= 0) continue;
      idsValidos.push(idCat);

      await db.run(
        `INSERT INTO categorias (idCat, nombreCat, descripCat, pendienteSync)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(idCat) DO UPDATE SET
           nombreCat = excluded.nombre,
           descripCat = excluded.descripCat,
           pendienteSync = 0`,
        [idCat, c.nombre || '', c.descripCat || null],
      );
    }

    if (idsValidos.length > 0) {
      const placeholders = idsValidos.map(() => '?').join(',');
      await db.run(`DELETE FROM categorias WHERE idCat NOT IN (${placeholders}) AND pendienteSync = 0`, idsValidos);
    }
  }

  async getCategoriasLocales(): Promise<any[]> {
    if (!this.disponible) return [];
    const db = await this.getDB();
    const r = await db.query(`SELECT * FROM categorias ORDER BY nombreCat ASC`);
    return r.values || [];
  }

  async guardarCategoriaOffline(dto: { nombre: string; descripcion?: string }): Promise<any> {
    if (!this.disponible) throw new Error('SQLite no disponible');
    const db = await this.getDB();
    const idTemp = -Math.floor(Date.now() / 1000);
    const uuid = `CAT-${Math.abs(idTemp)}-${Date.now()}`;

    await db.run(
      `INSERT INTO categorias (idCat, nombreCat, descripCat, pendienteSync)
       VALUES (?, ?, ?, 1)`,
      [idTemp, dto.nombre.trim(), dto.descripcion?.trim() || null],
    );

    await this.encolar('CATEGORIA_CREAR', uuid, {
      tempId: idTemp,
      nombre: dto.nombre.trim(),
      descripcion: dto.descripcion?.trim() || '',
    }, 2);

    return {
      idCat: idTemp,
      nombreCat: dto.nombre.trim(),
      descripCat: dto.descripcion?.trim() || null,
      pendienteSync: 1,
    };
  }

  async reconciliarCategoriaOffline(idTemporal: number, categoriaReal: any): Promise<void> {
    if (!this.disponible) return;
    const db = await this.getDB();
    await db.run(`DELETE FROM categorias WHERE idCat = ?`, [idTemporal]);
    await db.run(
      `INSERT INTO categorias (idCat, nombreCat, descripCat, pendienteSync)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(idCat) DO UPDATE SET
         nombreCat = excluded.nombre,
         descripCat = excluded.descripCat,
         pendienteSync = 0`,
      [Number(categoriaReal.id), categoriaReal.nombre, categoriaReal.descripCat || null],
    );
    await db.run(`UPDATE productos SET idCat = ? WHERE idCat = ?`, [Number(categoriaReal.id), idTemporal]);
  }
}





