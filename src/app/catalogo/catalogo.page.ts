import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ToastController, ViewWillEnter } from '@ionic/angular';
import { environment } from '../../environments/environment';
import { ProductoParaCarrito } from '../models/carrito';
import { AuthService } from '../services/auth.service';
import { CarritoService } from '../services/carrito.service';
import { ClienteAuthService } from '../services/cliente-auth.service';
import { ImagenesService } from '../services/imagenes.service';

export interface ProductoPublico extends ProductoParaCarrito {
  tipo?: string | null;
  marca?: string | { id?: string | null; nombre?: string | null } | null;
  categoria?: string | { id?: string | null; nombre?: string | null } | null;
  stockMinimo?: number | null;
}

@Component({
  selector: 'app-catalogo',
  templateUrl: './catalogo.page.html',
  styleUrls: ['./catalogo.page.scss'],
  standalone: false,
})
export class CatalogoPage implements OnInit, ViewWillEnter {
  productos: ProductoPublico[] = [];
  busqueda = '';
  categoria = 'todas';
  marca = 'todas';
  cargando = true;
  errorCarga = false;

  readonly auth = inject(AuthService);
  readonly clienteAuth = inject(ClienteAuthService);
  private readonly carrito = inject(CarritoService);
  private readonly http = inject(HttpClient);
  private readonly imagenes = inject(ImagenesService);
  private readonly toastController = inject(ToastController);

  get esEmpleado(): boolean {
    return this.auth.estaAutenticado();
  }

  get esAdministrador(): boolean {
    return this.auth.tieneRol('ADMINISTRADOR');
  }

  get nombreCliente(): string | null {
    if (this.auth.sesion?.empleado?.nombre) {
      return this.auth.sesion.empleado.nombre.split(' ')[0];
    }
    return this.clienteAuth.sesion?.cliente.nombre?.split(' ')[0] || null;
  }

  get categorias(): string[] {
    return this.valoresUnicos(this.productos.map((producto) => this.obtenerNombreCategoria(producto)));
  }

  get marcas(): string[] {
    return this.valoresUnicos(this.productos.map((producto) => this.obtenerNombreMarca(producto)));
  }

  get productosFiltrados(): ProductoPublico[] {
    const termino = this.busqueda.trim().toLocaleLowerCase('es-MX');
    return this.productos.filter((producto) => {
      const catNombre = this.obtenerNombreCategoria(producto);
      const marcaNombre = this.obtenerNombreMarca(producto);

      const coincideTexto =
        !termino ||
        [producto.nombre, marcaNombre, catNombre].some((valor) =>
          valor ? valor.toLocaleLowerCase('es-MX').includes(termino) : false,
        );
      const coincideCategoria = this.categoria === 'todas' || catNombre === this.categoria;
      const coincideMarca = this.marca === 'todas' || marcaNombre === this.marca;
      return coincideTexto && coincideCategoria && coincideMarca;
    });
  }

  ngOnInit(): void {
    this.cargarProductos();
  }

  ionViewWillEnter(): void {
    this.cargarProductos();
  }

  cargarProductos(): void {
    this.cargando = true;
    this.errorCarga = false;
    this.http.get<ProductoPublico[]>(`${environment.API_BASE_URL}/public/productos`).subscribe({
      next: (productos) => {
        this.productos = Array.isArray(productos) ? productos : [];
        this.cargando = false;
      },
      error: () => {
        this.productos = [];
        this.errorCarga = true;
        this.cargando = false;
      },
    });
  }

  imagen(ruta: string | null): string | null {
    return this.imagenes.resolver(ruta);
  }

  disponible(producto: ProductoPublico): boolean {
    return Number(producto.existencia ?? 0) > 0;
  }

  seleccionarCategoria(categoria: string): void {
    if (categoria === 'todas') {
      this.categoria = 'todas';
      return;
    }
    const encontrada = this.categorias.find(
      (c) => c.toLowerCase().includes(categoria.toLowerCase())
    );
    this.categoria = encontrada || categoria;
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.categoria = 'todas';
    this.marca = 'todas';
  }

  async agregar(producto: ProductoPublico): Promise<void> {
    const agregado = this.carrito.agregar(producto);
    const toast = await this.toastController.create({
      message: agregado
        ? `${producto.nombre} se agregó al carrito.`
        : 'No hay más existencia disponible para agregar.',
      duration: 1800,
      position: 'bottom',
      color: agregado ? 'success' : 'warning',
    });
    await toast.present();
  }

  private obtenerNombreCategoria(producto: ProductoPublico): string | null {
    if (!producto.categoria) return null;
    if (typeof producto.categoria === 'string') return producto.categoria.trim() || null;
    return producto.categoria.nombre?.trim() || null;
  }

  private obtenerNombreMarca(producto: ProductoPublico): string | null {
    if (!producto.marca) return null;
    if (typeof producto.marca === 'string') return producto.marca.trim() || null;
    return producto.marca.nombre?.trim() || null;
  }

  private valoresUnicos(valores: Array<string | null | undefined>): string[] {
    return [...new Set(valores.filter((valor): valor is string => Boolean(valor)))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
  }
}


