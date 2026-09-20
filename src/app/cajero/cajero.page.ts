import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';

import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

import { AlertController, IonSearchbar, ToastController } from '@ionic/angular';

import { firstValueFrom } from 'rxjs';

import { Caja, MovimientoCaja, TipoMovimiento } from '../models/caja';

import { ItemVenta, MetodoPago, ProductoPos, VentaRegistrada } from '../models/venta';

import { AuthService } from '../services/auth.service';
import { CajaService } from '../services/caja.service';
import { ImagenesService } from '../services/imagenes.service';
import { SqliteService } from '../services/sqlite.service';
import { ScanFeedbackService } from '../services/scan-feedback.service';
import { SyncService } from '../services/sync.service';
import { VentaService } from '../services/venta.service';
import { DialogService } from '../services/dialog.service';
import { TicketService } from '../services/ticket.service';
import { FiadoService } from '../services/fiado.service';
import { ClienteDeudor } from '../models/fiado';

@Component({
  selector: 'app-cajero',
  templateUrl: './cajero.page.html',
  styleUrls: ['./cajero.page.scss'],
  standalone: false,
})
export class CajeroPage implements OnInit, AfterViewInit, OnDestroy {
  /* =========================================
     REFERENCIAS
  ========================================= */

  @ViewChild('lector')
  lector?: ElementRef<HTMLInputElement> | IonSearchbar;

  cargandoCorte = false;

  /* =========================================
     SERVICIOS
  ========================================= */

  readonly auth = inject(AuthService);
  readonly sync = inject(SyncService);
  readonly ticket = inject(TicketService);

  private readonly sqlite = inject(SqliteService);
  private readonly ventas = inject(VentaService);
  private readonly cajas = inject(CajaService);
  private readonly imagenes = inject(ImagenesService);
  private readonly scanFeedback = inject(ScanFeedbackService);
  private readonly toast = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly dialog = inject(DialogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fiadoService = inject(FiadoService);

  /* =========================================
     DATOS GENERALES
  ========================================= */

  readonly fechaActual = new Date();

  productos: ProductoPos[] = [];

  carrito: ItemVenta[] = [];

  notaAdicional = '';

  montoNotaAdicional: number | null = null;

  ticketVisible = false;

  private observerTicket?: IntersectionObserver;

  busqueda = '';

  metodoPago: MetodoPago = 'EFECTIVO';

  montoRecibido: number | null = null;

  clientesFiado: ClienteDeudor[] = [];

  clientesFiadoSugeridos: ClienteDeudor[] = [];

  clienteFiadoSeleccionado: ClienteDeudor | null = null;

  busquedaClienteFiado = '';

  /* =========================================
     ESTADOS DEL POS
  ========================================= */

  cargando = true;

  cargandoProductos = true;

  leyendoCodigo = false;

  procesandoVenta = false;

  /* =========================================
     CAJA
  ========================================= */

  caja: Caja | null = null;

  fondoInicial: number | null = null;

  abriendo = false;

  ultimaCaja: Caja | null = null;

  /* =========================================
     MOVIMIENTOS
  ========================================= */

  mostrarMovimiento = false;

  // NUEVO MODAL DE COBRO
  mostrarModalCobro = false;

  tipoMovimiento: TipoMovimiento = 'INGRESO';

  montoMovimiento: number | null = null;

  conceptoMovimiento = '';

  movimientos: MovimientoCaja[] = [];

  /* =========================================
     CORTE
  ========================================= */

  mostrarCorte = false;

  resumen: Caja | null = null;

  efectivoContado: number | null = null;

  observaciones = '';

  cerrando = false;

  /* =========================================
     FORMATOS DE ESCÁNER
  ========================================= */

  private readonly formatos = [
    BarcodeFormat.Ean13,
    BarcodeFormat.Ean8,
    BarcodeFormat.UpcA,
    BarcodeFormat.UpcE,
    BarcodeFormat.Code128,
    BarcodeFormat.QrCode,
  ];

  /* =========================================
     INICIO
  ========================================= */

  ngOnInit(): void {
    void this.iniciar();
  }

  ionViewWillEnter(): void {
    void this.iniciar();
    this.iniciarObservadorTicket();
  }

  ngAfterViewInit(): void {
    this.iniciarObservadorTicket();
  }

  ngOnDestroy(): void {
    this.observerTicket?.disconnect();
  }

  iniciarObservadorTicket(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.observerTicket?.disconnect();

    setTimeout(() => {
      const ticketEl = document.getElementById('resumenVenta');
      if (ticketEl) {
        this.observerTicket = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            // Si el ticket es visible en el viewport (al menos un 10%), ocultamos la barra flotante "Ver Ticket"
            this.ticketVisible = Boolean(entry && entry.isIntersecting && entry.intersectionRatio > 0.05);
            this.cdr.markForCheck();
          },
          { threshold: [0, 0.05, 0.1, 0.25, 0.5] },
        );
        this.observerTicket.observe(ticketEl);
      }
    }, 400);
  }

  private async iniciar(): Promise<void> {
    this.cargando = true;
    this.ultimaCaja = null;

    try {
      const respuesta = await firstValueFrom(this.cajas.actual());

      this.caja = respuesta.caja;

      /*
       * Si la caja existe en servidor,
       * guardamos/actualizamos la copia local de forma segura.
       */
      if (this.caja && this.sqlite.disponible) {
        try {
          await this.sqlite.guardarCajaLocal(this.caja, 'SINCRONIZADA');
        } catch (err) {
          console.warn('[Cajero] No se pudo guardar caja local en SQLite:', err);
        }
      }
    } catch {
      /*
       * Si no existe conexión,
       * intentamos recuperar la caja local.
       */

      const idEmpleado = this.auth.sesion?.empleado.id;

      if (idEmpleado && this.sqlite.disponible) {
        this.caja = (await this.sqlite.cajaLocalAbierta(idEmpleado)) as unknown as Caja | null;
      }
    }

    if (this.caja) {
      await Promise.all([this.cargarProductos(), this.cargarMovimientos()]);

      this.enfocar();
    }

    this.cargando = false;
  }

  /* =========================================
     PRODUCTOS FILTRADOS
  ========================================= */

  get resultados(): ProductoPos[] {
    const termino = this.normalizar(this.busqueda);

    const productosFiltrados = termino
      ? this.productos.filter((producto) =>
          [producto.nombre, producto.codigoQR, producto.sku].some((valor) => this.normalizar(valor).includes(termino)),
        )
      : this.productos;

    return productosFiltrados.slice(0, 40);
  }

  /* =========================================
     CANTIDAD DE ARTÍCULOS
  ========================================= */

  get cantidadArticulos(): number {
    const articulosCarrito = this.carrito.reduce((total, item) => total + Number(item.cantidad), 0);
    return articulosCarrito + (Number(this.montoNotaAdicional || 0) > 0 ? 1 : 0);
  }

  /* =========================================
     TOTAL
  ========================================= */

  get total(): number {
    const totalCarrito = this.carrito.reduce((suma, item) => suma + Number(item.subtotal), 0);
    const montoExtra = Math.max(0, Number(this.montoNotaAdicional || 0));
    return Number((totalCarrito + montoExtra).toFixed(2));
  }

  /* =========================================
     CAMBIO
  ========================================= */

  get cambio(): number {
    if (this.metodoPago !== 'EFECTIVO') {
      return 0;
    }

    return Math.max(0, Number(this.montoRecibido || 0) - this.total);
  }

  /* =========================================
     VALIDACIÓN PARA COBRAR
  ========================================= */

  get puedeCobrar(): boolean {
    const tieneProductos = this.carrito.length > 0;
    const tieneExtra = Number(this.montoNotaAdicional || 0) > 0;
    if (this.metodoPago === 'FIADO') {
      return Boolean(
        this.caja && (tieneProductos || tieneExtra) && !this.procesandoVenta && this.clienteFiadoSeleccionado,
      );
    }
    return Boolean(
      this.caja &&
      (tieneProductos || tieneExtra) &&
      !this.procesandoVenta &&
      (this.metodoPago !== 'EFECTIVO' || (this.montoRecibido !== null && Number(this.montoRecibido) >= this.total)),
    );
  }

  /* =========================================
     DIFERENCIA DE CORTE
  ========================================= */

  get diferenciaInformativa(): number {
    return Number(this.efectivoContado || 0) - Number(this.resumen?.efectivoEsperado || 0);
  }

  /* =========================================
     ABRIR CAJA
  ========================================= */

  async abrirCaja(): Promise<void> {
    if (this.abriendo || this.fondoInicial === null || this.fondoInicial < 0) {
      return;
    }

    this.abriendo = true;

    const uuidSesionCaja = crypto.randomUUID();

    const empleado = this.auth.sesion?.empleado;

    try {
      this.caja = await firstValueFrom(this.cajas.abrir(uuidSesionCaja, Number(this.fondoInicial)));
      if (this.caja) {
        this.caja.uuidSesionCaja = this.caja.uuidSesionCaja || uuidSesionCaja;
      }

      if (this.caja && this.sqlite.disponible) {
        try {
          await this.sqlite.guardarCajaLocal(this.caja, 'SINCRONIZADA');
        } catch (err) {
          console.warn('[Cajero] Advertencia guardando caja local en SQLite:', err);
        }
      }
    } catch (error) {
      /*
       * Si el servidor reporta que ya existe una caja abierta (409),
       * recuperamos la sesión abierta automáticamente sin bloquear al usuario.
       */
      if (error instanceof HttpErrorResponse && error.status === 409) {
        try {
          const resp = await firstValueFrom(this.cajas.actual());
          if (resp.caja) {
            this.caja = resp.caja;
            this.caja.uuidSesionCaja = this.caja.uuidSesionCaja || uuidSesionCaja;
            await Promise.all([this.cargarProductos(), this.cargarMovimientos()]);
            this.enfocar();
            this.abriendo = false;
            return;
          }
        } catch {
          // Continúa al manejo estándar de error
        }
      }

      /*
       * Si NO es un error de conexión,
       * mostramos el error del backend.
       */
      if (!(error instanceof HttpErrorResponse && error.status === 0 && this.sqlite.disponible && empleado)) {
        await this.error(error, 'No fue posible abrir la caja.');

        this.abriendo = false;

        return;
      }

      /*
       * APERTURA OFFLINE
       */

      this.caja = {
        id: '',

        uuidSesionCaja,

        empleadoId: empleado.id,

        sucursalId: empleado.sucursalId,

        fechaHoraApertura: new Date().toISOString(),

        fondoInicial: Number(this.fondoInicial),

        fechaHoraCierre: null,

        totalVentas: 0,

        totalEfectivo: 0,

        totalTarjeta: 0,

        totalTransferencia: 0,

        totalIngresos: 0,

        totalRetiros: 0,

        efectivoEsperado: Number(this.fondoInicial),

        efectivoContado: null,

        diferencia: 0,

        numeroVentas: 0,

        estado: 'ABIERTA',

        observaciones: null,

        empleado: empleado.nombre,

        nombreSuc: empleado.nombreSuc || '',
      };

      if (this.caja) {
        try {
          await this.sqlite.guardarCajaLocal(this.caja, 'PENDIENTE');
        } catch (err) {
          console.warn('[Cajero] Advertencia guardando apertura offline en SQLite:', err);
        }
      }

      await this.sqlite.encolar(
        'APERTURA',

        uuidSesionCaja,

        {
          uuidSesionCaja,
          fondoInicial: Number(this.fondoInicial),
        },

        10,
      );

      await this.feedback('Caja abierta sin conexión. Pendiente de sincronizar.', 'warning');
    }

    await Promise.all([this.cargarProductos(), this.cargarMovimientos()]);

    this.enfocar();

    this.abriendo = false;
  }

  /* =========================================
     CARGAR PRODUCTOS
  ========================================= */

  async cargarProductos(): Promise<void> {
    this.cargandoProductos = true;
    try {
      const productos = await firstValueFrom(this.ventas.productos());
      this.productos = productos;

      if (this.sqlite.disponible) {
        void this.sqlite.sincronizarCatalogo(this.productos).catch((err) => {
          console.warn('[Cajero] Advertencia sincronizando catálogo local:', err);
        });
      }
    } catch {
      if (this.sqlite.disponible) {
        const productosLocales = await this.sqlite.getProductosLocales();

        this.productos = productosLocales as ProductoPos[];
      }

      if (!this.productos.length) {
        await this.feedback('No hay catálogo local disponible.', 'danger');
      }
    } finally {
      this.cargandoProductos = false;
    }
  }

  /* =========================================
     CARGAR MOVIMIENTOS
  ========================================= */

  async cargarMovimientos(): Promise<void> {
    try {
      this.movimientos = await firstValueFrom(this.cajas.movimientos());
    } catch {
      this.movimientos = [];
    }
  }

  /* =========================================
     AGREGAR PRODUCTO
  ========================================= */

  agregar(producto: ProductoPos): void {
    if (producto.existencia <= 0) {
      void this.feedback('Este producto no tiene existencias.', 'warning');

      return;
    }

    const itemExistente = this.carrito.find((item) => item.id === producto.id);

    if (itemExistente) {
      this.incrementar(itemExistente);

      return;
    }

    this.carrito = [
      ...this.carrito,

      {
        id: producto.id,

        nombre: producto.nombre,

        precioUnitario: Number(producto.precioVenta),

        cantidad: 1,

        existenciaDisponible: producto.existencia,

        subtotal: Number(producto.precioVenta),

        imagen: producto.imagen,
      },
    ];
  }

  /* =========================================
     AUMENTAR CANTIDAD
  ========================================= */

  incrementar(item: ItemVenta): void {
    if (item.cantidad >= item.existenciaDisponible) {
      void this.feedback(`Solo hay ${item.existenciaDisponible} unidades disponibles.`, 'warning');

      return;
    }

    item.cantidad++;

    item.subtotal = item.precioUnitario * item.cantidad;

    this.carrito = [...this.carrito];
  }

  /* =========================================
     DISMINUIR CANTIDAD
  ========================================= */

  decrementar(item: ItemVenta): void {
    if (item.cantidad <= 1) {
      this.eliminar(item);

      return;
    }

    item.cantidad--;

    item.subtotal = item.precioUnitario * item.cantidad;

    this.carrito = [...this.carrito];
  }

  /* =========================================
     ELIMINAR DEL CARRITO
  ========================================= */

  eliminar(item: ItemVenta): void {
    this.carrito = this.carrito.filter((producto) => producto.id !== item.id);
  }

  /* =========================================
     CÓDIGO / LECTOR HID
  ========================================= */

  agregarDesdeEntrada(): void {
    const codigo = this.busqueda.trim();

    if (!codigo) {
      return;
    }

    const producto = this.productos.find(
      (item) => item.codigoQR?.trim() === codigo || item.sku?.trim().toLowerCase() === codigo.toLowerCase(),
    );

    if (!producto) {
      void this.feedback('Producto no registrado. Verifica el código o búscalo por nombre.', 'warning');

      this.enfocar();

      return;
    }

    this.agregar(producto);

    /*
     * Después de un escaneo HID,
     * limpiamos y devolvemos foco.
     */

    this.busqueda = '';

    this.enfocar();
  }

  /* =========================================
     ESCÁNER DE CÁMARA
  ========================================= */

  async escanear(): Promise<void> {
    if (this.leyendoCodigo) {
      return;
    }

    this.leyendoCodigo = true;

    await this.scanFeedback.preparar();

    try {
      if (!Capacitor.isNativePlatform()) {
        const soporte = await BarcodeScanner.isSupported().catch(() => ({ supported: false }));
        if (!soporte.supported) {
          try {
            const foto = await Camera.getPhoto({
              source: CameraSource.Camera,
              resultType: CameraResultType.Uri,
              quality: 85,
              webUseInput: false,
            });
            const preview = foto.webPath || foto.path;
            if (preview && typeof (window as any).BarcodeDetector !== 'undefined') {
              const img = new Image();
              img.src = preview;
              await new Promise((res, rej) => {
                img.onload = res;
                img.onerror = rej;
              });
              const detector = new (window as any).BarcodeDetector();
              const detectados = await detector.detect(img);
              if (detectados.length > 0 && detectados[0].rawValue) {
                await this.scanFeedback.feedbackLecturaCorrecta();
                this.busqueda = detectados[0].rawValue.trim();
                this.agregarDesdeEntrada();
                return;
              }
            }
            await this.feedback(
              'Cámara utilizada. Escribe el código en la barra de búsqueda si no se autodetectó.',
              'warning',
            );
            return;
          } catch (camError: unknown) {
            const mensaje = camError instanceof Error ? camError.message.toLowerCase() : '';
            if (mensaje.includes('cancel')) return;
            await this.feedback('Cámara no disponible en este navegador. Puedes escribir el código.', 'warning');
            return;
          }
        }
      }

      const soporte = await BarcodeScanner.isSupported();

      if (!soporte.supported) {
        throw new Error();
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
        await this.feedback('Necesitas permitir acceso a la cámara.', 'warning');

        return;
      }

      const lectura = await BarcodeScanner.scan({
        formats: this.formatos,

        autoZoom: true,
      });

      const codigo = lectura.barcodes[0]?.rawValue?.trim();

      if (codigo) {
        await this.scanFeedback.feedbackLecturaCorrecta();

        this.busqueda = codigo;

        this.agregarDesdeEntrada();
      }
    } catch {
      await this.feedback('No se pudo usar la cámara. Puedes escribir el código.', 'danger');
    } finally {
      this.leyendoCodigo = false;

      this.enfocar();
    }
  }

  /* =========================================
     CAMBIAR MÉTODO DE PAGO
  ========================================= */

  cambiarMetodo(): void {
    if (this.metodoPago !== 'EFECTIVO') {
      this.montoRecibido = null;
    }
  }

  /* =========================================
     MODAL COBRO
  ========================================= */

  limpiarCarrito(): void {
    this.carrito = [];
    this.notaAdicional = '';
    this.montoNotaAdicional = null;
    this.clienteFiadoSeleccionado = null;
    this.busquedaClienteFiado = '';
  }

  abrirModalCobro(): void {
    if (this.carrito.length > 0 || Number(this.montoNotaAdicional || 0) > 0) {
      this.mostrarModalCobro = true;
      this.metodoPago = 'EFECTIVO';
      this.montoRecibido = null;
      this.clienteFiadoSeleccionado = null;
      this.busquedaClienteFiado = '';
      this.ticketVisible = true;
      void this.cargarClientesFiado();
    }
  }

  async cargarClientesFiado(): Promise<void> {
    try {
      this.clientesFiado = (await firstValueFrom(this.fiadoService.listarDeudores())) || [];
    } catch {
      this.clientesFiado = [];
    }
  }

  filtrarClientesFiado(): void {
    const q = this.busquedaClienteFiado.trim().toLowerCase();
    if (!q) {
      this.clientesFiadoSugeridos = this.clientesFiado.slice(0, 5);
      return;
    }
    this.clientesFiadoSugeridos = this.clientesFiado
      .filter((c) => (c.nombreCompleto || c.nombre || '').toLowerCase().includes(q) || (c.telefono || '').includes(q))
      .slice(0, 8);
  }

  seleccionarClienteFiado(c: ClienteDeudor): void {
    this.clienteFiadoSeleccionado = c;
    this.busquedaClienteFiado = c.nombreCompleto || c.nombre;
    this.clientesFiadoSugeridos = [];
  }

  async crearNuevoClienteFiadoRapido(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Nuevo Cliente para Fiado',
      subHeader: 'Registra un nuevo cliente para su cuenta corriente',
      inputs: [
        {
          name: 'nombreCompleto',
          type: 'text',
          placeholder: 'Nombre completo (ej: Doña Martha)',
        },
        {
          name: 'telefono',
          type: 'tel',
          placeholder: 'Teléfono / WhatsApp (10 dígitos)',
        },
        {
          name: 'limiteCredito',
          type: 'number',
          placeholder: 'Límite de crédito (opcional)',
          min: 0,
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Guardar y Seleccionar',
          handler: (data) => {
            const partes = (data.nombreCompleto || '').trim().split(' ');
            const nombreCliente = partes[0] || '';
            const apellidoPatCliente = partes.slice(1).join(' ') || undefined;
            const tel = (data.telefono || '').replace(/[^0-9]/g, '');

            if (nombreCliente.length < 2) {
              void this.feedback('El nombre debe tener al menos 2 letras', 'warning');
              return false;
            }
            if (tel.length < 10) {
              void this.feedback('El teléfono debe tener al menos 10 dígitos', 'warning');
              return false;
            }

            void (async () => {
              try {
                const nuevo = await firstValueFrom(
                  this.fiadoService.crearClienteRapido({
                    nombreCliente,
                    apellidoPatCliente,
                    telefono: tel,
                    limiteCredito: data.limiteCredito ? Number(data.limiteCredito) : undefined,
                  }),
                );
                this.clientesFiado.unshift(nuevo);
                this.seleccionarClienteFiado(nuevo);
                await this.feedback(`Cliente ${nuevo.nombreCompleto || nuevo.nombre} registrado.`, 'success');
              } catch (err: any) {
                await this.feedback(err?.error?.message || 'Error al registrar cliente', 'danger');
              }
            })();
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  /* =========================================
     COBRAR
  ========================================= */

  async cobrar(): Promise<void> {
    if (!this.puedeCobrar || !this.caja) {
      return;
    }

    this.procesandoVenta = true;

    const uuidVenta = crypto.randomUUID();
    const extra = Math.max(0, Number(this.montoNotaAdicional || 0));

    const dto: any = {
      uuidVenta,

      items: this.carrito.map((item) => ({
        id: item.id,
        cantidad: item.cantidad,
      })),

      metodoPago: this.metodoPago,

      idCliente: this.metodoPago === 'FIADO' && this.clienteFiadoSeleccionado ? this.clienteFiadoSeleccionado.id : null,

      clienteNombre:
        this.metodoPago === 'FIADO' && this.clienteFiadoSeleccionado
          ? this.clienteFiadoSeleccionado.nombreCompleto
          : null,

      montoRecibido: this.metodoPago === 'EFECTIVO' ? Number(this.montoRecibido) : null,

      nota: this.notaAdicional.trim() || null,

      montoNota: extra > 0 ? extra : null,
    };

    try {
      /*
       * ONLINE:
       * el backend registra venta,
       * detalle y descuenta inventario.
       */

      const venta = await firstValueFrom(this.ventas.cobrar(dto));

      await this.confirmarVenta(venta);
    } catch (error) {
      const empleado = this.auth.sesion?.empleado;

      /*
       * Si no fue una pérdida de red,
       * no creamos venta offline.
       */

      if (!(error instanceof HttpErrorResponse && error.status === 0 && this.sqlite.disponible && empleado)) {
        await this.error(error, 'No fue posible registrar la venta.');

        this.procesandoVenta = false;

        return;
      }

      /*
       * VENTA OFFLINE
       */

      const itemsOffline = this.carrito.map((item) => ({
        id: item.id,

        nombre: item.nombre,

        cantidad: item.cantidad,

        precioUnitario: item.precioUnitario,

        subtotal: item.subtotal,
      }));

      if (extra > 0) {
        itemsOffline.push({
          id: '0',
          nombre: this.notaAdicional.trim() ? `Extra: ${this.notaAdicional.trim()}` : 'Artículo adicional sin código',
          cantidad: 1,
          precioUnitario: extra,
          subtotal: extra,
        });
      }

      await this.sqlite.guardarVentaOffline({
        uuidVenta,

        uuidSesionCaja: this.caja.uuidSesionCaja,

        empleadoId: empleado.id,

        sucursalId: empleado.sucursalId,

        total: this.total,

        metodoPago: this.metodoPago,

        montoRecibido: dto.montoRecibido,

        items: itemsOffline,
      });

      await this.sqlite.encolar(
        'VENTA',

        uuidVenta,

        dto,

        Date.now(),
      );

      await this.feedback('Venta guardada sin conexión. Pendiente de sincronizar.', 'warning');
    }

    /*
     * Limpiar venta.
     */

    this.mostrarModalCobro = false;
    this.carrito = [];
    this.notaAdicional = '';
    this.montoNotaAdicional = null;
    this.montoRecibido = null;
    this.metodoPago = 'EFECTIVO';
    this.clienteFiadoSeleccionado = null;
    this.busquedaClienteFiado = '';
    this.ticketVisible = false;

    /*
     * Refrescar catálogo.
     *
     * ONLINE:
     * obtiene stock actualizado MySQL.
     *
     * OFFLINE:
     * obtiene stock actualizado SQLite.
     */

    await this.cargarProductos();

    this.enfocar();

    this.procesandoVenta = false;
  }

  /* =========================================
     MOVIMIENTO DE CAJA
  ========================================= */

  async registrarMovimiento(): Promise<void> {
    if (!this.caja || !this.montoMovimiento || this.montoMovimiento <= 0 || !this.conceptoMovimiento.trim()) {
      return;
    }

    const uuidMovimientoCaja = crypto.randomUUID();

    const payload = {
      uuidMovimientoCaja,

      tipoMovimiento: this.tipoMovimiento,

      monto: Number(this.montoMovimiento),

      concepto: this.conceptoMovimiento.trim(),
    };

    try {
      await firstValueFrom(
        this.cajas.registrarMovimiento(
          uuidMovimientoCaja,

          payload.tipoMovimiento,

          payload.monto,

          payload.concepto,
        ),
      );

      await this.feedback('Movimiento registrado.', 'success');
    } catch (error) {
      const empleado = this.auth.sesion?.empleado;

      if (!(error instanceof HttpErrorResponse && error.status === 0 && this.sqlite.disponible && empleado)) {
        await this.error(error, 'No fue posible registrar el movimiento.');

        return;
      }

      /*
       * MOVIMIENTO OFFLINE
       */

      await this.sqlite.guardarMovimientoOffline({
        ...payload,

        uuidSesionCaja: this.caja.uuidSesionCaja,

        empleadoId: empleado.id,
      });

      await this.sqlite.encolar(
        'MOVIMIENTO',

        uuidMovimientoCaja,

        payload,

        Date.now(),
      );

      await this.feedback('Movimiento guardado sin conexión. Pendiente de sincronizar.', 'warning');
    }

    this.mostrarMovimiento = false;

    this.montoMovimiento = null;

    this.conceptoMovimiento = '';

    await this.cargarMovimientos();
  }

  /* =========================================
     ABRIR CORTE
  ========================================= */

  async abrirCorte(): Promise<void> {
    if (!this.caja) {
      await this.feedback('No hay una caja abierta para realizar el corte.', 'warning');
      return;
    }

    this.mostrarCorte = true;
    this.cargandoCorte = true;
    this.efectivoContado = null;
    this.observaciones = '';

    try {
      this.resumen = await firstValueFrom(this.cajas.resumen());
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === 0 && this.sqlite.disponible)) {
        await this.error(error, 'No fue posible calcular el corte.');
        this.mostrarCorte = false;
        return;
      }

      /*
       * RESUMEN OFFLINE
       */

      const resumenLocal = await this.sqlite.resumenCajaLocal(this.caja.uuidSesionCaja);

      this.resumen = {
        ...this.caja,

        ...resumenLocal,

        efectivoEsperado:
          Number(this.caja.fondoInicial) +
          Number(resumenLocal.totalEfectivo) +
          Number(resumenLocal.totalIngresos) -
          Number(resumenLocal.totalRetiros),
      };
    } finally {
      this.cargandoCorte = false;
    }
  }

  /* =========================================
     CERRAR CAJA
  ========================================= */

  async cerrarCaja(): Promise<void> {
    if (!this.caja || this.efectivoContado === null || this.efectivoContado < 0 || this.cerrando) {
      return;
    }

    const confirmado = await this.dialog.confirm({
      title: 'Cerrar caja',
      message: 'Una caja cerrada no puede modificarse. ¿Deseas continuar?',
      type: 'warning',
      icon: 'lock',
      confirmText: 'Cerrar caja',
      cancelText: 'Cancelar',
    });

    if (!confirmado) {
      return;
    }

    this.cerrando = true;

    const uuidSesionCaja = this.caja.uuidSesionCaja;

    const payload = {
      uuidSesionCaja,

      efectivoContado: Number(this.efectivoContado),

      observaciones: this.observaciones.trim(),
    };

    try {
      /*
       * CIERRE ONLINE
       */

      this.ultimaCaja = await firstValueFrom(
        this.cajas.cerrar(
          payload.efectivoContado,

          payload.observaciones,
        ),
      );

      /*
       * MUY IMPORTANTE:
       * cerrar también copia SQLite.
       */

      if (this.sqlite.disponible) {
        await this.sqlite.marcarCajaCerrada(
          uuidSesionCaja,

          'SINCRONIZADA',

          this.ultimaCaja,
        );
      }
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === 0 && this.sqlite.disponible)) {
        await this.error(error, 'No fue posible cerrar la caja.');

        this.cerrando = false;

        return;
      }

      /*
       * CIERRE OFFLINE
       */

      await this.sqlite.cerrarCajaOffline(
        uuidSesionCaja,

        payload.efectivoContado,

        payload.observaciones,
      );

      /*
       * El cierre queda después
       * de operaciones anteriores.
       */

      await this.sqlite.encolar(
        'CIERRE',

        `${uuidSesionCaja}-cierre`,

        payload,

        Number.MAX_SAFE_INTEGER,
      );

      this.ultimaCaja = {
        ...this.resumen!,

        efectivoContado: payload.efectivoContado,

        diferencia: payload.efectivoContado - Number(this.resumen?.efectivoEsperado || 0),

        estado: 'CERRADA',

        fechaHoraCierre: new Date().toISOString(),

        observaciones: payload.observaciones,
      };

      await this.feedback(
        'Cierre guardado sin conexión. Se completará al sincronizar operaciones pendientes.',
        'warning',
      );
    }

    this.caja = null;

    this.mostrarCorte = false;

    this.carrito = [];
    this.notaAdicional = '';
    this.montoNotaAdicional = null;

    this.cerrando = false;
  }

  /* =========================================
     IMÁGENES
  ========================================= */

  imagen(ruta: string | null): string | null {
    return this.imagenes.resolver(ruta);
  }

  mostrarImagen(evento: Event): void {
    const imagen = evento.target as HTMLImageElement;

    imagen.style.display = '';
  }

  ocultarImagen(evento: Event): void {
    const imagen = evento.target as HTMLImageElement;

    imagen.style.display = 'none';
  }

  /* =========================================
     BARRA MÓVIL
  ========================================= */

  irAlResumen(): void {
    this.ticketVisible = true;
    document.getElementById('resumenVenta')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  /* =========================================
     FOCO DEL LECTOR HID
  ========================================= */

  private enfocar(): void {
    setTimeout(() => {
      const el = (this.lector as any)?.nativeElement || this.lector;
      if (typeof el?.focus === 'function') {
        el.focus();
      } else if (typeof el?.setFocus === 'function') {
        void el.setFocus();
      }
    }, 80);
  }

  /* =========================================
     NORMALIZAR BÚSQUEDA
  ========================================= */

  private normalizar(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  /* =========================================
     MOSTRAR ERROR
  ========================================= */

  private async error(error: unknown, mensajeFallback: string): Promise<void> {
    const mensaje = error instanceof HttpErrorResponse && error.error?.message ? error.error.message : mensajeFallback;

    await this.feedback(mensaje, 'danger');
  }

  /* =========================================
     TOAST
  ========================================= */

  private async feedback(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toast.create({
      message,

      color,

      duration: 3000,

      position: 'top',
    });

    await toast.present();
  }

  /* =========================================
     VENTA REALIZADA
  ========================================= */

  private async confirmarVenta(venta?: VentaRegistrada | null): Promise<void> {
    const total = venta?.total ?? this.total;
    const cambio = venta?.cambio ?? this.cambio;
    const folio = venta?.id ? `Folio #${venta.id}` : 'Venta procesada';
    const esFiado = (venta?.metodoPago ?? this.metodoPago) === 'FIADO';

    const mensaje = esFiado
      ? `${folio} — Total: ${this.moneda(total)} · Cargado a cuenta corriente de fiado`
      : `${folio} — Total: ${this.moneda(total)} · Cambio: ${this.moneda(cambio)}`;

    const confirmado = await this.dialog.confirm({
      title: esFiado ? '¡Fiado registrado con éxito!' : '¡Venta realizada!',
      message: mensaje,
      type: 'success',
      icon: esFiado ? 'menu_book' : 'check_circle',
      confirmText: venta?.id ? 'Ver comprobante' : 'Aceptar',
      cancelText: 'Nueva venta',
    });

    if (confirmado && venta?.id) {
      location.assign(`/ventas/${venta.id}`);
    }
  }

  /* =========================================
     FORMATO MONEDA
  ========================================= */

  private moneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(Number(valor));
  }
}
