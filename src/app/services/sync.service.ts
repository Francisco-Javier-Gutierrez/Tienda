import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Categoria } from '../models/categoria';
import { Marca } from '../models/marca';
import { Producto } from '../models/productos';
import { CrearVentaDto } from '../models/venta';
import { AuthService } from './auth.service';
import { CajaService } from './caja.service';
import { CatalogosService } from './catalogos.service';
import { ProductosService } from './productos.service';
import { SqliteService } from './sqlite.service';
import { VentaService } from './venta.service';
export interface EstadoSync {
  conectado: boolean;
  pendientes: number;
  conflictos: number;
  sincronizando: boolean;
}
@Injectable({ providedIn: 'root' })
export class SyncService {
  private sqlite = inject(SqliteService);
  private cajas = inject(CajaService);
  private ventas = inject(VentaService);
  private productos = inject(ProductosService);
  private catalogos = inject(CatalogosService);
  private auth = inject(AuthService);
  private subject = new BehaviorSubject<EstadoSync>({
    conectado: true,
    pendientes: 0,
    conflictos: 0,
    sincronizando: false,
  });
  readonly estado$ = this.subject.asObservable();
  private ejecutando = false;
  private timerDebounce: ReturnType<typeof setTimeout> | null = null;
  constructor() {
    if (this.sqlite.disponible) {
      void this.iniciar();
    }
  }
  private async iniciar(): Promise<void> {
    await this.sqlite.initDB();
    const estado = await Network.getStatus();
    this.actualizar({ conectado: estado.connected });
    await this.refrescarContadores();
    await Network.addListener('networkStatusChange', (s) => {
      this.actualizar({ conectado: s.connected });
      if (s.connected) {
        if (this.timerDebounce) clearTimeout(this.timerDebounce);
        this.timerDebounce = setTimeout(() => {
          void this.sincronizarPendientes();
        }, 1000);
      }
    });
    if (estado.connected) void this.sincronizarPendientes();
  }
  async obtenerPendientes() {
    return this.sqlite.pendientesSync();
  }
  async obtenerConflictos() {
    return (await this.sqlite.pendientesSync()).filter((x) => x.estado === 'CONFLICTO');
  }
  async reintentar(): Promise<void> {
    await this.sincronizarPendientes();
  }
  estadoConexion(): EstadoSync {
    return this.subject.value;
  }
  async sincronizarPendientes(): Promise<void> {
    if (this.ejecutando || !this.sqlite.disponible || !this.subject.value.conectado || !this.auth.token) return;

    if (this.auth.token.startsWith('offline-token-')) {
      const reautenticado = await this.auth.reautenticarSiEsNecesario();
      if (!reautenticado) {
        return;
      }
    }

    const colaInicial = await this.sqlite.pendientesSync();
    const pendientes = colaInicial.filter((x) => x.estado === 'PENDIENTE');
    if (pendientes.length === 0) {
      return;
    }

    this.ejecutando = true;
    this.actualizar({ sincronizando: true });
    try {
      for (const op of pendientes) {
        try {
          const p = JSON.parse(op.payload);
          if (op.tipo === 'MARCA_CREAR') {
            let marcaReal: Marca;
            try {
              marcaReal = await firstValueFrom(
                this.catalogos.crearMarca({ nombre: p.nombre, descripcion: p.descripcion }),
              );
            } catch (err: unknown) {
              if (err instanceof HttpErrorResponse && err.status === 409) {
                const marcas = await firstValueFrom(this.catalogos.getMarcas());
                const encontrada = marcas.find(
                  (m) => (m.nombre || '').toLowerCase() === p.nombre.toLowerCase(),
                );
                if (encontrada) marcaReal = encontrada;
                else throw err;
              } else {
                throw err;
              }
            }
            await this.sqlite.reconciliarMarcaOffline(p.tempId, marcaReal);
          } else if (op.tipo === 'CATEGORIA_CREAR') {
            let catReal: Categoria;
            try {
              catReal = await firstValueFrom(
                this.catalogos.crearCategoria({ nombre: p.nombre, descripcion: p.descripcion }),
              );
            } catch (err: unknown) {
              if (err instanceof HttpErrorResponse && err.status === 409) {
                const cats = await firstValueFrom(this.catalogos.getCategorias());
                const encontrada = cats.find((c) => (c.nombre || '').toLowerCase() === p.nombre.toLowerCase());
                if (encontrada) catReal = encontrada;
                else throw err;
              } else {
                throw err;
              }
            }
            await this.sqlite.reconciliarCategoriaOffline(p.tempId, catReal);
          } else if (op.tipo === 'APERTURA') await firstValueFrom(this.cajas.abrir(p.uuidSesionCaja, p.fondoInicial));
          else if (op.tipo === 'MOVIMIENTO')
            await firstValueFrom(
              this.cajas.registrarMovimiento(p.uuidMovimientoCaja, p.tipoMovimiento, p.monto, p.concepto),
            );
          else if (op.tipo === 'PRODUCTO_CREAR') {
            let productoOnline: Producto | null = null;
            if (p.dto?.codigoQR) {
              try {
                productoOnline = await firstValueFrom(this.productos.getByQR(p.dto.codigoQR));
              } catch {
                productoOnline = null;
              }
            }

            if (productoOnline) {
              // Preferencia Online: si ya existe en el servidor, sobreescribir SQLite con la versión online
              await this.sqlite.reemplazarPorProductoOnline(p.dto.codigoQR, productoOnline);
            } else {
              // No existe online: crear producto en backend
              let productoCreado: Producto;
              try {
                productoCreado = await firstValueFrom(this.productos.addProducto(p.dto));
              } catch (err: unknown) {
                if (err instanceof HttpErrorResponse && err.status === 409 && p.dto?.codigoQR) {
                  // Conflicto de QR: consultar producto online y resolver a favor de online
                  const onlineExistente = await firstValueFrom(this.productos.getByQR(p.dto.codigoQR));
                  if (onlineExistente) {
                    await this.sqlite.reemplazarPorProductoOnline(p.dto.codigoQR, onlineExistente);
                    await this.sqlite.actualizarCola(op.uuid, 'SINCRONIZADA');
                    continue;
                  }
                }
                throw err;
              }

              let productoFinal = productoCreado;
              if (p.fotoBase64) {
                try {
                  const blob = this.base64ABlob(p.fotoBase64, p.fotoMime || 'image/jpeg');
                  productoFinal = await firstValueFrom(
                    this.productos.subirImagen(productoCreado.id, blob, p.fotoNombre || 'producto.jpg'),
                  );
                } catch (fotoError) {
                  console.error('Error al subir foto a S3 durante sincronización:', fotoError);
                }
              }

              await this.sqlite.reconciliarProductoOffline(p.tempId, productoFinal);
            }
          }
          else if (op.tipo === 'VENTA') await firstValueFrom(this.ventas.cobrar(p as CrearVentaDto));
          else if (op.tipo === 'CIERRE') {
            if ((await this.sqlite.pendientesSync()).some((x) => x.id < op.id && x.estado !== 'SINCRONIZADA')) break;
            const caja = await firstValueFrom(this.cajas.cerrar(p.efectivoContado, p.observaciones));
            await this.sqlite.marcarCajaCerrada(p.uuidSesionCaja, 'SINCRONIZADA', caja);
          }
          await this.sqlite.actualizarCola(op.uuid, 'SINCRONIZADA');
          await this.sqlite.marcarEntidadSync(op.tipo, op.uuid, 'SINCRONIZADA');
        } catch (e) {
          if (e instanceof HttpErrorResponse && e.status === 401) break;
          const conflicto = e instanceof HttpErrorResponse && e.status === 409 && op.tipo === 'VENTA',
            mensaje = e instanceof HttpErrorResponse ? e.error?.message || e.message : String(e);
          await this.sqlite.actualizarCola(op.uuid, conflicto ? 'CONFLICTO' : 'PENDIENTE', mensaje);
          await this.sqlite.marcarEntidadSync(op.tipo, op.uuid, conflicto ? 'CONFLICTO' : 'PENDIENTE', mensaje);
          if (conflicto) continue;
          break;
        }
      }
      if (!(await this.sqlite.pendientesSync()).some((x) => x.estado === 'PENDIENTE')) await this.refrescarCatalogo();
    } finally {
      this.ejecutando = false;
      this.actualizar({ sincronizando: false });
      await this.refrescarContadores();
    }
  }

  private base64ABlob(base64Data: string, mimeType = 'image/jpeg'): Blob {
    const arr = base64Data.split(',');
    const bstr = atob(arr[arr.length - 1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mimeType });
  }
  private async refrescarCatalogo(): Promise<void> {
    try {
      const productos = await firstValueFrom(this.ventas.productos());
      await this.sqlite.sincronizarCatalogo(productos);
    } catch {
      /* Se conserva el catálogo local. */
    }
  }
  private async refrescarContadores(): Promise<void> {
    const p = await this.sqlite.pendientesSync();
    this.actualizar({
      pendientes: p.filter((x) => x.estado === 'PENDIENTE').length,
      conflictos: p.filter((x) => x.estado === 'CONFLICTO').length,
    });
  }
  private actualizar(p: Partial<EstadoSync>): void {
    this.subject.next({ ...this.subject.value, ...p });
  }
}
