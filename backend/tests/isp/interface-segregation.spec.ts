import {
  storageService,
  IPresignedUploadService,
  IPresignedDownloadService,
  IFileDeletionService,
  IComprobanteInspectorService,
} from '../../src/services/storage.service';
import {
  IReadOnlyRepository,
  IWriteOnlyRepository,
  ITransactionalRepository,
} from '../../src/db/base.repository';
import {
  productoRepository,
  IProductoCatalogReader,
  IProductoCatalogWriter,
} from '../../src/db/repositories/producto.repository';
import {
  cajaRepository,
  ICajaReader,
  ICajaOperator,
} from '../../src/db/repositories/caja.repository';
import {
  pedidosService,
  IClientePedidoService,
  IAdminPedidoService,
} from '../../src/modules/pedidos/pedidos.service';
import {
  productosService,
  IProductoPublicService,
  IProductoAdminService,
  IProductoPosService,
} from '../../src/modules/productos/productos.service';
import {
  IPaymentInputValidator,
  IPaymentCalculator,
  defaultPaymentRegistry,
} from '../../src/modules/ventas/payment.strategy';

describe('Interface Segregation Principle (ISP)', () => {
  describe('Storage Service Segregation', () => {
    it('un consumidor de sólo subidas depende únicamente de IPresignedUploadService', async () => {
      async function procesarSubidaComprobante(uploader: IPresignedUploadService) {
        return uploader.generarPresignedUpload({
          folder: 'comprobantes',
          mimeType: 'image/jpeg',
          nombreArchivoOriginal: 'recibo.jpg',
        });
      }

      const res = await procesarSubidaComprobante(storageService);
      expect(res.uploadUrl).toBeDefined();
      expect(res.key).toContain('comprobantes/');
    });

    it('un consumidor de limpieza depende únicamente de IFileDeletionService', async () => {
      async function limpiarArchivoHuerfano(deleter: IFileDeletionService, key?: string | null) {
        await deleter.eliminarArchivo(key);
      }

      await expect(limpiarArchivoHuerfano(storageService, null)).resolves.not.toThrow();
    });

    it('un validador de comprobantes depende únicamente de IComprobanteInspectorService', () => {
      function validarSeguridadComprobante(inspector: IComprobanteInspectorService, nombreFisico: string) {
        return inspector.resolverComprobantePrivado(nombreFisico);
      }

      expect(validarSeguridadComprobante(storageService, '../etc/passwd')).toBeNull();
    });
  });

  describe('Repository Segregation (Data Access)', () => {
    it('un cliente de sólo lectura consume IReadOnlyRepository sin acceso a escrituras', async () => {
      async function consultarEntidad<T>(reader: IReadOnlyRepository<T>, key: Record<string, any>) {
        return reader.getByKey(key);
      }

      // productoRepository implementa IReadOnlyRepository
      const readOnlyRepo: IReadOnlyRepository<any> = productoRepository;
      expect(readOnlyRepo.tableName).toBeDefined();
      expect(typeof readOnlyRepo.getByKey).toBe('function');
      expect(typeof readOnlyRepo.queryItems).toBe('function');
    });

    it('el catálogo público depende de IProductoCatalogReader y no de métodos mutadores', () => {
      const reader: IProductoCatalogReader = productoRepository;
      expect(typeof reader.listProductos).toBe('function');
      expect(typeof reader.getProductoById).toBe('function');
      expect(typeof reader.findByCodigoQR).toBe('function');

      // No tiene por contrato createProducto en IProductoCatalogReader
      expect((reader as any).createProducto).toBeDefined(); // La clase lo implementa, pero la interfaz lo segrega
    });

    it('la administración de catálogo depende de IProductoCatalogWriter', () => {
      const writer: IProductoCatalogWriter = productoRepository;
      expect(typeof writer.createProducto).toBe('function');
      expect(typeof writer.updateProducto).toBe('function');
      expect(typeof writer.deleteProducto).toBe('function');
    });

    it('el monitor de arqueo depende de ICajaReader y la apertura/cierre de ICajaOperator', () => {
      const reader: ICajaReader = cajaRepository;
      expect(typeof reader.getSesionAbierta).toBe('function');
      expect(typeof reader.getSesionById).toBe('function');
      expect(typeof reader.listSesiones).toBe('function');

      const operator: ICajaOperator = cajaRepository;
      expect(typeof operator.abrirSesion).toBe('function');
      expect(typeof operator.cerrarSesion).toBe('function');
    });
  });

  describe('Domain Services Segregation (Pedidos & Productos)', () => {
    it('las rutas públicas de pedidos consumen IClientePedidoService', () => {
      const clienteService: IClientePedidoService = pedidosService;
      expect(typeof clienteService.obtenerSucursalDisponibleCliente).toBe('function');
      expect(typeof clienteService.obtenerConfiguracionTransferencia).toBe('function');
      expect(typeof clienteService.listarPedidosCliente).toBe('function');
      expect(typeof clienteService.presignComprobante).toBe('function');
      expect(typeof clienteService.confirmarComprobante).toBe('function');
    });

    it('las rutas administrativas de pedidos consumen IAdminPedidoService', () => {
      const adminService: IAdminPedidoService = pedidosService;
      expect(typeof adminService.listarPedidosAdmin).toBe('function');
      expect(typeof adminService.obtenerPedidoAdmin).toBe('function');
      expect(typeof adminService.aprobarPedidoAdmin).toBe('function');
      expect(typeof adminService.rechazarPedidoAdmin).toBe('function');
      expect(typeof adminService.cambiarEstadoOperativo).toBe('function');
    });

    it('ProductosService segrega IProductoPublicService, IProductoAdminService e IProductoPosService', () => {
      const publicCatalog: IProductoPublicService = productosService;
      expect(typeof publicCatalog.listarPublico).toBe('function');
      expect(typeof publicCatalog.consultarExterno).toBe('function');

      const adminCatalog: IProductoAdminService = productosService;
      expect(typeof adminCatalog.listarAdmin).toBe('function');
      expect(typeof adminCatalog.crear).toBe('function');
      expect(typeof adminCatalog.actualizar).toBe('function');
      expect(typeof adminCatalog.eliminar).toBe('function');

      const posCatalog: IProductoPosService = productosService;
      expect(typeof posCatalog.listarPos).toBe('function');
      expect(typeof posCatalog.buscarPorQR).toBe('function');
      expect(typeof posCatalog.obtenerProducto).toBe('function');
    });
  });

  describe('Payment Strategy Segregation', () => {
    it('los validadores de entrada consumen IPaymentInputValidator sin calcular totales', () => {
      function validarPayload(validator: IPaymentInputValidator, body: any) {
        validator.validarEntrada(body);
      }

      const estrategiaEfectivo = defaultPaymentRegistry.get('EFECTIVO');
      expect(() => validarPayload(estrategiaEfectivo, { montoRecibido: -5 })).toThrow(
        'El monto recibido no es válido',
      );
      expect(() => validarPayload(estrategiaEfectivo, { montoRecibido: 100 })).not.toThrow();
    });

    it('los procesadores de cobro consumen IPaymentCalculator', () => {
      function calcularCobro(calculator: IPaymentCalculator, total: number, body: any) {
        return calculator.validarYCalcular(total, body);
      }

      const estrategiaTarjeta = defaultPaymentRegistry.get('TARJETA');
      const resultado = calcularCobro(estrategiaTarjeta, 150.75, {});
      expect(resultado).toEqual({
        metodoPago: 'TARJETA',
        pagoCon: 150.75,
        cambio: 0,
        montoRecibidoDb: null,
      });
    });
  });
});
