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
import { prisma } from '../../../src/config/prisma';

describe('PedidosService Complete Branch Coverage', () => {
  const dummyProducto = {
    idPro: 1,
    nombrePro: 'Sabritas Sal',
    precioVentaPro: 20,
    existenciaPro: 100,
    activoPro: true,
  };

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
      jest.spyOn(prisma.configuracionTransferencia, 'findUnique').mockResolvedValue(null);
      await expect(pedidosService.obtenerConfiguracionTransferencia(1)).rejects.toMatchObject({ status: 409 });

      jest.spyOn(prisma.configuracionTransferencia, 'findUnique').mockResolvedValue({
        idConfiguracion: 1,
        idSuc: 1,
        banco: 'Santander',
        titular: 'Tienda',
        clabe: '014180001234567890',
        activo: true,
      } as any);
      const conf = await pedidosService.obtenerConfiguracionTransferencia(1);
      expect(conf.banco).toBe('Santander');

      // Sucursal disponible
      jest.spyOn(prisma.sucursal, 'findMany').mockResolvedValue([]);
      await expect(pedidosService.obtenerSucursalDisponibleCliente()).rejects.toMatchObject({ status: 409 });

      jest.spyOn(prisma.sucursal, 'findMany').mockResolvedValue([{ idSuc: 1 }] as any);
      const suc = await pedidosService.obtenerSucursalDisponibleCliente();
      expect(suc).toBe(1);
    });

    it('liberarPedidosExpirados libera bloqueos expirados', async () => {
      jest.spyOn(prisma.pedidoCliente, 'findMany').mockResolvedValue([{ idPedido: 10 }] as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findUnique: jest.fn().mockResolvedValue({
              idPedido: 10,
              estado: 'PENDIENTE_PAGO',
              fechaLimitePago: new Date(Date.now() - 10000),
            }),
            update: jest.fn(),
          },
          detallePedidoCliente: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });

      await pedidosService.liberarPedidosExpirados(1);
      expect(prisma.pedidoCliente.findMany).toHaveBeenCalled();
    });
  });

  describe('crearPedidoCliente validaciones y ramas', () => {
    it('debe validar items y productos', async () => {
      await expect(pedidosService.crearPedidoCliente(1, { items: [] })).rejects.toMatchObject({ status: 400 });
      await expect(pedidosService.crearPedidoCliente(1, { items: [{ idPro: 'invalido', cantidad: 1 }] })).rejects.toMatchObject({ status: 400 });
      await expect(pedidosService.crearPedidoCliente(1, { items: [{ idPro: 1, cantidad: -5 }] })).rejects.toMatchObject({ status: 400 });
    });

    it('debe validar idSuc si no viene en body consultando sucursal disponible', async () => {
      jest.spyOn(prisma.sucursal, 'findMany').mockResolvedValue([{ idSuc: 2 }] as any);
      jest.spyOn(prisma.configuracionTransferencia, 'findUnique').mockResolvedValue({ idConfiguracion: 1, idSuc: 2, banco: 'B', titular: 'T', activo: true } as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ idPedido: 1, idCliente: 1, idSuc: 2, detalles: [] }),
          },
          producto: {
            findMany: jest.fn().mockResolvedValue([dummyProducto]),
            update: jest.fn(),
          },
        });
      });

      jest.spyOn(pedidosService, 'obtenerPedidoSeguro').mockResolvedValue({ idPedido: 1 } as any);
      const res = await pedidosService.crearPedidoCliente(1, {
        uuidPedido: '11111111-1111-4111-8111-111111111111',
        items: [{ idPro: 1, cantidad: 2 }],
      });
      expect(res).toBeDefined();
    });

    it('debe rechazar uuidPedido repetido de otro cliente y retornar si es del mismo', async () => {
      jest.spyOn(prisma.configuracionTransferencia, 'findUnique').mockResolvedValue({ idConfiguracion: 1, idSuc: 1, banco: 'B', titular: 'T', activo: true } as any);

      // Otro cliente
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findUnique: jest.fn().mockResolvedValue({ idPedido: 5, idCliente: 99 }),
          },
        });
      });
      await expect(
        pedidosService.crearPedidoCliente(1, { idSuc: 1, uuidPedido: '11111111-1111-4111-8111-111111111111', items: [{ idPro: 1, cantidad: 1 }] }),
      ).rejects.toMatchObject({ status: 409, message: 'El identificador del pedido ya está en uso.' });

      // Mismo cliente
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findUnique: jest.fn().mockResolvedValue({ idPedido: 5, idCliente: 1 }),
          },
        });
      });
      jest.spyOn(pedidosService, 'obtenerPedidoSeguro').mockResolvedValue({ id: 'enc5' } as any);
      const mismo = await pedidosService.crearPedidoCliente(1, { idSuc: 1, uuidPedido: '11111111-1111-4111-8111-111111111111', items: [{ idPro: 1, cantidad: 1 }] });
      expect(mismo?.id).toBe('enc5');
    });

    it('debe rechazar producto no encontrado, inactivo o con stock insuficiente', async () => {
      jest.spyOn(prisma.configuracionTransferencia, 'findUnique').mockResolvedValue({ idConfiguracion: 1, idSuc: 1, banco: 'B', titular: 'T', activo: true } as any);

      // Producto no encontrado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: { findUnique: jest.fn().mockResolvedValue(null) },
          producto: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });
      await expect(
        pedidosService.crearPedidoCliente(1, { idSuc: 1, uuidPedido: '11111111-1111-4111-8111-111111111111', items: [{ idPro: 1, cantidad: 1 }] }),
      ).rejects.toMatchObject({ status: 404 });

      // Inactivo
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: { findUnique: jest.fn().mockResolvedValue(null) },
          producto: { findMany: jest.fn().mockResolvedValue([{ ...dummyProducto, activoPro: false }]) },
        });
      });
      await expect(
        pedidosService.crearPedidoCliente(1, { idSuc: 1, uuidPedido: '11111111-1111-4111-8111-111111111111', items: [{ idPro: 1, cantidad: 1 }] }),
      ).rejects.toMatchObject({ status: 409 });

      // Precio inválido
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: { findUnique: jest.fn().mockResolvedValue(null) },
          producto: { findMany: jest.fn().mockResolvedValue([{ ...dummyProducto, precioVentaPro: -1 }]) },
        });
      });
      await expect(
        pedidosService.crearPedidoCliente(1, { idSuc: 1, uuidPedido: '11111111-1111-4111-8111-111111111111', items: [{ idPro: 1, cantidad: 1 }] }),
      ).rejects.toMatchObject({ status: 409 });

      // Stock insuficiente
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: { findUnique: jest.fn().mockResolvedValue(null) },
          producto: { findMany: jest.fn().mockResolvedValue([{ ...dummyProducto, existenciaPro: 1 }]) },
        });
      });
      await expect(
        pedidosService.crearPedidoCliente(1, { idSuc: 1, uuidPedido: '11111111-1111-4111-8111-111111111111', items: [{ idPro: 1, cantidad: 10 }] }),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('cancelarPedidoCliente, presignComprobante y confirmarComprobante', () => {
    it('cancelarPedidoCliente valida expiracion, comprobante adjunto y cancela', async () => {
      // No encontrado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({ pedidoCliente: { findFirst: jest.fn().mockResolvedValue(null) } });
      });
      await expect(pedidosService.cancelarPedidoCliente(1, 1)).rejects.toMatchObject({ status: 404 });

      // Expirado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idCliente: 1,
              estado: 'PENDIENTE_PAGO',
              fechaLimitePago: new Date(Date.now() - 100000),
            }),
            update: jest.fn(),
          },
          detallePedidoCliente: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });
      await expect(pedidosService.cancelarPedidoCliente(1, 1)).rejects.toMatchObject({ status: 409, message: 'Tu reserva expiró y los productos volvieron al inventario.' });

      // Con comprobante adjunto
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idCliente: 1,
              estado: 'PENDIENTE_PAGO',
              comprobanteRuta: 'comprobante.jpg',
              fechaLimitePago: new Date(Date.now() + 100000),
            }),
          },
        });
      });
      await expect(pedidosService.cancelarPedidoCliente(1, 1)).rejects.toMatchObject({ status: 409 });

      // Exito cancelando
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idCliente: 1,
              estado: 'PENDIENTE_PAGO',
              fechaLimitePago: new Date(Date.now() + 100000),
            }),
            update: jest.fn(),
          },
          detallePedidoCliente: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });
      jest.spyOn(pedidosService, 'obtenerPedidoSeguro').mockResolvedValue({ idPedido: 1, estado: 'CANCELADO' } as any);
      const cancelado = await pedidosService.cancelarPedidoCliente(1, 1);
      expect(cancelado?.estado).toBe('CANCELADO');
    });

    it('presignComprobante valida estados permitidos', async () => {
      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValueOnce(null);
      await expect(pedidosService.presignComprobante(1, 1, 'image/png')).rejects.toMatchObject({ status: 404 });

      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValueOnce({
        idPedido: 1,
        idCliente: 1,
        estado: 'PAGADO',
      } as any);

      await expect(pedidosService.presignComprobante(1, 1, 'image/png')).rejects.toMatchObject({ status: 409 });

      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValueOnce({
        idPedido: 1,
        idCliente: 1,
        estado: 'PENDIENTE_PAGO',
      } as any);

      const pres = await pedidosService.presignComprobante(1, 1, 'image/png', 'png', 'archivo.png');
      expect(pres).toBeDefined();
    });

    it('confirmarComprobante reemplaza anterior comprobante en S3 o local', async () => {
      // No encontrado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({ pedidoCliente: { findFirst: jest.fn().mockResolvedValue(null) } });
      });
      await expect(pedidosService.confirmarComprobante(1, 1, 'key')).rejects.toMatchObject({ status: 404 });

      // Expirado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idCliente: 1,
              estado: 'PENDIENTE_PAGO',
              fechaLimitePago: new Date(Date.now() - 100000),
            }),
            update: jest.fn(),
          },
          detallePedidoCliente: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });
      await expect(pedidosService.confirmarComprobante(1, 1, 'key')).rejects.toMatchObject({ status: 409 });

      // Estado no permitido
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idCliente: 1,
              estado: 'ENTREGADO',
              fechaLimitePago: new Date(Date.now() + 100000),
            }),
          },
        });
      });
      await expect(pedidosService.confirmarComprobante(1, 1, 'key')).rejects.toMatchObject({ status: 409 });

      // Reemplazo S3
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idCliente: 1,
              estado: 'PENDIENTE_PAGO',
              comprobanteRuta: 'https://bucket.s3.amazonaws.com/comprobantes/anterior.jpg',
              fechaLimitePago: new Date(Date.now() + 100000),
            }),
            update: jest.fn(),
          },
        });
      });
      jest.spyOn(pedidosService, 'obtenerPedidoSeguro').mockResolvedValue({ idPedido: 1 } as any);

      const res = await pedidosService.confirmarComprobante(1, 1, 'comprobantes/nuevo.jpg');
      expect(res).toBeDefined();
    });
  });

  describe('rechazar y aprobar admin', () => {
    it('rechazarPedidoAdmin elimina comprobante anterior en S3 o local', async () => {
      await expect(pedidosService.rechazarPedidoAdmin(0, 1, 1, 'ab')).rejects.toMatchObject({ status: 400 });
      await expect(pedidosService.rechazarPedidoAdmin(1, 1, 1, 'ab')).rejects.toMatchObject({ status: 400 });

      // No encontrado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({ pedidoCliente: { findFirst: jest.fn().mockResolvedValue(null) } });
      });
      await expect(pedidosService.rechazarPedidoAdmin(1, 1, 1, 'Motivo')).rejects.toMatchObject({ status: 404 });

      // Estado no en revision
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({ idPedido: 1, idSuc: 1, estado: 'PENDIENTE_PAGO' }),
          },
        });
      });
      await expect(pedidosService.rechazarPedidoAdmin(1, 1, 1, 'Motivo')).rejects.toMatchObject({ status: 409 });

      // Exito S3
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'EN_REVISION',
              comprobanteRuta: 'https://bucket.s3.amazonaws.com/comprobantes/anterior.jpg',
            }),
            update: jest.fn(),
          },
        });
      });
      jest.spyOn(pedidosService, 'obtenerPedidoAdmin').mockResolvedValue({ idPedido: 1 } as any);

      const res = await pedidosService.rechazarPedidoAdmin(1, 1, 1, 'Comprobante ilegible');
      expect(res).toBeDefined();
    });

    it('aprobarPedidoAdmin valida totales y coherencia de productos', async () => {
      await expect(pedidosService.aprobarPedidoAdmin(0, 1, 1)).rejects.toMatchObject({ status: 400 });

      // No encontrado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({ pedidoCliente: { findFirst: jest.fn().mockResolvedValue(null) } });
      });
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 404 });

      // Ya aprobado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'PAGADO',
              idVenta: 10,
              comprobanteRuta: 'comprobante.jpg',
              fechaComprobante: new Date(),
              total: 50,
              detalles: [],
            }),
          },
        });
      });
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 409, message: 'El pedido ya fue aprobado.' });

      // Estado no en revision
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'PENDIENTE_PAGO',
              comprobanteRuta: 'comprobante.jpg',
              fechaComprobante: new Date(),
              detalles: [],
            }),
          },
        });
      });
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 409 });

      // Sin comprobante
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'EN_REVISION',
              comprobanteRuta: null,
              fechaComprobante: null,
              detalles: [],
            }),
          },
        });
      });
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 409 });

      // Comprobante no disponible
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'EN_REVISION',
              comprobanteRuta: 'no-existe.jpg',
              fechaComprobante: new Date(),
              detalles: [],
            }),
          },
        });
      });
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 409, message: 'El archivo del comprobante no está disponible.' });

      // Sin detalles
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'EN_REVISION',
              comprobanteRuta: 'https://s3.amazonaws.com/test.jpg',
              fechaComprobante: new Date(),
              detalles: [],
            }),
          },
        });
      });
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 409, message: 'El pedido no contiene productos.' });

      // Incoherencia en subtotal
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'EN_REVISION',
              comprobanteRuta: 'https://bucket.s3.amazonaws.com/comprobantes/key.jpg',
              fechaComprobante: new Date(),
              total: 50,
              detalles: [
                { idPro: 1, cantidad: 2, precioUnitario: 20, subtotal: 10 },
              ],
            }),
          },
        });
      });
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 409, message: 'Los importes históricos del pedido no son coherentes.' });

      // Total no coincide
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'EN_REVISION',
              comprobanteRuta: 'https://bucket.s3.amazonaws.com/comprobantes/key.jpg',
              fechaComprobante: new Date(),
              total: 100,
              detalles: [
                { idPro: 1, cantidad: 2, precioUnitario: 20, subtotal: 40 },
              ],
            }),
          },
        });
      });
      await expect(pedidosService.aprobarPedidoAdmin(1, 1, 1)).rejects.toMatchObject({ status: 409, message: 'El total del pedido no coincide con sus productos.' });

      // Exito aprobando y creando venta
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'EN_REVISION',
              comprobanteRuta: 'https://bucket.s3.amazonaws.com/comprobantes/key.jpg',
              fechaComprobante: new Date(),
              total: 40,
              detalles: [
                { idPro: 1, cantidad: 2, precioUnitario: 20, subtotal: 40 },
              ],
            }),
            update: jest.fn(),
          },
          sesionCaja: {
            findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1 }),
          },
          venta: {
            create: jest.fn().mockResolvedValue({ idVenta: 50 }),
          },
        });
      });
      jest.spyOn(pedidosService, 'obtenerPedidoAdmin').mockResolvedValue({ idPedido: 1, estado: 'PAGADO', idVenta: 50 } as any);

      const aprobado = await pedidosService.aprobarPedidoAdmin(1, 1, 1);
      expect(aprobado?.idVenta).toBe(50);
    });
  });

  describe('Consultas y flujo operativo', () => {
    it('obtenerPedidoSeguro y obtenerPedidoAdmin', async () => {
      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValue({
        idPedido: 1,
        idCliente: 1,
        idSuc: 1,
        total: 20,
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

      const admin = await pedidosService.obtenerPedidoAdmin(1, 1);
      expect(admin?.id).toBeDefined();
    });

    it('cambiarEstadoOperativo validaciones y transiciones', async () => {
      await expect(pedidosService.cambiarEstadoOperativo(0, 1, 'PAGADO', 'LISTO')).rejects.toMatchObject({ status: 400 });

      // No encontrado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({ pedidoCliente: { findFirst: jest.fn().mockResolvedValue(null) } });
      });
      await expect(pedidosService.cambiarEstadoOperativo(1, 1, 'PAGADO', 'LISTO')).rejects.toMatchObject({ status: 404 });

      // Estado actual incorrecto
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({ idPedido: 1, idSuc: 1, estado: 'ENTREGADO' }),
          },
        });
      });
      await expect(pedidosService.cambiarEstadoOperativo(1, 1, 'PAGADO', 'LISTO')).rejects.toMatchObject({ status: 409 });

      // Transicion valida
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          pedidoCliente: {
            findFirst: jest.fn().mockResolvedValue({
              idPedido: 1,
              idSuc: 1,
              estado: 'PAGADO',
            }),
            update: jest.fn(),
          },
        });
      });
      jest.spyOn(pedidosService, 'obtenerPedidoAdmin').mockResolvedValue({ idPedido: 1, estado: 'LISTO' } as any);

      const listo = await pedidosService.cambiarEstadoOperativo(1, 1, 'PAGADO', 'LISTO');
      expect(listo?.estado).toBe('LISTO');
    });
  });
});
