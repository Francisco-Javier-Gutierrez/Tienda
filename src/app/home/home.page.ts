import { Component, inject, OnInit } from '@angular/core';
import { Categoria } from '../models/categoria';
import { Marca } from '../models/marca';
import { Producto } from '../models/productos';
import { Sucursal } from '../models/sucursal';
import { CatalogosService } from '../services/catalogos.service';
import { ProductosService } from '../services/productos.service';
import { SqliteService } from '../services/sqlite.service';
import { SucursalService } from '../services/sucursal.service';

type FiltroStock = 'todos' | 'disponible' | 'bajo' | 'sin-stock';
type EstadoStock = Exclude<FiltroStock, 'todos'>;

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  productos: Producto[] = [];
  marcas: Marca[] = [];
  categorias: Categoria[] = [];
  sucursales: Sucursal[] = [];
  sucursalActual: Sucursal | null = null;
  cargando = true;
  
  private readonly api = inject(ProductosService);
  private readonly catalogosApi = inject(CatalogosService);
  private readonly sqlite = inject(SqliteService);
  private readonly sucursalApi = inject(SucursalService);

  ngOnInit(): void {
    this.cargarProductos();
    this.cargarMarcas();
    this.cargarCategorias();
    this.cargarSucursales();
  }

  get totalStockBajo(): number {
    return this.productos.filter(
      (producto) =>
        producto.stockMinimo !== null &&
        producto.existencia !== null &&
        producto.existencia <= producto.stockMinimo,
    ).length;
  }

  get productosStockBajo(): Producto[] {
    return this.productos
      .filter(
        (producto) =>
          producto.stockMinimo !== null &&
          producto.existencia !== null &&
          producto.existencia <= producto.stockMinimo,
      )
      .slice(0, 6);
  }

  get nombreTienda(): string {
    return this.sucursalActual?.nombreSuc?.trim() || 'Mi tienda';
  }

  get saludoActual(): string {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  cargarProductos(): void {
    this.api.getProductos().subscribe({
      next: async (productos) => {
        this.productos = this.productosUnicos(productos);
        if (this.sqlite.disponible) {
          try {
            await this.sqlite.sincronizarCatalogo(this.productos);
          } catch (error) {
            console.error('Error al sincronizar catálogo con SQLite:', error);
          }
        }
        this.cargando = false;
      },
      error: async (error: unknown) => {
        console.error('No se pudieron cargar los productos del servidor, intentando SQLite...', error);
        if (this.sqlite.disponible) {
          try {
            const locales = await this.sqlite.getProductosLocales();
            if (locales && locales.length > 0) {
              this.productos = this.productosUnicos(locales as Producto[]);
            }
          } catch (localError) {
            console.error('Error al leer productos locales:', localError);
          }
        }
        this.cargando = false;
      },
    });
  }

  cargarMarcas(): void {
    this.catalogosApi.getMarcas().subscribe({
      next: async (marcas) => {
        this.marcas = marcas;
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
      },
    });
  }

  cargarCategorias(): void {
    this.catalogosApi.getCategorias().subscribe({
      next: async (categorias) => {
        this.categorias = categorias;
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
      },
    });
  }

  cargarSucursales(): void {
    this.sucursalApi.obtenerSucursales().subscribe({
      next: (sucursales) => {
        this.sucursales = sucursales;
        this.sucursalActual = sucursales.length === 1 ? sucursales[0] : null;
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar la configuración de tienda', error);
      },
    });
  }

  private productosUnicos(productos: Producto[]): Producto[] {
    const porId = new Map<string, Producto>();
    for (const producto of productos) porId.set(String(producto.id), producto);
    return [...porId.values()];
  }
}
