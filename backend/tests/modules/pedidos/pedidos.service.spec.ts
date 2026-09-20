import fs from 'fs';
import {
  pedidosService,
  normalizarConfiguracionTransferencia,
  normalizarPedidoAdmin,
  normalizarPedido,
  configuracionTransferenciaPedido,
  resolverComprobantePrivado,
  mimeRealComprobante,
} from '../../../src/modules/pedidos/pedidos.service';
import { pedidoRepository } from '../../../src/db/repositories/pedido.repository';
import { productoRepository } from '../../../src/db/repositories/producto.repository';
import { configuracionRepository } from '../../../src/db/repositories/configuracion.repository';
import { authRepository } from '../../../src/db/repositories/auth.repository';
import { storageService } from '../../../src/services/storage.service';
import { crearPedidoSchema } from '../../../src/schemas/pedido.schema';

describe('PedidosService Complete Branch Coverage', () => {
  const dummyProducto = {
    idPro: 1,
    nombrePro: 'Sabritas Sal',
    precioVentaPro: 20,
    existenciaPro: 100,
    activoPro: true,
  };

  beforeEach(() => {
    jest.spyOn(authRepository, 'findClienteById').mockResolvedValue({
      idCliente: 1,
      nombreCliente: 'Test',
      apellidoPatCliente: 'User',
      correoCliente: 'test@user.com',
      estadoCliente: true,
    } as any);
    jest.spyOn(authRepository, 'findEmpleadoById').mockResolvedValue({
      idEmp: 1,
      idSuc: 1,
      idCargo: 1,
      nombreEmp: 'Admin',
      apellidoPatEmp: 'Tienda',
      correoEmp: 'admin@tienda.com',
      estadoEmp: true,
      contrasenaHash: 'hash',
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Funciones Puras y Helpers', () => {
    it('normalizarConfiguracionTransferencia', () => {
      expect(normalizarConfiguracionTransferencia(null)).toBeNull();
      const conf = { banco: 'BBVA', titular: 'Tienda', clabe: '123', activo: true };
      expect(normalizarConfiguracionTransferencia(conf as any, false)?.banco).toBe('BBVA');
      expect(normalizarConfiguracionTransferencia(conf as any, true)?.banco).toBe('BBVA');
    });

    it('normalizarPedidoAdmin, normalizarPedido y configuracionTransferenciaPedido', () => {
      const pedido = {
        idPedido: 1,
        uuidPedido: 'uuid',
        total: 100,
        estado: 'PENDIENTE_PAGO',
        bancoSnapshot: 'BBVA',
        detalles: [],
      };
      expect(normalizarPedidoAdmin(pedido as any).id).toBeDefined();
      expect(normalizarPedido(pedido as any).id).toBeDefined();
      expect(configuracionTransferenciaPedido(pedido as any)?.banco).toBe('BBVA');
      expect(configuracionTransferenciaPedido({} as any)).toBeNull();
    });

    it('resolverComprobantePrivado y mimeRealComprobante', () => {
      expect(resolverComprobantePrivado(null)).toBeNull();
      expect(resolverComprobantePrivado('https://s3.amazonaws.com/test.jpg')).toBeNull();
      expect(resolverComprobantePrivado('../test.jpg')).toBeNull();

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      expect(resolverComprobantePrivado('archivo.jpg')).toBeDefined();

      jest.spyOn(fs, 'openSync').mockReturnValue(123 as any);
      jest.spyOn(fs, 'closeSync').mockReturnValue(undefined as any);

      // JPEG
      jest.spyOn(fs, 'readSync').mockImplementation(((fd: any, buf: Buffer) => {
        buf.set([0xff, 0xd8, 0xff, 0xe0]);
        return 4;
      }) as any);
      expect(mimeRealComprobante('archivo-dummy.jpg')).toBe('image/jpeg');

      // PNG
      jest.spyOn(fs, 'readSync').mockImplementation(((fd: any, buf: Buffer) => {
        buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        return 8;
      }) as any);
      expect(mimeRealComprobante('archivo-dummy.png')).toBe('image/png');

      // PDF
      jest.spyOn(fs, 'readSync').mockImplementation(((fd: any, buf: Buffer) => {
        buf.set([0x25, 0x50, 0x44, 0x46, 0x2d]);
        return 5;
      }) as any);
      expect(mimeRealComprobante('archivo-dummy.pdf')).toBe('application/pdf');

      // Unknown
      jest.spyOn(fs, 'readSync').mockImplementation(((fd: any, buf: Buffer) => {
        buf.set([0x00, 0x00, 0x00, 0x00]);
        return 4;
      }) as any);
      expect(mimeRealComprobante('archivo-dummy.bin')).toBeNull();
    });
  });

  describe('Configuracion, Sucursales y Liberacion de expirados', () => {
    it('obtenerConfiguracionTransferencia y obtenerSucursalDisponibleCliente', async () => {
      jest.spyOn(configuracionRepository, 'getConfiguracion').mockResolvedValue(null);
      await expect(pedidosService.obtenerConfiguracionTransferencia(1)).rejects.toMatchObject({ status: 409 });

      jest.spyOn(configuracionRepository, 'getConfiguracion').mockResolvedValue({
        idConfiguracion: 1,
        idSuc: 1,
        banco: 'Santander',
        titular: 'Tienda',
        clabe: '014180001234567890',
        activo: true,
      } as any);
      const conf = await pedidosService.obtenerConfiguracionTransferencia(1);
      expect(conf.banco).toBe('Santander');

      const suc = await pedidosService.obtenerSucursalDisponibleCliente();
      expect(suc).toBe(1);
    });

    it('liberarPedidosExpirados es no-op', async () => {
      await expect(pedidosService.liberarPedidosExpirados(1)).resolves.toBeUndefined();
    });
  });

  describe('crearPedidoCliente validaciones y ramas', () => {
    it('crearPedidoSchema debe aceptar items con id, idPro o productoId', async () => {
      const parsed = await crearPedidoSchema.parseAsync({
        uuidPedido: '4915e834-87e6-4dbd-89cf-df8730e0f62b',
        items: [
          { id: 'lakJ85ZE', cantidad: 1 },
          { idPro: 2, cantidad: 3 },
          { productoId: 'abc', cantidad: 1 },
        ],
      });
      expect(parsed.items[0].idPro).toBe('lakJ85ZE');
      expect(parsed.items[1].idPro).toBe(2);
      expect(parsed.items[2].idPro).toBe('abc');
    });

    it('debe validar items y productos', async () => {
      await expect(pedidosService.crearPedidoCliente(1, { uuidPedido: 'invalido' })).rejects.toMatchObject({
        status: 400,
      });
      await expect(
        pedidosService.crearPedidoCliente(1, { uuidPedido: '11111111-1111-4111-8111-111111111111', items: [] }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        pedidosService.crearPedidoCliente(1, {
          uuidPedido: '11111111-1111-4111-8111-111111111111',
          items: [{ idPro: 'invalido', cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        pedidosService.crearPedidoCliente(1, {
          uuidPedido: '11111111-1111-4111-8111-111111111111',
          items: [{ idPro: 1, cantidad: -5 }],
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('debe rechazar producto no encontrado, inactivo o con stock insuficiente', async () => {
      jest
        .spyOn(configuracionRepository, 'getConfiguracion')
        .mockResolvedValue({ idConfiguracion: 1, idSuc: 1, banco: 'B', titular: 'T', activo: true } as any);

      // Producto no encontrado
      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValueOnce(null);
      await expect(
        pedidosService.crearPedidoCliente(1, {
          idSuc: 1,
          uuidPedido: '11111111-1111-4111-8111-111111111111',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 404 });

      // Inactivo
      jest
        .spyOn(productoRepository, 'getProductoById')
        .mockResolvedValueOnce({ ...dummyProducto, activoPro: false } as any);
      await expect(
        pedidosService.crearPedidoCliente(1, {
          idSuc: 1,
          uuidPedido: '11111111-1111-4111-8111-111111111111',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 409 });

      // Precio inválido
      jest
        .spyOn(productoRepository, 'getProductoById')
        .mockResolvedValueOnce({ ...dummyProducto, precioVentaPro: -1 } as any);
      await expect(
        pedidosService.crearPedidoCliente(1, {
          idSuc: 1,
          uuidPedido: '11111111-1111-4111-8111-111111111111',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 409 });

      // Stock insuficiente
      jest
        .spyOn(productoRepository, 'getProductoById')
        .mockResolvedValueOnce({ ...dummyProducto, existenciaPro: 1 } as any);
      await expect(
        pedidosService.crearPedidoCliente(1, {
          idSuc: 1,
          uuidPedido: '11111111-1111-4111-8111-111111111111',
          items: [{ idPro: 1, cantidad: 10 }],
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('debe crear pedido exitosamente', async () => {
      jest
        .spyOn(configuracionRepository, 'getConfiguracion')
        .mockResolvedValue({ idConfiguracion: 1, idSuc: 1, banco: 'B', titular: 'T', activo: true } as any);
      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValue(dummyProducto as any);
      jest.spyOn(pedidoRepository, 'createPedido').mockResolvedValue({ idPedido: 100 } as any);
      jest.spyOn(pedidosService, 'obtenerPedidoSeguro').mockResolvedValue({ id: 'enc100', total: 40 } as any);

      const res = await pedidosService.crearPedidoCliente(1, {
        uuidPedido: '11111111-1111-4111-8111-111111111111',
        items: [{ idPro: 1, cantidad: 2 }],
      });
      expect(res?.id).toBe('enc100');
    });
  });

  describe('cancelarPedidoCliente, presignComprobante y confirmarComprobante', () => {
    it('cancelarPedidoCliente valida existencia y comprobante adjunto y cancela', async () => {
      // No encontrado
      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValueOnce(null);
      await expect(pedidosService.cancelarPedidoCliente(1, 1)).rejects.toMatchObject({ status: 404 });

      // Con comprobante adjunto
      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValueOnce({
        idPedido: 1,
        idCliente: 1,
        estado: 'PENDIENTE_PAGO',
        comprobanteRuta: 'comprobante.jpg',
      } as any);
      await expect(pedidosService.cancelarPedidoCliente(1, 1)).rejects.toMatchObject({ status: 409 });

      // Éxito cancelando
      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValueOnce({
        idPedido: 1,
        idCliente: 1,
        estado: 'PENDIENTE_PAGO',
      } as any);
      jest.spyOn(pedidoRepository, 'cancelarPedido').mockResolvedValueOnce({ idPedido: 1, estado: 'CANCELADO' } as any);
      jest
        .spyOn(pedidosService, 'obtenerPedidoSeguro')
        .mockResolvedValueOnce({ id: 'enc1', estado: 'CANCELADO' } as any);

      const cancelado = await pedidosService.cancelarPedidoCliente(1, 1);
      expect(cancelado?.estado).toBe('CANCELADO');
    });

    it('presignComprobante valida estados permitidos', async () => {
      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValueOnce(null);
      await expect(pedidosService.presignComprobante(1, 1, 'image/png')).rejects.toMatchObject({ status: 404 });

      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValueOnce({
        idPedido: 1,
        idCliente: 1,
        estado: 'PAGADO',
      } as any);
      await expect(pedidosService.presignComprobante(1, 1, 'image/png')).rejects.toMatchObject({ status: 409 });

      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValueOnce({
        idPedido: 1,
        idCliente: 1,
        estado: 'PENDIENTE_PAGO',
      } as any);
      jest.spyOn(storageService, 'generarPresignedUpload').mockResolvedValueOnce({ uploadUrl: 'http://upload' } as any);

      const pres = await pedidosService.presignComprobante(1, 1, 'image/png', 'png', 'archivo.png');
      expect(pres).toBeDefined();
    });

    it('confirmarComprobante reemplaza comprobante anterior', async () => {
      // No encontrado
      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValueOnce(null);
      await expect(pedidosService.confirmarComprobante(1, 1, 'key')).rejects.toMatchObject({ status: 404 });

      // Estado no permitido
      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValueOnce({
        idPedido: 1,
        idCliente: 1,
        estado: 'ENTREGADO',
      } as any);
      await expect(pedidosService.confirmarComprobante(1, 1, 'key')).rejects.toMatchObject({ status: 409 });

      // Éxito
      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValueOnce({
        idPedido: 1,
        idCliente: 1,
        estado: 'PENDIENTE_PAGO',
        comprobanteRuta: 'comprobantes/anterior.jpg',
      } as any);
      jest.spyOn(pedidoRepository, 'updateComprobante').mockResolvedValueOnce({ idPedido: 1 } as any);
      jest.spyOn(storageService, 'eliminarArchivo').mockResolvedValueOnce();
      jest.spyOn(pedidosService, 'obtenerPedidoSeguro').mockResolvedValueOnce({ id: 'enc1' } as any);

      const res = await pedidosService.confirmarComprobante(1, 1, 'comprobantes/nuevo.jpg');
      expect(res).toBeDefined();
    });
  });

  describe('rechazar y aprobar admin', () => {
    it('rechazarPedidoAdmin valida motivo y estado', async () => {
      await expect(pedidosService.rechazarPedidoAdmin(0, 1, 1, 'ab')).rejects.toMatchObject({ status: 400 });
      await expect(pedidosService.rechazarPedidoAdmin(1, 1, 1, 'ab')).rejects.toMatchObject({ status: 400 });

      // No encontrado
      jest.spyOn(pedidoRepository, 'listPedidosAdmin').mockResolvedValueOnce([]);
      await expect(pedidosService.rechazarPedidoAdmin(1, 1, 1, 'Motivo')).rejects.toMatchObject({ status: 404 });

      // Estado no en revisión
      jest
        .spyOn(pedidoRepository, 'listPedidosAdmin')
        .mockResolvedValueOnce([{ idPedido: 1, idCliente: 1, estado: 'PENDIENTE_PAGO' } as any]);
      await expect(pedidosService.rechazarPedidoAdmin(1, 1, 1, 'Motivo')).rejects.toMatchObject({ status: 409 });

      // Éxito
      jest
        .spyOn(pedidoRepository, 'listPedidosAdmin')
        .mockResolvedValueOnce([
          { idPedido: 1, idCliente: 1, estado: 'EN_REVISION', comprobanteRuta: 'comprobantes/foto.jpg' } as any,
        ]);
      jest.spyOn(pedidoRepository, 'rechazarPedido').mockResolvedValueOnce({ idPedido: 1, estado: 'RECHAZADO' } as any);
      jest.spyOn(storageService, 'eliminarArchivo').mockResolvedValueOnce();
      jest
        .spyOn(pedidosService, 'obtenerPedidoAdmin')
        .mockResolvedValueOnce({ id: 'enc1', estado: 'RECHAZADO' } as any);

      const res = await pedidosService.rechazarPedidoAdmin(1, 1, 1, 'Comprobante ilegible');
      expect(res).toBeDefined();
    });

    it('aprobarPedidoAdmin valida existencia y estado', async () => {
      await expect(pedidosService.aprobarPedidoAdmin(0, 1, 1)).rejects.toMatchObject({ status: 400 });

      // No encontrado
      jest.spyOn(pedidoRepository, 'listPedidosAdmin').mockResolvedValueOnce([]);
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 404 });

      // Ya aprobado
      jest
        .spyOn(pedidoRepository, 'listPedidosAdmin')
        .mockResolvedValueOnce([{ idPedido: 1, idCliente: 1, estado: 'PAGADO' } as any]);
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 409 });

      // Estado no en revisión
      jest
        .spyOn(pedidoRepository, 'listPedidosAdmin')
        .mockResolvedValueOnce([{ idPedido: 1, idCliente: 1, estado: 'PENDIENTE_PAGO' } as any]);
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 409 });

      // Éxito
      jest
        .spyOn(pedidoRepository, 'listPedidosAdmin')
        .mockResolvedValueOnce([{ idPedido: 1, idCliente: 1, estado: 'EN_REVISION' } as any]);
      jest.spyOn(pedidoRepository, 'aprobarPedido').mockResolvedValueOnce({ idPedido: 1, estado: 'PAGADO' } as any);
      jest.spyOn(pedidosService, 'obtenerPedidoAdmin').mockResolvedValueOnce({ id: 'enc1', estado: 'PAGADO' } as any);

      const res = await pedidosService.aprobarPedidoAdmin(1, 1, 1);
      expect(res?.estado).toBe('PAGADO');
    });
  });

  describe('Consultas y flujo operativo', () => {
    it('obtenerPedidoSeguro y obtenerPedidoAdmin', async () => {
      jest.spyOn(pedidoRepository, 'getPedidoById').mockResolvedValue({
        idPedido: 1,
        idCliente: 1,
        idSuc: 1,
        totalPedido: 20,
        estado: 'PAGADO',
        detalles: [
          {
            idDetallePedido: 1,
            idPro: 1,
            cantidad: 1,
            precioUnitario: 20,
            subtotal: 20,
            producto: dummyProducto,
          },
        ],
      } as any);

      const seguro = await pedidosService.obtenerPedidoSeguro(1, 1);
      expect(seguro?.id).toBeDefined();

      jest.spyOn(pedidoRepository, 'listPedidosAdmin').mockResolvedValue([
        {
          idPedido: 1,
          idCliente: 1,
          idSuc: 1,
          totalPedido: 20,
          estado: 'PAGADO',
          detalles: [],
        } as any,
      ]);

      const admin = await pedidosService.obtenerPedidoAdmin(1, 1);
      expect(admin?.id).toBeDefined();
    });

    it('cambiarEstadoOperativo validaciones y transiciones', async () => {
      await expect(pedidosService.cambiarEstadoOperativo(0, 1, 'PAGADO', 'LISTO')).rejects.toMatchObject({
        status: 400,
      });

      // No encontrado
      jest.spyOn(pedidoRepository, 'listPedidosAdmin').mockResolvedValueOnce([]);
      await expect(pedidosService.cambiarEstadoOperativo(1, 1, 'PAGADO', 'LISTO')).rejects.toMatchObject({
        status: 404,
      });

      // Éxito
      jest
        .spyOn(pedidoRepository, 'listPedidosAdmin')
        .mockResolvedValueOnce([{ idPedido: 1, idCliente: 1, estado: 'PAGADO' } as any]);
      jest.spyOn(pedidoRepository, 'updateEstado').mockResolvedValueOnce({ idPedido: 1, estado: 'LISTO' } as any);
      jest.spyOn(pedidosService, 'obtenerPedidoAdmin').mockResolvedValueOnce({ id: 'enc1', estado: 'LISTO' } as any);

      const res = await pedidosService.cambiarEstadoOperativo(1, 1, 'PAGADO', 'LISTO');
      expect(res?.estado).toBe('LISTO');
    });

    it('listarPedidosCliente y listarPedidosAdmin', async () => {
      jest
        .spyOn(pedidoRepository, 'listPedidosCliente')
        .mockResolvedValue([{ idPedido: 1, idCliente: 1, estado: 'PENDIENTE_PAGO', totalPedido: 50 } as any]);
      const listaCliente = await pedidosService.listarPedidosCliente(1);
      expect(listaCliente.length).toBe(1);

      jest
        .spyOn(pedidoRepository, 'listPedidosAdmin')
        .mockResolvedValue([{ idPedido: 1, idCliente: 1, estado: 'PENDIENTE_PAGO', totalPedido: 50 } as any]);
      const listaAdmin = await pedidosService.listarPedidosAdmin(1);
      expect(listaAdmin.length).toBe(1);
    });
  });
});
