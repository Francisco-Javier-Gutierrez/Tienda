import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { SqliteService } from './sqlite.service';
import { VentaService } from './venta.service';
import { SyncHandlerRegistry } from './sync/sync-handler.registry';

export interface EstadoSync {
  conectado: boolean;
  pendientes: number;
  conflictos: number;
  sincronizando: boolean;
}

/**
 * =========================================================================
 * Open/Closed Principle (OCP) - Sync Service Orquestador
 * =========================================================================
 * Orquestador principal de sincronización. Cerrado a la modificación: delega
 * la ejecución de cada tipo de operación a su correspondiente SyncOperationHandler
 * a través de SyncHandlerRegistry. Abierto a la extensión: nuevos tipos de
 * entidades u operaciones se añaden implementando SyncOperationHandler sin
 * necesidad de tocar este servicio.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly sqlite = inject(SqliteService);
  private readonly ventas = inject(VentaService);
  private readonly auth = inject(AuthService);
  private readonly handlerRegistry = inject(SyncHandlerRegistry);

  private readonly subject = new BehaviorSubject<EstadoSync>({
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
          const handler = this.handlerRegistry.obtener(op.tipo);
          if (!handler) {
            console.warn(`[SyncService] No existe manejador registrado para tipo: ${op.tipo}`);
            continue;
          }

          const resultado = await handler.ejecutar(op, p);
          if (resultado?.detenerCola) {
            break;
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
