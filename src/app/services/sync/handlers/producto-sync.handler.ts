import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Producto } from '../../../models/productos';
import { ProductosService } from '../../productos.service';
import { SqliteService } from '../../sqlite.service';
import { ItemColaSync } from '../../sqlite/sqlite-sync-queue.repository';
import { SyncOperationHandler } from '../sync-handler.interface';

/**
 * =========================================================================
 * Open/Closed Principle (OCP) - Producto Sync Handler
 * =========================================================================
 * Estrategia de sincronización para operaciones 'PRODUCTO_CREAR', con
 * resolución de conflictos (Preferencia Online) y carga de imágenes a S3.
 */
@Injectable({
  providedIn: 'root',
})
export class ProductoSyncHandler implements SyncOperationHandler {
  readonly tipo = 'PRODUCTO_CREAR';

  private readonly productos = inject(ProductosService);
  private readonly sqlite = inject(SqliteService);

  async ejecutar(op: ItemColaSync, payload: any): Promise<void> {
    let productoOnline: Producto | null = null;
    if (payload.dto?.codigoQR) {
      try {
        productoOnline = await firstValueFrom(this.productos.getByQR(payload.dto.codigoQR));
      } catch {
        productoOnline = null;
      }
    }

    if (productoOnline) {
      // Preferencia Online: si ya existe en el servidor, sobreescribir SQLite con la versión online
      await this.sqlite.reemplazarPorProductoOnline(payload.dto.codigoQR, productoOnline);
      return;
    }

    // No existe online: crear producto en backend
    let productoCreado: Producto;
    try {
      productoCreado = await firstValueFrom(this.productos.addProducto(payload.dto));
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse && err.status === 409 && payload.dto?.codigoQR) {
        // Conflicto de QR: consultar producto online y resolver a favor de online
        const onlineExistente = await firstValueFrom(this.productos.getByQR(payload.dto.codigoQR));
        if (onlineExistente) {
          await this.sqlite.reemplazarPorProductoOnline(payload.dto.codigoQR, onlineExistente);
          return;
        }
      }
      throw err;
    }

    let productoFinal = productoCreado;
    if (payload.fotoBase64) {
      try {
        const blob = this.base64ABlob(payload.fotoBase64, payload.fotoMime || 'image/jpeg');
        productoFinal = await firstValueFrom(
          this.productos.subirImagen(productoCreado.id, blob, payload.fotoNombre || 'producto.jpg'),
        );
      } catch (fotoError) {
        console.error('Error al subir foto a S3 durante sincronización:', fotoError);
      }
    }

    await this.sqlite.reconciliarProductoOffline(payload.tempId, productoFinal);
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
}
