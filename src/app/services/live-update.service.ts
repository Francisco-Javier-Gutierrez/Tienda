import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { ToastController } from '@ionic/angular';
import { environment } from '../../environments/environment';

export interface AppVersionManifest {
  version: string;
  url: string;
  mandatory?: boolean;
  notes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LiveUpdateService {
  private readonly toast = inject(ToastController);
  private comprobando = false;

  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      // 1. Notificar a Capacitor Updater que la app arrancó exitosamente
      await CapacitorUpdater.notifyAppReady();
    } catch (e) {
      console.warn('[LiveUpdate] Error al notificar app ready:', e);
    }

    // 2. Verificar actualizaciones en segundo plano de manera no bloqueante
    void this.verificarActualizaciones();
  }

  async verificarActualizaciones(manual = false): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.comprobando) {
      return;
    }

    if (!navigator.onLine) {
      if (manual) {
        await this.mostrarMensaje('No hay conexión a internet para verificar actualizaciones.');
      }
      return;
    }

    this.comprobando = true;

    try {
      const manifestUrl = `${environment.CLOUDFRONT_URL || 'https://d1a6rub2w65qdc.cloudfront.net'}/updates/version.json?t=${Date.now()}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(manifestUrl, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (manual) await this.mostrarMensaje('No se encontraron actualizaciones disponibles.');
        return;
      }

      const manifest: AppVersionManifest = await response.json();
      if (!manifest?.version || !manifest?.url) {
        return;
      }

      const current = await CapacitorUpdater.current();
      const currentVersion = current.bundle?.version || '0.0.0';

      if (manifest.version === currentVersion) {
        if (manual) await this.mostrarMensaje('La aplicación ya está en la versión más reciente.');
        return;
      }

      console.log(`[LiveUpdate] Nueva versión detectada: ${manifest.version} (actual: ${currentVersion}). Descargando...`);

      const downloaded = await CapacitorUpdater.download({
        url: manifest.url,
        version: manifest.version,
      });

      await CapacitorUpdater.set(downloaded);
      console.log(`[LiveUpdate] Actualización ${manifest.version} lista para aplicar.`);

      if (manifest.mandatory) {
        const toast = await this.toast.create({
          message: 'Se aplicó una actualización importante. Reiniciando la app...',
          duration: 2500,
          position: 'top',
          color: 'primary',
        });
        await toast.present();
        setTimeout(async () => {
          await CapacitorUpdater.reload();
        }, 2000);
      } else {
        const toast = await this.toast.create({
          message: `Nueva versión (${manifest.version}) lista. Se aplicará la próxima vez que abras la app.`,
          duration: 4000,
          position: 'bottom',
          color: 'secondary',
        });
        await toast.present();
      }
    } catch (err: unknown) {
      console.warn('[LiveUpdate] No se pudo verificar o descargar la actualización:', err);
      if (manual) {
        await this.mostrarMensaje('No fue posible consultar actualizaciones en este momento.');
      }
    } finally {
      this.comprobando = false;
    }
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
