import { Component, inject, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Caja } from '../models/caja';
import { AuthService } from '../services/auth.service';
import { CajaService } from '../services/caja.service';
import { SyncService } from '../services/sync.service';
@Component({
  selector: 'app-caja',
  templateUrl: './caja.page.html',
  styleUrls: ['./caja.page.scss'],
  standalone: false,
})
export class CajaPage implements OnInit {
  readonly auth = inject(AuthService);
  readonly sync = inject(SyncService);
  cortes: Caja[] = [];
  estado = '';
  fecha = '';
  cargando = false;

  readonly opcionesEstado = [
    { value: '', label: 'Todos los estados' },
    { value: 'ABIERTA', label: 'Abierta' },
    { value: 'CERRADA', label: 'Cerrada' },
  ];

  private api = inject(CajaService);
  ngOnInit(): void {
    void this.cargar();
  }
  async cargar(): Promise<void> {
    this.cargando = true;
    try {
      this.cortes = await firstValueFrom(
        this.api.historial({ estado: this.estado || undefined, fecha: this.fecha || undefined }),
      );
    } finally {
      this.cargando = false;
    }
  }
  interpretar(d: number): string {
    return d === 0 ? 'CAJA CUADRADA' : d > 0 ? 'SOBRANTE' : 'FALTANTE';
  }
}

