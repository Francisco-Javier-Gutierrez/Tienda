import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { firstValueFrom } from 'rxjs';
import { Categoria } from '../models/categoria';
import { Marca } from '../models/marca';
import { CrearProductoDto, Producto } from '../models/productos';
import { CatalogosService } from '../services/catalogos.service';
import { ProductoPublico, ProductosService } from '../services/productos.service';
import { SqliteService } from '../services/sqlite.service';
import { ScanFeedbackService } from '../services/scan-feedback.service';
import { SyncService } from '../services/sync.service';
import { DialogService } from '../services/dialog.service';

type ModoProducto = 'crear' | 'editar';

interface FormularioProducto {
  nombre: string;
  precio: number | null;
  costo: number | null;
  existencia: number | null;
  stockMinimo: number | null;
  tamano: string;
  presentacion: string;
  tipo: string;
  codigoQR: string;
  sku: string;
  imagen: string;
  idMarca: string | null;
  idCat: string | null;
}

interface DatosProductoFormulario {
  nombre: string;
  precio: number;
  costo: number | null;
  existencia: number;
  stockMinimo: number | null;
  tamano: string;
  presentacion: string;
  tipo: string;
  codigoQR: string;
  sku: string;
  imagen: string;
  idMarca: string;
  idCat: string;
}

type CampoProducto = 'nombre' | 'precio' | 'costo' | 'existencia' | 'stockMinimo' | 'idMarca' | 'idCat';
type ErroresProducto = Partial<Record<CampoProducto, string>>;
type TipoFeedback = 'success' | 'danger' | 'warning' | 'primary';
type FiltroStock = 'todos' | 'disponible' | 'bajo' | 'sin-stock';
type EstadoStock = Exclude<FiltroStock, 'todos'>;

@Component({
  selector: 'app-productos',
  templateUrl: './productos.page.html',
  styleUrls: ['./productos.page.scss'],
  standalone: false,
})
export class ProductosPage implements OnInit {
  productos: Producto[] = [];
  marcas: Marca[] = [];
  categorias: Categoria[] = [];
  busquedaProducto = '';
  filtroCategoria: any = 0;
  filtroMarca = 0;
  filtroStock: FiltroStock = 'todos';
  cargandoProductos = true;

  mostrarModalProducto = false;
  mostrarOpcionesAgregar = false;
  modoProducto: ModoProducto = 'crear';
  productoEditandoId: string | null = null;
  formProducto: FormularioProducto = this.formularioProductoVacio();

  guardandoProducto = false;
  buscandoProducto = false;
  mensajeBusqueda = '';
  sugerenciaPublica: ProductoPublico | null = null;
  productoEncontrado: Producto | null = null;
  codigosDetectados: string[] = [];
  mostrarSelectorCodigos = false;
  leyendoCodigo = false;
  private feedbackCamaraPendiente = false;
  erroresProducto: ErroresProducto = {};
  fotoProductoPendiente: Blob | null = null;
  nombreFotoPendiente = '';
  previewFotoPendiente: string | null = null;

  private readonly formatosComerciales = [
    BarcodeFormat.Ean13,
    BarcodeFormat.Ean8,
    BarcodeFormat.UpcA,
    BarcodeFormat.UpcE,
    BarcodeFormat.Code128,
    BarcodeFormat.Code39,
    BarcodeFormat.Codabar,
    BarcodeFormat.Itf,
    BarcodeFormat.QrCode,
  ];
  private readonly api = inject(ProductosService);
  private readonly catalogosApi = inject(CatalogosService);
  private readonly sqlite = inject(SqliteService);
  private readonly toastController = inject(ToastController);
  private readonly dialog = inject(DialogService);
  private readonly scanFeedback = inject(ScanFeedbackService);
  readonly sync = inject(SyncService);

  ngOnInit(): void {
    this.cargarProductos();
    this.cargarMarcas();
    this.cargarCategorias();
  }

  get productosFiltrados(): Producto[] {
    const termino = this.busquedaProducto.trim().toLowerCase();
    return this.productos.filter((producto) => {
      const coincideTexto =
        !termino ||
        [producto.nombre, producto.codigoQR, producto.sku].some((valor) =>
          (valor || '').toLowerCase().includes(termino),
        );
      const coincideCategoria = !this.filtroCategoria || Number(producto.categoria?.id) === this.filtroCategoria;
      const coincideMarca = !this.filtroMarca || Number(producto.marca?.id) === this.filtroMarca;
      const coincideStock = this.filtroStock === 'todos' || this.estadoStock(producto) === this.filtroStock;
      return coincideTexto && coincideCategoria && coincideMarca && coincideStock;
    });
  }

  get totalDisponibles(): number {
    return this.productos.filter((p) => this.estadoStock(p) === 'disponible').length;
  }
  get totalStockBajoInventario(): number {
    return this.productos.filter((p) => this.estadoStock(p) === 'bajo').length;
  }
  get totalSinStock(): number {
    return this.productos.filter((p) => this.estadoStock(p) === 'sin-stock').length;
  }
  get hayFiltrosProductos(): boolean {
    return Boolean(
      this.busquedaProducto.trim() || this.filtroCategoria || this.filtroMarca || this.filtroStock !== 'todos',
    );
  }

  get gananciaUnidad(): number | null {
    if (this.formProducto.precio === null || this.formProducto.costo === null) return null;
    return Number(this.formProducto.precio) - Number(this.formProducto.costo);
  }

  get margenSobrePrecio(): number | null {
    if (this.gananciaUnidad === null || !this.formProducto.precio) return null;
    return (this.gananciaUnidad / Number(this.formProducto.precio)) * 100;
  }

  cargarProductos(): void {
    this.cargandoProductos = true;
    this.api.getProductos().subscribe({
      next: async (productos) => {
        this.productos = this.productosUnicos(productos);
        this.cargandoProductos = false;
        if (this.sqlite.disponible) {
          try {
            await this.sqlite.sincronizarCatalogo(this.productos);
          } catch (error) {
            console.error('Error al sincronizar catálogo con SQLite:', error);
          }
        }
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
        this.cargandoProductos = false;
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

  async crearNuevaCategoriaRapida(sugerencia?: string): Promise<void> {
    const nombre = await this.dialog.prompt({
      title: 'Nueva categoría',
      message: 'Ingresa el nombre de la categoría para agregarla al catálogo.',
      placeholder: 'Ej. Bebidas, Botanas, Lácteos...',
      initialValue: (sugerencia || '').trim(),
      confirmText: 'Crear categoría',
      cancelText: 'Cancelar',
      minLength: 2,
      maxLength: 60,
      isTextarea: false,
    });

    if (!nombre || !nombre.trim()) return;

    const nombreLimpio = nombre.trim();
    try {
      const nueva = await firstValueFrom(
        this.catalogosApi.crearCategoria({
          nombre: nombreLimpio,
          descripcion: '',
        }),
      );
      this.categorias = this.reemplazarPorId(this.categorias, nueva, 'id');
      if (this.sqlite.disponible) {
        void this.sqlite.sincronizarCategorias(this.categorias);
      }
      this.formProducto.idCat = String(nueva.id);
      delete this.erroresProducto.idCat;
      await this.mostrarFeedback(`Categoría "${nueva.nombre}" creada y seleccionada.`, 'success');
    } catch (error: unknown) {
      await this.mostrarFeedback(this.mensajeErrorHttp(error, 'No pudimos crear la categoría.'), 'danger');
    }
  }

  async crearNuevaMarcaRapida(sugerencia?: string): Promise<void> {
    const nombre = await this.dialog.prompt({
      title: 'Nueva marca',
      message: 'Ingresa el nombre de la marca para agregarla al catálogo.',
      placeholder: 'Ej. Coca-Cola, Bimbo, Sabritas...',
      initialValue: (sugerencia || '').trim(),
      confirmText: 'Crear marca',
      cancelText: 'Cancelar',
      minLength: 2,
      maxLength: 60,
      isTextarea: false,
    });

    if (!nombre || !nombre.trim()) return;

    const nombreLimpio = nombre.trim();
    try {
      const nueva = await firstValueFrom(
        this.catalogosApi.crearMarca({
          nombre: nombreLimpio,
          descripcion: '',
        }),
      );
      this.marcas = this.reemplazarPorId(this.marcas, nueva, 'id');
      if (this.sqlite.disponible) {
        void this.sqlite.sincronizarMarcas(this.marcas);
      }
      this.formProducto.idMarca = String(nueva.id);
      delete this.erroresProducto.idMarca;
      await this.mostrarFeedback(`Marca "${nueva.nombre}" creada y seleccionada.`, 'success');
    } catch (error: unknown) {
      await this.mostrarFeedback(this.mensajeErrorHttp(error, 'No pudimos crear la marca.'), 'danger');
    }
  }

  estadoStock(producto: Producto): EstadoStock {
    const existencia = Number(producto.existencia ?? 0);
    if (existencia <= 0) return 'sin-stock';
    if (producto.stockMinimo !== null && existencia <= Number(producto.stockMinimo)) return 'bajo';
    return 'disponible';
  }

  etiquetaStock(producto: Producto): string {
    return { disponible: 'Disponible', bajo: 'Stock bajo', 'sin-stock': 'Sin stock' }[this.estadoStock(producto)];
  }

  limpiarFiltrosProductos(): void {
    this.busquedaProducto = '';
    this.filtroCategoria = 0;
    this.filtroMarca = 0;
    this.filtroStock = 'todos';
  }

  abrirNuevoProducto(): void {
    this.modoProducto = 'crear';
    this.productoEditandoId = null;
    this.formProducto = this.formularioProductoVacio();
    this.reiniciarFotoPendiente();
    this.erroresProducto = {};
    this.limpiarBusquedaPublica();
    this.mostrarOpcionesAgregar = false;
    this.mostrarModalProducto = true;
  }

  abrirOpcionesAgregar(): void {
    this.mostrarOpcionesAgregar = true;
  }

  editarProducto(producto: Producto): void {
    this.modoProducto = 'editar';
    this.productoEditandoId = producto.id;
    this.formProducto = {
      nombre: producto.nombre || '',
      precio: producto.precioVenta ?? null,
      costo: producto.costo ?? null,
      existencia: producto.existencia ?? null,
      stockMinimo: producto.stockMinimo ?? null,
      tamano: producto.tamano || '',
      presentacion: producto.presentacion || '',
      tipo: producto.tipo || '',
      codigoQR: producto.codigoQR || '',
      sku: producto.sku || '',
      imagen: producto.imagen || '',
      idMarca: producto.marca?.id ?? null,
      idCat: producto.categoria?.id ?? null,
    };
    this.reiniciarFotoPendiente();
    this.erroresProducto = {};
    this.limpiarBusquedaPublica();
    this.mostrarModalProducto = true;
  }

  cancelarModalProducto(): void {
    this.mostrarModalProducto = false;
  }

  async guardarDesdeModal(agregarOtro = false): Promise<void> {
    if (this.guardandoProducto) return;
    const datos = this.datosFormularioProducto();
    if (!datos) return;

    const dto = this.mapearProductoDto(datos);
    this.guardandoProducto = true;
    try {
      let guardadoRemoto: Producto;
      try {
        guardadoRemoto =
          this.modoProducto === 'editar' && this.productoEditandoId !== null
            ? await firstValueFrom(this.api.updateProducto(this.productoEditandoId, dto))
            : await firstValueFrom(this.api.addProducto(dto));
      } catch (error: unknown) {
        const esErrorConexion =
          error instanceof HttpErrorResponse && (error.status === 0 || error.status === 504 || error.status === 503);
        if (esErrorConexion && this.sqlite.disponible && this.modoProducto === 'crear') {
          try {
            const base64Foto = this.fotoProductoPendiente ? await this.blobABase64(this.fotoProductoPendiente) : null;
            const { idProTemporal } = await this.sqlite.guardarProductoOffline(
              datos,
              base64Foto,
              this.nombreFotoPendiente,
              this.fotoProductoPendiente?.type,
            );
            const productoOffline: Producto = {
              id: String(idProTemporal),
              nombre: datos.nombre,
              precioVenta: datos.precio,
              costo: datos.costo,
              existencia: datos.existencia,
              stockMinimo: datos.stockMinimo,
              tamano: datos.tamano,
              presentacion: datos.presentacion,
              tipo: datos.tipo,
              codigoQR: datos.codigoQR,
              sku: datos.sku,
              imagen: base64Foto || datos.imagen,
              activo: true,
              marca: datos.idMarca ? { id: datos.idMarca, nombre: this.marcas.find((m) => m.id === datos.idMarca)?.nombre || null } : null,
              categoria: datos.idCat ? { id: datos.idCat, nombre: this.categorias.find((c) => c.id === datos.idCat)?.nombre || null } : null,
              pendienteSync: 1,
            };
            this.actualizarProductoEnLista(productoOffline);

            if (agregarOtro) {
              this.formProducto = this.formularioProductoVacio();
              this.reiniciarFotoPendiente();
              this.limpiarBusquedaPublica();
            } else {
              this.mostrarModalProducto = false;
              this.reiniciarFotoPendiente();
            }

            await this.mostrarFeedback('Producto guardado en modo offline. Se sincronizará al conectar.', 'warning');
            return;
          } catch (offlineError) {
            console.error('Error al guardar producto offline en SQLite:', offlineError);
          }
        }

        await this.mostrarFeedback(this.mensajeErrorHttp(error, 'No pudimos guardar el producto.'), 'danger');
        return;
      }

      let productoFinal = guardadoRemoto;
      let fotoFallo = false;
      if (this.fotoProductoPendiente) {
        try {
          productoFinal = await firstValueFrom(
            this.api.subirImagen(guardadoRemoto.id, this.fotoProductoPendiente, this.nombreFotoPendiente),
          );
        } catch (error: unknown) {
          fotoFallo = true;
          console.error('Producto guardado, pero falló la fotografía', error);
        }
      }

      this.actualizarProductoEnLista(productoFinal);
      let copiaLocalFallo = false;
      try {
        await this.sqlite.guardarProducto(productoFinal);
      } catch (error: unknown) {
        copiaLocalFallo = true;
        console.error('Producto guardado en servidor, pero falló SQLite', error);
      }

      if (agregarOtro && this.modoProducto === 'crear') {
        this.formProducto = this.formularioProductoVacio();
        this.reiniciarFotoPendiente();
        this.limpiarBusquedaPublica();
      } else {
        this.mostrarModalProducto = false;
        this.reiniciarFotoPendiente();
      }

      if (fotoFallo) {
        await this.mostrarFeedback('Producto guardado, pero no pudimos subir la fotografía.', 'warning');
      } else if (copiaLocalFallo) {
        await this.mostrarFeedback('Producto guardado, pero no fue posible actualizar la copia local.', 'warning');
      } else {
        const mensaje = agregarOtro
          ? 'Producto guardado. Puedes agregar el siguiente.'
          : this.modoProducto === 'editar'
            ? 'Producto actualizado correctamente.'
            : 'Producto guardado correctamente.';
        await this.mostrarFeedback(mensaje, 'success');
      }
    } finally {
      this.guardandoProducto = false;
    }
  }

  async buscarInformacionCodigo(): Promise<void> {
    await this.procesarCodigo(this.formProducto.codigoQR);
  }

  async procesarCodigo(valor: string): Promise<void> {
    const codigo = valor.trim();
    this.limpiarBusquedaPublica();
    this.productoEncontrado = null;
    if (!codigo) {
      this.mensajeBusqueda = 'Escribe un código de barras para buscar.';
      return;
    }
    this.formProducto.codigoQR = codigo;
    this.buscandoProducto = true;
    try {
      const local = await this.sqlite.buscarPorQR(codigo);
      if (local) {
        this.productoEncontrado = local;
        this.mensajeBusqueda = 'Este producto ya está registrado.';
        return;
      }
      if (!this.sync.estadoConexion().conectado) {
        this.mensajeBusqueda = 'Modo offline: código asignado al producto sin consultar servicios externos.';
        return;
      }
      const propio = await firstValueFrom(this.api.getByQR(codigo));
      if (propio) {
        await this.sqlite.guardarProducto(propio);
        this.productoEncontrado = propio;
        this.mensajeBusqueda = 'Este producto ya está registrado.';
        return;
      }
      const sugerencia = await firstValueFrom(this.api.buscarInformacionPublica(codigo));
      if (!sugerencia.encontrado) {
        this.mensajeBusqueda = 'No encontramos información para ese código. Puedes continuar manualmente.';
        return;
      }
      this.sugerenciaPublica = sugerencia;
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 0) {
        this.mensajeBusqueda = 'No fue posible conectar con el servidor. Puedes continuar manualmente.';
      } else {
        this.mensajeBusqueda =
          error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
            ? error.error.message
            : 'No fue posible completar la búsqueda. Puedes continuar manualmente.';
      }
    } finally {
      this.buscandoProducto = false;
    }
  }

  async escanearCodigoEnVivo(): Promise<void> {
    if (this.leyendoCodigo || this.buscandoProducto) return;
    this.leyendoCodigo = true;
    await this.scanFeedback.preparar();
    try {
      const soporte = await BarcodeScanner.isSupported();
      if (!soporte.supported) {
        this.mensajeBusqueda = 'La cámara no está disponible. Puedes escribir el código manualmente.';
        return;
      }
      if (Capacitor.getPlatform() === 'android') {
        try {
          const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
          if (!available) {
            await BarcodeScanner.installGoogleBarcodeScannerModule();
          }
        } catch {
          // Continuar normalmente
        }
      }
      const permisos = await BarcodeScanner.checkPermissions();
      const estado = permisos.camera === 'granted' ? permisos : await BarcodeScanner.requestPermissions();
      if (estado.camera !== 'granted') {
        this.mensajeBusqueda =
          'Necesitas permitir acceso a la cámara para escanear. Puedes escribir el código manualmente.';
        return;
      }
      const resultado = await BarcodeScanner.scan({ formats: this.formatosComerciales, autoZoom: true });
      const codigo = resultado.barcodes[0]?.rawValue?.trim();
      if (!codigo) {
        this.mensajeBusqueda = 'No se detectó ningún código. Puedes escribirlo manualmente.';
        return;
      }
      await this.scanFeedback.feedbackLecturaCorrecta();
      await this.procesarCodigo(codigo);
    } catch (error: unknown) {
      console.error('No se pudo escanear el código', error);
      this.mensajeBusqueda = 'No se pudo usar la cámara. Puedes escribir el código manualmente.';
    } finally {
      this.leyendoCodigo = false;
    }
  }

  async tomarFotoParaCodigo(): Promise<void> {
    await this.leerCodigoDesdeOrigen(CameraSource.Camera);
  }

  async elegirFotoParaCodigo(): Promise<void> {
    await this.leerCodigoDesdeOrigen(CameraSource.Photos);
  }

  private async leerCodigoDesdeOrigen(origen: CameraSource): Promise<void> {
    if (this.leyendoCodigo || this.buscandoProducto) return;
    this.leyendoCodigo = true;
    await this.scanFeedback.preparar();
    try {
      if (origen === CameraSource.Camera) {
        const permisos = await Camera.checkPermissions();
        const estado =
          permisos.camera === 'granted' ? permisos : await Camera.requestPermissions({ permissions: ['camera'] });
        if (estado.camera !== 'granted') {
          this.mensajeBusqueda = 'Necesitas permitir acceso a la cámara. Puedes escribir el código manualmente.';
          return;
        }
      } else if (origen === CameraSource.Photos) {
        try {
          const permisos = await Camera.checkPermissions();
          if (permisos.photos !== 'granted') {
            const estado = await Camera.requestPermissions({ permissions: ['photos'] });
            if (estado.photos !== 'granted' && estado.photos !== 'limited') {
              this.mensajeBusqueda = 'Necesitas permitir acceso a la galería de fotos.';
              return;
            }
          }
        } catch {
          // PhotoPicker en Android 13+ no requiere permisos explícitos
        }
      }
      const foto = await this.obtenerFoto(origen);
      // En dispositivos nativos (Android/iOS), readBarcodesFromImage requiere una URI de archivo local válida
      // (por ejemplo file:///data/user/0/... o content://...).
      // foto.webPath es una URL HTTP de WebView (http://localhost/_capacitor_file_/...) que ContentResolver en Android NO puede abrir.
      // Por eso priorizamos foto.path y nos aseguramos de que tenga el esquema file:// si es una ruta absoluta.
      let ruta = foto.path || foto.webPath;
      if (!ruta) throw new Error('No se obtuvo una imagen');
      if (ruta.startsWith('/') && !ruta.startsWith('file://') && !ruta.startsWith('content://')) {
        ruta = `file://${ruta}`;
      }

      const resultado = await BarcodeScanner.readBarcodesFromImage({
        path: ruta,
        formats: this.formatosComerciales,
      });
      if (resultado.barcodes.length === 0) {
        this.mensajeBusqueda = 'No encontramos códigos en la foto. Puedes escribirlo manualmente.';
        return;
      }
      if (resultado.barcodes.length === 1) {
        const codigoUnico = resultado.barcodes[0].rawValue?.trim();
        if (codigoUnico) {
          await this.scanFeedback.feedbackLecturaCorrecta();
          await this.procesarCodigo(codigoUnico);
        }
        return;
      }
      this.codigosDetectados = resultado.barcodes
        .map((b) => b.rawValue?.trim() || '')
        .filter((val) => val.length > 0);
      this.feedbackCamaraPendiente = true;
      this.mostrarSelectorCodigos = true;
    } catch (error: unknown) {
      if (this.esCancelacionCamara(error)) {
        this.mensajeBusqueda = '';
      } else {
        console.error('No se pudo leer el código desde la foto', error);
        this.mensajeBusqueda = 'Hubo un problema con la fotografía. Puedes escribir el código manualmente.';
      }
    } finally {
      this.leyendoCodigo = false;
    }
  }

  private esCancelacionCamara(error: unknown): boolean {
    return error instanceof Error && (error.message.includes('User cancelled') || error.message.includes('cancelled'));
  }

  async seleccionarCodigo(codigo: string): Promise<void> {
    const emitirFeedback = this.feedbackCamaraPendiente;
    this.feedbackCamaraPendiente = false;
    this.mostrarSelectorCodigos = false;
    this.codigosDetectados = [];
    if (emitirFeedback) await this.scanFeedback.feedbackLecturaCorrecta();
    await this.procesarCodigo(codigo);
  }

  editarProductoEncontrado(): void {
    const encontrado = this.productoEncontrado;
    if (!encontrado) return;
    this.productoEncontrado = null;
    this.editarProducto(encontrado);
  }

  usarSugerenciaPublica(): void {
    const sugerencia = this.sugerenciaPublica;
    if (!sugerencia) return;
    if (sugerencia.nombre) this.formProducto.nombre = sugerencia.nombre;
    if (sugerencia.tamano) this.formProducto.tamano = sugerencia.tamano;
    if (sugerencia.presentacion) this.formProducto.presentacion = sugerencia.presentacion;
    if (sugerencia.imagenUrl) this.formProducto.imagen = sugerencia.imagenUrl;
    const marca = this.marcas.find(
      (item) => (item.nombre || '').toLowerCase() === (sugerencia.marca || '').toLowerCase(),
    );
    const categoria = this.categorias.find(
      (item) => (item.nombre || '').toLowerCase() === (sugerencia.categoria || '').toLowerCase(),
    );
    if (marca && marca.id) this.formProducto.idMarca = marca.id;
    if (categoria && categoria.id) this.formProducto.idCat = categoria.id;
    this.mensajeBusqueda = 'Información sugerida aplicada. Revisa los datos antes de guardar.';
    this.sugerenciaPublica = null;
  }

  continuarManualmente(): void {
    this.sugerenciaPublica = null;
    this.mensajeBusqueda = 'Continúa completando el producto manualmente.';
  }

  quitarImagen(): void {
    this.formProducto.imagen = '';
    this.reiniciarFotoPendiente();
  }

  cambioUrlImagen(): void {
    if (this.fotoProductoPendiente) this.reiniciarFotoPendiente();
  }

  async tomarFotoProducto(): Promise<void> {
    await this.prepararFotoProducto(CameraSource.Camera);
  }

  async elegirFotoProducto(): Promise<void> {
    await this.prepararFotoProducto(CameraSource.Photos);
  }

  resolverImagenProducto(imagen: string | null | undefined): string | null {
    return this.api.resolverImagenProducto(imagen);
  }

  ocultarImagen(evento: Event): void {
    const imagen = evento.target;
    if (imagen instanceof HTMLImageElement) imagen.hidden = true;
  }

  mostrarImagen(evento: Event): void {
    const imagen = evento.target;
    if (imagen instanceof HTMLImageElement) imagen.hidden = false;
  }

  async eliminarProducto(producto: Producto): Promise<void> {
    if (
      !(await this.confirmarAccion(
        'Eliminar producto',
        `¿Quieres eliminar “${producto.nombre}”? Solo podrá eliminarse si no tiene movimientos relacionados.`,
        'Eliminar',
      ))
    )
      return;
    try {
      const respuesta = await firstValueFrom(this.api.deleteProducto(producto.id));
      this.productos = this.productos.filter((item) => item.id !== producto.id);
      if (this.sqlite.disponible) {
        try {
          await this.sqlite.eliminarProductoLocal(producto.id);
        } catch (error: unknown) {
          console.error('Producto eliminado en servidor, pero falló SQLite', error);
        }
      }
      await this.mostrarFeedback(respuesta.message, 'success');
    } catch (error: unknown) {
      const mensaje =
        error instanceof HttpErrorResponse && error.status === 409
          ? 'Este producto tiene movimientos asociados y no puede eliminarse.'
          : this.mensajeErrorHttp(error, 'No pudimos eliminar el producto.');
      await this.mostrarFeedback(mensaje, 'danger');
    }
  }

  private obtenerFoto(origen: CameraSource): Promise<Photo> {
    return Camera.getPhoto({
      source: origen,
      resultType: CameraResultType.Uri,
      quality: 90,
      allowEditing: false,
      saveToGallery: false,
      correctOrientation: true,
      webUseInput: true,
    });
  }

  private async prepararFotoProducto(origen: CameraSource): Promise<void> {
    try {
      if (origen === CameraSource.Camera) {
        const permisos = await Camera.checkPermissions();
        const estado =
          permisos.camera === 'granted' ? permisos : await Camera.requestPermissions({ permissions: ['camera'] });
        if (estado.camera !== 'granted') {
          await this.mostrarFeedback('Necesitas permitir acceso a la cámara para tomar la fotografía.', 'warning');
          return;
        }
      }
      const foto = await this.obtenerFoto(origen);
      const preview = foto.webPath || foto.path;
      if (!preview) throw new Error('La cámara no devolvió una ruta de imagen');
      const respuesta = await fetch(preview);
      const blob = await respuesta.blob();
      const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
      if (!tiposPermitidos.includes(blob.type)) {
        await this.mostrarFeedback('Selecciona una imagen JPEG, PNG o WEBP.', 'warning');
        return;
      }
      if (blob.size > 5 * 1024 * 1024) {
        await this.mostrarFeedback('La imagen no puede superar 5 MB.', 'warning');
        return;
      }
      const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      this.fotoProductoPendiente = blob;
      this.nombreFotoPendiente = `producto.${extension}`;
      this.previewFotoPendiente = preview;
    } catch (error: unknown) {
      if (!this.esCancelacionCamara(error)) {
        console.error('No se pudo preparar la foto del producto', error);
        await this.mostrarFeedback('No pudimos preparar la fotografía seleccionada.', 'danger');
      }
    }
  }

  private reiniciarFotoPendiente(): void {
    this.fotoProductoPendiente = null;
    this.nombreFotoPendiente = '';
    this.previewFotoPendiente = null;
  }

  private blobABase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private datosFormularioProducto(): DatosProductoFormulario | null {
    const f = this.formProducto;
    this.erroresProducto = this.validarFormularioProducto(f);
    const primerCampo = Object.keys(this.erroresProducto)[0] as CampoProducto | undefined;
    if (primerCampo) {
      this.enfocarCampoInvalido(primerCampo);
      void this.mostrarFeedback(this.erroresProducto[primerCampo] || 'Revisa los datos del producto.', 'warning');
      return null;
    }
    return {
      nombre: f.nombre.trim(),
      precio: Number(f.precio),
      costo: f.costo === null ? null : Number(f.costo),
      existencia: Number(f.existencia),
      stockMinimo: f.stockMinimo === null ? null : Number(f.stockMinimo),
      tamano: f.tamano.trim(),
      presentacion: f.presentacion.trim(),
      tipo: f.tipo.trim(),
      codigoQR: f.codigoQR.trim(),
      sku: f.sku.trim(),
      imagen: f.imagen.trim(),
      idMarca: f.idMarca!,
      idCat: f.idCat!,
    };
  }

  private validarFormularioProducto(f: FormularioProducto): ErroresProducto {
    const errores: ErroresProducto = {};
    if (!f.nombre.trim()) errores.nombre = 'Ingresa el nombre del producto.';
    if (f.precio === null) errores.precio = 'El precio es obligatorio.';
    else if (!Number.isFinite(Number(f.precio)) || Number(f.precio) < 0)
      errores.precio = 'El precio debe ser mayor o igual a cero.';
    if (f.costo !== null && (!Number.isFinite(Number(f.costo)) || Number(f.costo) < 0))
      errores.costo = 'El costo debe ser mayor o igual a cero.';
    if (f.existencia === null) errores.existencia = 'El stock es obligatorio.';
    else if (!Number.isInteger(Number(f.existencia)) || Number(f.existencia) < 0)
      errores.existencia = 'El stock debe ser un entero mayor o igual a cero.';
    if (f.stockMinimo !== null && (!Number.isInteger(Number(f.stockMinimo)) || Number(f.stockMinimo) < 0))
      errores.stockMinimo = 'El stock mínimo debe ser un entero mayor o igual a cero.';
    if (f.idCat === null) errores.idCat = 'Selecciona una categoría.';
    if (f.idMarca === null) errores.idMarca = 'Selecciona una marca.';
    return errores;
  }

  private enfocarCampoInvalido(campo: CampoProducto): void {
    requestAnimationFrame(() => {
      const elemento = document.getElementById(`producto-${campo}`) as
        (HTMLElement & { setFocus?: () => Promise<void> }) | null;
      elemento?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      void elemento?.setFocus?.();
    });
  }

  private mapearProductoDto(datos: DatosProductoFormulario): CrearProductoDto {
    return {
      nombre: datos.nombre,
      precio: datos.precio,
      costo: datos.costo,
      existencia: datos.existencia,
      stockMinimo: datos.stockMinimo,
      tamano: datos.tamano,
      presentacion: datos.presentacion,
      tipo: datos.tipo,
      codigoQR: datos.codigoQR || null,
      sku: datos.sku || null,
      imagen: datos.imagen || null,
      idMarca: datos.idMarca,
      idCat: datos.idCat,
    };
  }

  private formularioProductoVacio(): FormularioProducto {
    return {
      nombre: '',
      precio: null,
      costo: null,
      existencia: 0,
      stockMinimo: null,
      tamano: '',
      presentacion: '',
      tipo: '',
      codigoQR: '',
      sku: '',
      imagen: '',
      idMarca: null,
      idCat: null,
    };
  }

  private limpiarBusquedaPublica(): void {
    this.sugerenciaPublica = null;
    this.mensajeBusqueda = '';
    this.productoEncontrado = null;
  }

  private actualizarProductoEnLista(producto: Producto): void {
    this.productos = this.productosUnicos(this.reemplazarPorId(this.productos, producto, 'id'));
  }

  private productosUnicos(productos: Producto[]): Producto[] {
    const porId = new Map<string, Producto>();
    for (const producto of productos) porId.set(String(producto.id), producto);
    return [...porId.values()];
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
