import { Component, OnInit, inject } from '@angular/core';
import { Sucursal } from '../models/sucursal';
import { SucursalService } from '../services/sucursal.service';

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.page.html',
  styleUrls: ['./configuracion.page.scss'],
  standalone: false,
})
export class ConfiguracionPage implements OnInit {
  sucursales: Sucursal[] = [];
  sucursalActual: Sucursal | null = null;
  cargandoSucursal = true;

  private readonly sucursalApi = inject(SucursalService);

  ngOnInit(): void {
    this.cargarSucursales();
  }

  cargarSucursales(): void {
    this.cargandoSucursal = true;
    this.sucursalApi.obtenerSucursales().subscribe({
      next: (sucursales) => {
        this.sucursales = sucursales;
        this.sucursalActual = sucursales.length === 1 ? sucursales[0] : null;
        this.cargandoSucursal = false;
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar la configuración de tienda', error);
        this.cargandoSucursal = false;
      },
    });
  }

  seleccionarSucursal(sucursal: Sucursal): void {
    this.sucursalActual = sucursal;
  }

  actualizarSucursal(sucursal: Sucursal): void {
    const indice = this.sucursales.findIndex((actual) => actual.id === sucursal.id);
    if (indice < 0) this.sucursales = [...this.sucursales, sucursal];
    else this.sucursales = this.sucursales.map((actual, posicion) => (posicion === indice ? sucursal : actual));
    this.sucursalActual = sucursal;
  }
}
