import { Container, appContainer, TOKENS } from '../../src/container';
import { UploadsController } from '../../src/modules/uploads/uploads.controller';
import { UploadsService } from '../../src/modules/uploads/uploads.service';
import { ProductosController } from '../../src/modules/productos/productos.controller';
import { ProductosService } from '../../src/modules/productos/productos.service';
import { VentasController } from '../../src/modules/ventas/ventas.controller';
import { VentasService } from '../../src/modules/ventas/ventas.service';
import { CajaController } from '../../src/modules/caja/caja.controller';
import { CajaService } from '../../src/modules/caja/caja.service';
import { PedidosController } from '../../src/modules/pedidos/pedidos.controller';
import { PedidosService } from '../../src/modules/pedidos/pedidos.service';
import { PaymentStrategyRegistry } from '../../src/modules/ventas/payment.strategy';

describe('Dependency Inversion Principle (DIP) - Container & Constructor Injection', () => {
  describe('IoC Container (Serverless Lightweight DI)', () => {
    let container: Container;

    beforeEach(() => {
      container = new Container();
    });

    it('debe registrar y resolver una instancia concreta mediante token', () => {
      const mockStorage = { esS3: () => true, extraerKey: () => 'key1' };
      container.register('IStorageService', mockStorage);

      const resolved = container.resolve<typeof mockStorage>('IStorageService');
      expect(resolved).toBe(mockStorage);
      expect(resolved.esS3()).toBe(true);
    });

    it('debe registrar y resolver mediante factory perezosa con memoización', () => {
      let invocaciones = 0;
      container.registerFactory('CounterService', () => {
        invocaciones++;
        return { count: invocaciones };
      });

      expect(invocaciones).toBe(0);
      const res1 = container.resolve<{ count: number }>('CounterService');
      expect(invocaciones).toBe(1);
      expect(res1.count).toBe(1);

      // Segunda llamada debe retornar la misma instancia en caché
      const res2 = container.resolve<{ count: number }>('CounterService');
      expect(invocaciones).toBe(1);
      expect(res2).toBe(res1);
    });

    it('debe lanzar error informativo al resolver una dependencia no registrada', () => {
      expect(() => container.resolve('ServicioInexistente')).toThrow(
        'Dependencia no registrada en el contenedor: ServicioInexistente',
      );
    });

    it('debe permitir crear un sub-scope y sobrescribir dependencias sin mutar el contenedor raíz', () => {
      container.register('EnvConfig', { stage: 'prod' });
      const scope = container.createScope();
      scope.register('EnvConfig', { stage: 'test' });

      expect(container.resolve<{ stage: string }>('EnvConfig').stage).toBe('prod');
      expect(scope.resolve<{ stage: string }>('EnvConfig').stage).toBe('test');
    });

    it('el appContainer global debe resolver las dependencias base registradas', () => {
      expect(appContainer.has(TOKENS.StorageService)).toBe(true);
      expect(appContainer.has(TOKENS.ProductoRepository)).toBe(true);
      expect(appContainer.has(TOKENS.CajaRepository)).toBe(true);
      expect(appContainer.has(TOKENS.PedidoRepository)).toBe(true);
      expect(appContainer.has(TOKENS.VentaRepository)).toBe(true);
      expect(appContainer.has(TOKENS.ConfiguracionRepository)).toBe(true);
      expect(appContainer.has(TOKENS.AuthRepository)).toBe(true);

      const storage = appContainer.resolve(TOKENS.StorageService);
      expect(storage).toBeDefined();
    });
  });

  describe('DIP: Uploads Module Inversion', () => {
    it('UploadsController debe aceptar un IUploadsService simulado por constructor', async () => {
      const mockUploadsService = {
        solicitarPresign: jest.fn().mockResolvedValue({ uploadUrl: 'https://s3.amazonaws.com/test' }),
      };

      const controller = new UploadsController(mockUploadsService as any);

      const req: any = {
        headers: { authorization: 'Bearer dummy.token.test' },
        body: { tipo: 'PRODUCTO', mimeType: 'image/jpeg' },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Mock verificarToken para la prueba
      const security = require('../../src/utils/security');
      const spyToken = jest.spyOn(security, 'verificarToken').mockReturnValue({ sub: 1, tipo: 'EMPLEADO' });

      await controller.presign(req, res);

      expect(mockUploadsService.solicitarPresign).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ uploadUrl: 'https://s3.amazonaws.com/test' });

      spyToken.mockRestore();
    });

    it('UploadsService debe delegar la validación y generación a IStorageService inyectado', async () => {
      const mockStorage: any = {
        esMimePermitidoComprobante: jest.fn().mockReturnValue(true),
        generarPresignedUpload: jest.fn().mockResolvedValue({
          uploadUrl: 'https://s3.amazonaws.com/upload',
          key: 'comprobantes/recibo.pdf',
          publicUrl: 'https://s3.amazonaws.com/upload/recibo.pdf',
        }),
      };

      const service = new UploadsService(mockStorage, {} as any);

      const resultado = await service.solicitarPresign(
        { sub: 5, tipo: 'CLIENTE' },
        { tipo: 'COMPROBANTE', mimeType: 'application/pdf', nombreOriginal: 'recibo.pdf' },
      );

      expect(mockStorage.esMimePermitidoComprobante).toHaveBeenCalledWith('application/pdf');
      expect(mockStorage.generarPresignedUpload).toHaveBeenCalled();
      expect(resultado.key).toBe('comprobantes/recibo.pdf');
    });
  });

  describe('DIP: Productos Module Inversion', () => {
    it('ProductosController debe interactuar exclusivamente con la abstracción IProductosService', async () => {
      const mockProductosService = {
        listarPublico: jest.fn().mockResolvedValue([{ id: 'p1', nombre: 'Camisa' }]),
        listarAdmin: jest.fn(),
        listarPos: jest.fn(),
        buscarPorQR: jest.fn(),
        obtenerProducto: jest.fn(),
        consultarExterno: jest.fn(),
        crear: jest.fn(),
        actualizar: jest.fn(),
        eliminar: jest.fn(),
      };

      const controller = new ProductosController(mockProductosService as any);
      const req: any = {};
      const res: any = { json: jest.fn() };

      await controller.listarPublico(req, res);

      expect(mockProductosService.listarPublico).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith([{ id: 'p1', nombre: 'Camisa' }]);
    });

    it('ProductosService debe depender de repositorios y storage inyectados en DynamoDB mode', async () => {
      const originalTable = process.env.DYNAMODB_TABLE;
      process.env.DYNAMODB_TABLE = 'MiTiendaTable';

      try {
        const mockRepo = {
          getProductoById: jest.fn().mockResolvedValue({
            idPro: 10,
            nombrePro: 'Gorra',
            precioVentaPro: 150,
            activoPro: true,
          }),
        };
        const mockStorage: any = {
          generarPresignedUpload: jest.fn().mockResolvedValue({ uploadUrl: 'https://s3.amazonaws.com/test' }),
        };

        const service = new ProductosService(undefined, mockRepo as any, mockStorage);

        const producto = await service.obtenerProducto(10);
        expect(mockRepo.getProductoById).toHaveBeenCalledWith(10);
        expect(producto?.nombre).toBe('Gorra');

        const presign = await service.presignImagen(10, 'image/jpeg');
        expect(mockStorage.generarPresignedUpload).toHaveBeenCalledWith(
          expect.objectContaining({
            folder: 'productos',
            mimeType: 'image/jpeg',
            nombreArchivoOriginal: 'Gorra',
          }),
        );
        expect(presign.uploadUrl).toBe('https://s3.amazonaws.com/test');
      } finally {
        if (originalTable) {
          process.env.DYNAMODB_TABLE = originalTable;
        } else {
          delete process.env.DYNAMODB_TABLE;
        }
      }
    });
  });

  describe('DIP: Ventas Module Inversion', () => {
    it('VentasController debe recibir IVentasService inyectado', async () => {
      const mockVentasService = {
        listarVentas: jest.fn().mockResolvedValue([{ id: 'v1', total: 100 }]),
      };

      const controller = new VentasController(mockVentasService as any);
      const req: any = { empleado: { idEmp: 1, idSuc: 1, cargo: 'ADMIN' } };
      const res: any = { json: jest.fn() };

      await controller.listar(req, res);

      expect(mockVentasService.listarVentas).toHaveBeenCalledWith({
        idEmp: 1,
        idSuc: 1,
        cargo: 'ADMIN',
      });
      expect(res.json).toHaveBeenCalledWith([{ id: 'v1', total: 100 }]);
    });

    it('VentasService debe permitir inyectar PaymentStrategyRegistry y repositorios desacoplados', () => {
      const customRegistry = new PaymentStrategyRegistry();
      const mockCajaRepo = { getSesionAbierta: jest.fn() };
      const mockProdRepo = { getProductoById: jest.fn() };
      const mockVentaRepo = { listVentas: jest.fn() };

      const service = new VentasService(customRegistry, mockCajaRepo, mockProdRepo, mockVentaRepo);
      expect(service).toBeDefined();
    });
  });

  describe('DIP: Caja Module Inversion', () => {
    it('CajaController debe recibir ICajaService inyectado en su constructor', async () => {
      const mockCajaService = {
        obtenerCajaActual: jest.fn().mockResolvedValue({ idSesionCaja: 5, estado: 'ABIERTA' }),
      };

      const controller = new CajaController(mockCajaService as any);
      const req: any = { empleado: { idEmp: 2, idSuc: 1 } };
      const res: any = { json: jest.fn() };

      await controller.actual(req, res);

      expect(mockCajaService.obtenerCajaActual).toHaveBeenCalledWith(2);
      expect(res.json).toHaveBeenCalledWith({ caja: { idSesionCaja: 5, estado: 'ABIERTA' } });
    });

    it('CajaService debe operar con repositorios inyectados en modo DynamoDB', async () => {
      const originalTable = process.env.DYNAMODB_TABLE;
      process.env.DYNAMODB_TABLE = 'MiTiendaTable';

      try {
        const mockCajaRepo = {
          getSesionAbierta: jest.fn().mockResolvedValue({
            idSesionCaja: 12,
            idSuc: 1,
            idEmp: 3,
            fondoInicial: 500,
            estado: 'ABIERTA',
          }),
        };

        const service = new CajaService(mockCajaRepo, {} as any);
        const caja = await service.obtenerCajaActual(3);

        expect(mockCajaRepo.getSesionAbierta).toHaveBeenCalledWith(1, 3);
        expect(caja?.estado).toBe('ABIERTA');
      } finally {
        if (originalTable) {
          process.env.DYNAMODB_TABLE = originalTable;
        } else {
          delete process.env.DYNAMODB_TABLE;
        }
      }
    });
  });

  describe('DIP: Pedidos Module Inversion', () => {
    it('PedidosController debe recibir IPedidosService inyectado en su constructor', async () => {
      const mockPedidosService = {
        liberarPedidosExpirados: jest.fn().mockResolvedValue(undefined),
        listarPedidosCliente: jest.fn().mockResolvedValue([{ id: 'ped1', total: 250 }]),
      };

      const controller = new PedidosController(mockPedidosService as any);
      const req: any = { cliente: { idCliente: 4 } };
      const res: any = { json: jest.fn() };

      await controller.listarPedidosCliente(req, res);

      expect(mockPedidosService.liberarPedidosExpirados).toHaveBeenCalledWith(4);
      expect(mockPedidosService.listarPedidosCliente).toHaveBeenCalledWith(4);
      expect(res.json).toHaveBeenCalledWith([{ id: 'ped1', total: 250 }]);
    });

    it('PedidosService debe operar con dependencias inyectadas en modo DynamoDB', async () => {
      const originalTable = process.env.DYNAMODB_TABLE;
      process.env.DYNAMODB_TABLE = 'MiTiendaTable';

      try {
        const mockConfigRepo = {
          getConfiguracion: jest.fn().mockResolvedValue({ idSuc: 1, activo: true, banco: 'Banco Nacional' }),
        };
        const mockPedidoRepo = {
          listPedidosAdmin: jest.fn().mockResolvedValue([{ idPedido: 99, totalPedido: 350 }]),
        };

        const service = new PedidosService(
          undefined,
          undefined,
          mockPedidoRepo,
          undefined,
          mockConfigRepo,
        );

        const config = await service.obtenerConfiguracionTransferencia(1);
        expect(mockConfigRepo.getConfiguracion).toHaveBeenCalledWith(1);
        expect(config.banco).toBe('Banco Nacional');

        const pedidosAdmin = await service.listarPedidosAdmin(1);
        expect(mockPedidoRepo.listPedidosAdmin).toHaveBeenCalledWith(1);
        expect(pedidosAdmin[0].total).toBe(350);
      } finally {
        if (originalTable) {
          process.env.DYNAMODB_TABLE = originalTable;
        } else {
          delete process.env.DYNAMODB_TABLE;
        }
      }
    });
  });
});
