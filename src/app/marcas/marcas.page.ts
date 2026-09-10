import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { Marca } from '../models/marca';
import { CatalogoDto, CatalogosService } from '../services/catalogos.service';
import { DialogService } from '../services/dialog.service';
import { SqliteService } from '../services/sqlite.service';
import { CatalogoFormData, CatalogoItem } from '../shared/catalogo-modal/catalogo-modal.component';

type TipoFeedback = 'success' | 'danger' | 'warning' | 'primary';

@Component({
  selector: 'app-marcas',
  templateUrl: './marcas.page.html',
  styleUrls: ['./marcas.page.scss'],
  standalone: false,
})
export class MarcasPage implements OnInit {
  marcas: Marca[] = [];
  busquedaMarca = '';

  mostrarModalCatalogo = false;
  itemEditando: CatalogoItem | null = null;
  guardandoCatalogo = false;

  private readonly catalogosApi = inject(CatalogosService);
  private readonly sqlite = inject(SqliteService);
  private readonly toastController = inject(ToastController);
  private readonly dialog = inject(DialogService);

  cargando = true;

  ngOnInit(): void {
    this.cargarMarcas();
  }

  get marcasFiltradas(): Marca[] {
    const termino = this.busquedaMarca.trim().toLowerCase();
    return this.marcas.filter(
      (marca) =>
        !termino || `${marca.nombre || ''} ${marca.descripcion || ''}`.toLowerCase().includes(termino),
    );
  }

  cargarMarcas(): void {
    this.cargando = true;
    this.catalogosApi.getMarcas().subscribe({
      next: async (marcas) => {
        this.marcas = marcas;
        this.cargando = false;
        if (this.sqlite.disponible) {
          try {
            await this.sqlite.sincronizarMarcas(marcas);
          } catch (err) {
            console.error('Error al sincronizar marcas en SQLite:', err);
          }
        }
      },
      error: async (error: unknown) => {
        console.error('No se pudieron cargar las marcas del servidor, intentando SQLite...', error);
        if (this.sqlite.disponible) {
          try {
            const locales = await this.sqlite.getMarcasLocales();
            if (locales && locales.length > 0) {
              this.marcas = locales;
            }
          } catch (localError) {
            console.error('Error al leer marcas locales:', localError);
          }
        }
        this.cargando = false;
      },
    });
  }

  abrirNuevoCatalogo(): void {
    this.itemEditando = null;
    this.mostrarModalCatalogo = true;
  }

  editarMarca(marca: Marca): void {
    this.itemEditando = {
      id: marca.id,
      nombre: marca.nombre || '',
      descripcion: marca.descripcion || '',
    };
    this.mostrarModalCatalogo = true;
  }

  cancelarModalCatalogo(): void {
    this.mostrarModalCatalogo = false;
    this.itemEditando = null;
  }

  async guardarCatalogo(datos: CatalogoFormData): Promise<void> {
    if (this.guardandoCatalogo) return;
    const dto: CatalogoDto = {
      nombre: datos.nombre,
      descripcion: datos.descripcion,
    };

    this.guardandoCatalogo = true;
    try {
      const editandoId = this.itemEditando?.id;
      const marca =
        !editandoId
          ? await firstValueFrom(this.catalogosApi.crearMarca(dto))
          : await firstValueFrom(this.catalogosApi.actualizarMarca(String(editandoId), dto));
      this.marcas = this.reemplazarPorId(this.marcas, marca, 'id');
      if (this.sqlite.disponible) {
        void this.sqlite.sincronizarMarcas(this.marcas);
      }

      this.mostrarModalCatalogo = false;
      this.itemEditando = null;
      await this.mostrarFeedback('Marca guardada correctamente.', 'success');
    } catch (error: unknown) {
      await this.mostrarFeedback(this.mensajeErrorHttp(error, 'No pudimos guardar la marca.'), 'danger');
    } finally {
      this.guardandoCatalogo = false;
    }
  }

  async eliminarMarca(marca: Marca): Promise<void> {
    if (
      !(await this.confirmarAccion(
        'Eliminar marca',
        `¿Quieres eliminar “${marca.nombre}”?`,
        'Eliminar',
      ))
    )
      return;
    try {
      const respuesta = await firstValueFrom(this.catalogosApi.eliminarMarca(marca.id));
      this.marcas = this.marcas.filter((item) => item.id !== marca.id);
      if (this.sqlite.disponible) {
        void this.sqlite.sincronizarMarcas(this.marcas);
      }
      await this.mostrarFeedback(respuesta.message, 'success');
    } catch (error: unknown) {
      await this.mostrarFeedback(this.mensajeErrorHttp(error, 'No pudimos eliminar la marca.'), 'danger');
    }
  }

  private reemplazarPorId<T>(elementos: T[], elemento: T, llave: keyof T): T[] {
    const indice = elementos.findIndex((actual) => String(actual[llave]) === String(elemento[llave]));
    if (indice < 0) return [...elementos, elemento];
    return elementos.map((actual, posicion) => (posicion === indice ? elemento : actual));
  }

  private async mostrarFeedback(mensaje: string, tipo: TipoFeedback): Promise<void> {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: tipo === 'danger' ? 4200 : 3000,
      position: 'top',
      color: tipo,
      cssClass: ['pastel-toast', `toast-${tipo}`],
      buttons: [{ icon: 'close-outline', role: 'cancel' }],
    });
    await toast.present();
  }

  private async confirmarAccion(titulo: string, mensaje: string, confirmar: string): Promise<boolean> {
    return this.dialog.confirm({
      title: titulo,
      message: mensaje,
      type: 'danger',
      icon: 'delete',
      confirmText: confirmar,
      cancelText: 'Cancelar',
    });
  }

  private mensajeErrorHttp(error: unknown, predeterminado: string): string {
    if (!(error instanceof HttpErrorResponse)) return predeterminado;
    if (error.status === 0) return 'No fue posible conectar con el servidor.';
    if (typeof error.error?.message === 'string') return error.error.message;
    return predeterminado;
  }
}
