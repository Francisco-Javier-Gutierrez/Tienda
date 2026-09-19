import { Productos } from '../../models/productos';
import { ProductoPos } from '../../models/venta';
import { ResumenCajaLocal } from './sqlite-caja.repository';
import { ItemColaSync } from './sqlite-sync-queue.repository';

/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - SQLite Operations Interfaces
 * =========================================================================
 * Interfaces segregadas para operaciones SQLite locales. Cada consumidor
 * (caja, productos, catálogos, sincronizador outbox, login) depende
 * exclusivamente de su contrato correspondiente.
 */

export interface SqliteDatabaseLifecycle {
  readonly disponible: boolean;
  initDB(): Promise<void>;
  hashTexto(texto: string): Promise<string>;
}

export interface SqliteProductoOperations {
  guardarProducto(producto: Productos, offline?: boolean): Promise<void>;
  buscarPorQR(codigoQR: string): Promise<Productos | null>;
  getProductosLocales(): Promise<Productos[]>;
  getPendientesSync(): Promise<Productos[]>;
  marcarSincronizado(idPro: string): Promise<void>;
  sincronizarCatalogo(productos: any[]): Promise<void>;
  guardarProductoPos(producto: ProductoPos): Promise<void>;
  eliminarProductoLocal(idPro: string): Promise<void>;
  guardarProductoOffline(
    producto: any,
    fotoBase64?: string | null,
    fotoNombre?: string | null,
    fotoMime?: string | null,
  ): Promise<{ idProTemporal: number; uuid: string }>;
  reconciliarProductoOffline(idTemporal: number, productoReal: any): Promise<void>;
  reemplazarPorProductoOnline(codigoQR: string, productoOnline: any): Promise<void>;
}

export interface SqliteCatalogoOperations {
  sincronizarMarcas(marcas: any[]): Promise<void>;
  getMarcasLocales(): Promise<any[]>;
  guardarMarcaOffline(dto: { nombre: string; descripcion?: string }): Promise<any>;
  reconciliarMarcaOffline(idTemporal: number, marcaReal: any): Promise<void>;

  sincronizarCategorias(categorias: any[]): Promise<void>;
  getCategoriasLocales(): Promise<any[]>;
  guardarCategoriaOffline(dto: { nombre: string; descripcion?: string }): Promise<any>;
  reconciliarCategoriaOffline(idTemporal: number, categoriaReal: any): Promise<void>;
}

export interface SqliteCajaOperations {
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
  ): Promise<void>;
  cajaLocalAbierta(idEmp: string): Promise<Record<string, unknown> | null>;
  guardarVentaOffline(venta: {
    uuidVenta: string;
    uuidSesionCaja: string;
    empleadoId: string;
    sucursalId: string;
    total: number;
    metodoPago: string;
    montoRecibido: number | null;
    items: Array<{ id: string; nombre: string; cantidad: number; precioUnitario: number; subtotal: number }>;
  }): Promise<void>;
  guardarMovimientoOffline(m: {
    uuidMovimientoCaja: string;
    uuidSesionCaja: string;
    empleadoId: string;
    tipoMovimiento: string;
    monto: number;
    concepto: string;
  }): Promise<void>;
  cerrarCajaOffline(uuidSesionCaja: string, efectivoContado: number, observaciones: string): Promise<void>;
  marcarCajaCerrada(
    uuidSesionCaja: string,
    estadoSync: 'SINCRONIZADA' | 'PENDIENTE',
    cierre?: { fechaHoraCierre?: string | null; efectivoContado?: number | null; observaciones?: string | null },
  ): Promise<void>;
  resumenCajaLocal(uuidSesionCaja: string): Promise<ResumenCajaLocal>;
}

export interface SqliteSyncQueueOperations {
  encolar(tipo: string, uuid: string, payload: unknown, orden: number): Promise<void>;
  pendientesSync(): Promise<ItemColaSync[]>;
  actualizarCola(
    uuid: string,
    estado: 'SINCRONIZADA' | 'CONFLICTO' | 'PENDIENTE',
    error?: string | null,
  ): Promise<void>;
  marcarEntidadSync(
    tipo: string,
    uuid: string,
    estado: 'SINCRONIZADA' | 'CONFLICTO' | 'PENDIENTE',
    error?: string | null,
  ): Promise<void>;
}

export interface SqliteAuthOperations {
  guardarUsuarioOffline(empleado: any, password?: string): Promise<void>;
  verificarUsuarioOffline(correo: string, password: string): Promise<any | null>;
}

export interface SqliteFullOperations
  extends SqliteDatabaseLifecycle,
    SqliteProductoOperations,
    SqliteCatalogoOperations,
    SqliteCajaOperations,
    SqliteSyncQueueOperations,
    SqliteAuthOperations {}
