import { Component, inject, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SqliteService } from './services/sqlite.service';
import { AuthService } from './services/auth.service';
import { SyncService } from './services/sync.service';
import { ClienteAuthService } from './services/cliente-auth.service';
import { LiveUpdateService } from './services/live-update.service';
import { PushNotificationService } from './services/push-notification.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private readonly sqliteService = inject(SqliteService);
  private readonly authService = inject(AuthService);
  private readonly clienteAuthService = inject(ClienteAuthService);
  private readonly syncService = inject(SyncService);
  private readonly liveUpdateService = inject(LiveUpdateService);
  private readonly pushService = inject(PushNotificationService);

  async ngOnInit(): Promise<void> {
    void this.liveUpdateService.init();

    if (Capacitor.isNativePlatform()) {
      try {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#fff7fc' });
      } catch (e) {
        console.warn('No se pudo configurar StatusBar', e);
      }
    }

    await Promise.all([this.authService.restaurarSesion(), this.clienteAuthService.restaurarSesion()]);
    void this.pushService.inicializar();
    void this.syncService.reintentar();
    try {
      await this.sqliteService.initDB();
    } catch (error: unknown) {
      console.error('No se pudo inicializar SQLite', error);
    }
  }
}
