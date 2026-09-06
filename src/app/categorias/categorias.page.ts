import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { Categoria } from '../models/categoria';
import { CatalogoDto, CatalogosService } from '../services/catalogos.service';
import { SqliteService } from '../services/sqlite.service';
import { DialogService } from '../services/dialog.service';
import { CatalogoFormData, CatalogoItem } from '../shared/catalogo-modal/catalogo-modal.component';

type TipoFeedback = 'success' | 'warning' | 'danger' | 'primary';

@Component({
  selector: 'app-categorias',
  templateUrl: './categorias.page.html',
  styleUrls: ['./categorias.page.scss'],
  standalone: false,
})
export class CategoriasPage implements OnInit {
  categorias: Categoria[] = [];
  busquedaCategoria = '';

  mostrarModalCatalogo = false;
  itemEditando: CatalogoItem | null = null;
  guardandoCatalogo = false;

  private readonly catalogosApi = inject(CatalogosService);
  private readonly sqlite = inject(SqliteService);
  private readonly toastController = inject(ToastController);
  private readonly dialog = inject(DialogService);

  cargando = true;

  ngOnInit(): void {
    this.cargarCategorias();
  }

  get categoriasFiltradas(): Categoria[] {
    const termino = this.busquedaCategoria.trim().toLowerCase();
    return this.categorias.filter(
      (categoria) =>
        !termino || `${categoria.nombre || ''} ${categoria.descripcion || ''}`.toLowerCase().includes(termino),
    );
  }

  cargarCategorias(): void {
    this.cargando = true;
    this.catalogosApi.getCategorias().subscribe({
      next: async (categorias) => {
        this.categorias = categorias;
        this.cargando = false;
        if (this.sqlite.disponible) {
          try {
            await this.sqlite.sincronizarCategorias(categorias);
          } catch (err) {
            console.error('Error al sincronizar categorías en SQLite:', err);
          }
        }
      },
      error: async (error: unknown) => {
        console.error('No se pudieron cargar las categorías del servidor, intentando SQLite...', error);
        if (this.sqlite.disponible) {
          try {
            const locales = await this.sqlite.getCategoriasLocales();
            if (locales && locales.length > 0) {
              this.categorias = locales;
            }
          } catch (localError) {
            console.error('Error al leer categorías locales:', localError);
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

  editarCategoria(categoria: Categoria): void {
    this.itemEditando = {
      id: categoria.id,
      nombre: categoria.nombre || '',
      descripcion: categoria.descripcion || '',
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
      const categoria =
        !editandoId
          ? await firstValueFrom(this.catalogosApi.crearCategoria(dto))
          : await firstValueFrom(this.catalogosApi.actualizarCategoria(String(editandoId), dto));
      this.categorias = this.reemplazarPorId(this.categorias, categoria, 'id');
      if (this.sqlite.disponible) {
        void this.sqlite.sincronizarCategorias(this.categorias);
      }

      this.mostrarModalCatalogo = false;
      this.itemEditando = null;
      await this.mostrarFeedback('Categoría guardada correctamente.', 'success');
    } catch (error: unknown) {
      await this.mostrarFeedback(this.mensajeErrorHttp(error, 'No pudimos guardar la categoría.'), 'danger');
    } finally {
      this.guardandoCatalogo = false;
    }
  }

  async eliminarCategoria(categoria: Categoria): Promise<void> {
    if (
      !(await this.confirmarAccion(
        'Eliminar categoría',
        `¿Quieres eliminar “${categoria.nombre}”?`,
        'Eliminar',
      ))
    )
      return;
    try {
      const respuesta = await firstValueFrom(this.catalogosApi.eliminarCategoria(categoria.id));
      this.categorias = this.categorias.filter((item) => item.id !== categoria.id);
      if (this.sqlite.disponible) {
        void this.sqlite.sincronizarCategorias(this.categorias);
      }
      await this.mostrarFeedback(respuesta.message, 'success');
    } catch (error: unknown) {
      await this.mostrarFeedback(this.mensajeErrorHttp(error, 'No pudimos eliminar la categoría.'), 'danger');
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
