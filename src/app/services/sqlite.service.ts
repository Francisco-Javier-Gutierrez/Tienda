import { inject, Injectable } from '@angular/core';
import { Productos } from '../models/productos';
import { ProductoPos } from '../models/venta';
import {
  SqliteDatabaseService,
  SqliteProductoRepository,
  SqliteCatalogoRepository,
  SqliteCajaRepository,
  SqliteSyncQueueRepository,
  SqliteAuthRepository,
  ItemColaSync,
  ResumenCajaLocal,
} from './sqlite';

export { ItemColaSync, ResumenCajaLocal };

/**
 * =========================================================================
 * Single Responsibility Principle (SRP) - SQLite Service Facade
 * =========================================================================
 * Responsabilidad única: Actuar como Fachada (Facade) unificada y punto de
 * coordinación para los componentes de la aplicación, delegando las
 * responsabilidades de dominio específicas a sus respectivos repositorios:
 * - SqliteDatabaseService: Ciclo de vida y migraciones DDL.
 * - SqliteProductoRepository: Persistencia y consultas de productos.
 * - SqliteCatalogoRepository: Persistencia de marcas y categorías.
 * - SqliteCajaRepository: Sesiones, ventas y movimientos de caja.
 * - SqliteSyncQueueRepository: Gestión de la cola Outbox ('cola_sync').
 * - SqliteAuthRepository: Credenciales y autenticación offline.
 */
import { SqliteFullOperations } from './sqlite/sqlite-operations.interface';

@Injectable({
  providedIn: 'root',
})
export class SqliteService implements SqliteFullOperations {
  private readonly dbService = inject(SqliteDatabaseService);
  private readonly productoRepo = inject(SqliteProductoRepository);
  private readonly catalogoRepo = inject(SqliteCatalogoRepository);
  private readonly cajaRepo = inject(SqliteCajaRepository);
  private readonly syncQueueRepo = inject(SqliteSyncQueueRepository);
  private readonly authRepo = inject(SqliteAuthRepository);

  get disponible(): boolean {
    return this.dbService.disponible;
  }

  // =========================
  // BASE DE DATOS Y LIFECYCLE
  // =========================
  initDB(): Promise<void> {
    return this.dbService.initDB();
  }

  hashTexto(texto: string): Promise<string> {
    return this.dbService.hashTexto(texto);
  }

  // =========================
  // PRODUCTOS
  // =========================
  guardarProducto(producto: Productos, offline = false): Promise<void> {
    return this.productoRepo.guardarProducto(producto, offline);
  }

  buscarPorQR(codigoQR: string): Promise<Productos | null> {
    return this.productoRepo.buscarPorQR(codigoQR);
  }

  getProductosLocales(): Promise<Productos[]> {
    return this.productoRepo.getProductosLocales();
  }

  getPendientesSync(): Promise<Productos[]> {
    return this.productoRepo.getPendientesSync();
  }

  marcarSincronizado(idPro: string): Promise<void> {
    return this.productoRepo.marcarSincronizado(idPro);
  }

  sincronizarCatalogo(productos: any[]): Promise<void> {
    return this.productoRepo.sincronizarCatalogo(productos);
  }

  guardarProductoPos(producto: ProductoPos): Promise<void> {
    return this.productoRepo.guardarProductoPos(producto);
  }

  eliminarProductoLocal(idPro: string): Promise<void> {
    return this.productoRepo.eliminarProductoLocal(idPro);
  }

  guardarProductoOffline(
    producto: any,
    fotoBase64?: string | null,
    fotoNombre?: string | null,
    fotoMime?: string | null,
  ): Promise<{ idProTemporal: number; uuid: string }> {
    return this.productoRepo.guardarProductoOffline(producto, fotoBase64, fotoNombre, fotoMime);
  }

  reconciliarProductoOffline(idTemporal: number, productoReal: any): Promise<void> {
    return this.productoRepo.reconciliarProductoOffline(idTemporal, productoReal);
  }

  reemplazarPorProductoOnline(codigoQR: string, productoOnline: any): Promise<void> {
    return this.productoRepo.reemplazarPorProductoOnline(codigoQR, productoOnline);
  }

  // =========================
  // COLA SYNC (OUTBOX)
  // =========================
  encolar(tipo: string, uuid: string, payload: unknown, orden: number): Promise<void> {
    return this.syncQueueRepo.encolar(tipo, uuid, payload, orden);
  }

  pendientesSync(): Promise<ItemColaSync[]> {
    return this.syncQueueRepo.pendientesSync();
  }

  actualizarCola(
    uuid: string,
    estado: 'SINCRONIZADA' | 'CONFLICTO' | 'PENDIENTE',
    error: string | null = null,
  ): Promise<void> {
    return this.syncQueueRepo.actualizarCola(uuid, estado, error);
  }

  marcarEntidadSync(
    tipo: string,
    uuid: string,
    estado: 'SINCRONIZADA' | 'CONFLICTO' | 'PENDIENTE',
    error: string | null = null,
  ): Promise<void> {
    return this.syncQueueRepo.marcarEntidadSync(tipo, uuid, estado, error);
  }

  // =========================
  // CAJA Y POS LOCAL
  // =========================
  guardarCajaLocal(
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
    return this.cajaRepo.guardarCajaLocal(caja, estadoSync);
  }

  cajaLocalAbierta(idEmp: string): Promise<Record<string, unknown> | null> {
    return this.cajaRepo.cajaLocalAbierta(idEmp);
  }

  guardarVentaOffline(venta: {
    uuidVenta: string;
    uuidSesionCaja: string;
    empleadoId: string;
    sucursalId: string;
    total: number;
    metodoPago: string;
    montoRecibido: number | null;
    items: Array<{ id: string; nombre: string; cantidad: number; precioUnitario: number; subtotal: number }>;
  }): Promise<void> {
    return this.cajaRepo.guardarVentaOffline(venta);
  }

  guardarMovimientoOffline(m: {
    uuidMovimientoCaja: string;
    uuidSesionCaja: string;
    empleadoId: string;
    tipoMovimiento: string;
    monto: number;
    concepto: string;
  }): Promise<void> {
    return this.cajaRepo.guardarMovimientoOffline(m);
  }

  cerrarCajaOffline(uuidSesionCaja: string, efectivoContado: number, observaciones: string): Promise<void> {
    return this.cajaRepo.cerrarCajaOffline(uuidSesionCaja, efectivoContado, observaciones);
  }

  marcarCajaCerrada(
    uuidSesionCaja: string,
    estadoSync: 'SINCRONIZADA' | 'PENDIENTE',
    cierre?: { fechaHoraCierre?: string | null; efectivoContado?: number | null; observaciones?: string | null },
  ): Promise<void> {
    return this.cajaRepo.marcarCajaCerrada(uuidSesionCaja, estadoSync, cierre);
  }

  resumenCajaLocal(uuidSesionCaja: string): Promise<ResumenCajaLocal> {
    return this.cajaRepo.resumenCajaLocal(uuidSesionCaja);
  }

  // =========================
  // USUARIOS OFFLINE
  // =========================
  guardarUsuarioOffline(empleado: any, password?: string): Promise<void> {
    return this.authRepo.guardarUsuarioOffline(empleado, password);
  }

  verificarUsuarioOffline(correo: string, password: string): Promise<any | null> {
    return this.authRepo.verificarUsuarioOffline(correo, password);
  }

  // =========================
  // MARCAS
  // =========================
  sincronizarMarcas(marcas: any[]): Promise<void> {
    return this.catalogoRepo.sincronizarMarcas(marcas);
  }

  getMarcasLocales(): Promise<any[]> {
    return this.catalogoRepo.getMarcasLocales();
  }

  guardarMarcaOffline(dto: { nombre: string; descripcion?: string }): Promise<any> {
    return this.catalogoRepo.guardarMarcaOffline(dto);
  }

  reconciliarMarcaOffline(idTemporal: number, marcaReal: any): Promise<void> {
    return this.catalogoRepo.reconciliarMarcaOffline(idTemporal, marcaReal);
  }

  // =========================
  // CATEGORIAS
  // =========================
  sincronizarCategorias(categorias: any[]): Promise<void> {
    return this.catalogoRepo.sincronizarCategorias(categorias);
  }

  getCategoriasLocales(): Promise<any[]> {
    return this.catalogoRepo.getCategoriasLocales();
  }

  guardarCategoriaOffline(dto: { nombre: string; descripcion?: string }): Promise<any> {
    return this.catalogoRepo.guardarCategoriaOffline(dto);
  }

  reconciliarCategoriaOffline(idTemporal: number, categoriaReal: any): Promise<void> {
    return this.catalogoRepo.reconciliarCategoriaOffline(idTemporal, categoriaReal);
  }
}
