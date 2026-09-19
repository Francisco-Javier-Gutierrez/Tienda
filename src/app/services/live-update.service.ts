import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { ToastController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppVersionManifest {
  version: string;
  url: string;
  mandatory?: boolean;
  notes?: string;
}

export interface LiveUpdateState {
  disponible: boolean;
  descargando: boolean;
  progreso: number; // 0 a 100
  completada: boolean;
  version: string | null;
  esWeb: boolean;
  descartado: boolean;
  error?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LiveUpdateService {
  private readonly toast = inject(ToastController);
  private comprobando = false;
  private localWebVersion: string | null = null;
  private intervalId: any = null;

  private readonly estadoSubject = new BehaviorSubject<LiveUpdateState>({
    disponible: false,
    descargando: false,
    progreso: 0,
    completada: false,
    version: null,
    esWeb: !Capacitor.isNativePlatform(),
    descartado: false,
    error: null,
  });

  readonly estado$ = this.estadoSubject.asObservable();

  get estadoActual(): LiveUpdateState {
    return this.estadoSubject.value;
  }

  async init(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        // 1. Notificar a Capacitor Updater que la app arrancó exitosamente
        await CapacitorUpdater.notifyAppReady();
      } catch (e) {
        console.warn('[LiveUpdate] Error al notificar app ready:', e);
      }

      // 2. Verificar actualizaciones en segundo plano
      void this.verificarActualizaciones();
    } else {
      // 3. Monitor de versiones en entorno Web / Navegador
      await this.iniciarMonitorWeb();
    }
  }

  private async iniciarMonitorWeb(): Promise<void> {
    try {
      const manifest = await this.consultarManifest();
      if (manifest?.version) {
        this.localWebVersion = manifest.version;
      }
    } catch {
      // Silencioso en arranque inicial
    }

    if (typeof window !== 'undefined') {
      // Comprobar cada 5 minutos
      this.intervalId = setInterval(() => {
        void this.comprobarVersionWeb();
      }, 5 * 60 * 1000);

      // Comprobar cuando el usuario regresa a la pestaña activa
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.comprobarVersionWeb();
        }
      });
    }
  }

  private async comprobarVersionWeb(): Promise<void> {
    if (!navigator.onLine || this.comprobando) return;
    this.comprobando = true;

    try {
      const manifest = await this.consultarManifest();
      if (!manifest?.version) return;

      if (!this.localWebVersion) {
        this.localWebVersion = manifest.version;
        return;
      }

      if (manifest.version !== this.localWebVersion) {
        console.log(`[LiveUpdate Web] Nueva versión disponible: ${manifest.version} (actual: ${this.localWebVersion})`);
        this.actualizarEstado({
          disponible: true,
          esWeb: true,
          version: manifest.version,
          descartado: false,
        });
      }
    } catch (e) {
      // Ignorar errores transitorios de red en el polling
    } finally {
      this.comprobando = false;
    }
  }

  async verificarActualizaciones(manual = false): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      if (manual) {
        await this.comprobarVersionWeb();
        if (!this.estadoActual.disponible) {
          await this.mostrarMensaje('La aplicación web ya está en la versión más reciente.');
        }
      }
      return;
    }

    if (this.comprobando) return;

    if (!navigator.onLine) {
      if (manual) {
        await this.mostrarMensaje('No hay conexión a internet para verificar actualizaciones.');
      }
      return;
    }

    this.comprobando = true;

    try {
      const manifest = await this.consultarManifest();
      if (!manifest?.version || !manifest?.url) {
        if (manual) await this.mostrarMensaje('No se encontraron actualizaciones disponibles.');
        return;
      }

      const current = await CapacitorUpdater.current();
      const currentVersion = current.bundle?.version || '0.0.0';

      if (manifest.version === currentVersion) {
        if (manual) await this.mostrarMensaje('La aplicación ya está en la versión más reciente.');
        return;
      }

      console.log(`[LiveUpdate] Nueva versión detectada: ${manifest.version} (actual: ${currentVersion}). Iniciando descarga...`);

      // Mostrar barra de progreso
      this.actualizarEstado({
        disponible: true,
        descargando: true,
        progreso: 0,
        version: manifest.version,
        esWeb: false,
        descartado: false,
        error: null,
      });

      let downloadListener: any = null;
      try {
        // Escuchar el evento nativo con porcentaje real (0-100%)
        downloadListener = await CapacitorUpdater.addListener('download', (state: any) => {
          const raw = Number(state?.percent);
          const percent = Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : 0;
          this.actualizarEstado({
            descargando: true,
            progreso: percent,
          });
        });
      } catch (errListener) {
        console.warn('[LiveUpdate] Listener de progreso no disponible:', errListener);
      }

      try {
        const downloaded = await CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version,
        });

        await CapacitorUpdater.set(downloaded);
        console.log(`[LiveUpdate] Actualización ${manifest.version} descargada y lista para aplicar.`);

        this.actualizarEstado({
          descargando: false,
          progreso: 100,
          completada: true,
          version: manifest.version,
        });

        if (manifest.mandatory) {
          const toast = await this.toast.create({
            message: 'Se aplicó una actualización crítica. Reiniciando la app...',
            duration: 2500,
            position: 'top',
            color: 'primary',
          });
          await toast.present();
          setTimeout(async () => {
            await CapacitorUpdater.reload();
          }, 2000);
        }
      } catch (downloadErr) {
        console.warn('[LiveUpdate] Error o interrupción al descargar paquete:', downloadErr);
        this.actualizarEstado({
          descargando: false,
          error: 'La descarga no pudo completarse. Se reanudará al recuperar conexión.',
        });
        if (manual) {
          await this.mostrarMensaje('No se pudo completar la descarga de la actualización.');
        }
      } finally {
        if (downloadListener?.remove) {
          void downloadListener.remove();
        }
      }
    } catch (err: unknown) {
      console.warn('[LiveUpdate] No se pudo verificar la actualización:', err);
      if (manual) {
        await this.mostrarMensaje('No fue posible consultar actualizaciones en este momento.');
      }
    } finally {
      this.comprobando = false;
    }
  }

  async aplicarActualizacion(): Promise<void> {
    if (this.estadoActual.esWeb) {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await CapacitorUpdater.reload();
      } catch (e) {
        console.warn('[LiveUpdate] Error al recargar app nativa:', e);
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    }
  }

  descartarAviso(): void {
    this.actualizarEstado({ descartado: true });
  }

  private actualizarEstado(parcial: Partial<LiveUpdateState>): void {
    this.estadoSubject.next({
      ...this.estadoSubject.value,
      ...parcial,
    });
  }

  private async consultarManifest(): Promise<AppVersionManifest | null> {
    const manifestUrl = `${environment.CLOUDFRONT_URL || 'https://d1a6rub2w65qdc.cloudfront.net'}/updates/version.json?t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(manifestUrl, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    return await response.json();
  }

  private async mostrarMensaje(mensaje: string): Promise<void> {
    const toast = await this.toast.create({
      message: mensaje,
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }
}
