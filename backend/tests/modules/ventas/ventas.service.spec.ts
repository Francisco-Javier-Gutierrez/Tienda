import { ventasService } from '../../../src/modules/ventas/ventas.service';
import { prisma } from '../../../src/config/prisma';

describe('VentasService Complete Branch Coverage', () => {
  const dummyEmpleado = {
    idEmp: 1,
    idSuc: 1,
    nombreEmp: 'Juan',
    apellidoPatEmp: 'Perez',
    apellidoMatEmp: null,
    cargo: 'CAJERO',
  };

  const dummyProducto = {
    idPro: 1,
    nombrePro: 'Coca Cola',
    precioVentaPro: 15,
    existenciaPro: 50,
    activoPro: true,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('crearVenta validaciones y ramas', () => {
    it('debe validar uuid, método de pago, items y monto recibido', async () => {
      await expect(ventasService.crearVenta(dummyEmpleado, { uuidVenta: 'invalido' })).rejects.toMatchObject({ status: 400 });
      await expect(ventasService.crearVenta(dummyEmpleado, { uuidVenta: '11111111-1111-4111-8111-111111111111', metodoPago: 'CRIPTO' })).rejects.toMatchObject({ status: 400 });
      await expect(ventasService.crearVenta(dummyEmpleado, { uuidVenta: '11111111-1111-4111-8111-111111111111', metodoPago: 'EFECTIVO', items: [] })).rejects.toMatchObject({ status: 400 });
      await expect(ventasService.crearVenta(dummyEmpleado, { uuidVenta: '11111111-1111-4111-8111-111111111111', metodoPago: 'EFECTIVO', items: [{ idPro: 'inv', cantidad: 1 }], montoRecibido: 10 })).rejects.toMatchObject({ status: 400 });
      await expect(ventasService.crearVenta(dummyEmpleado, { uuidVenta: '11111111-1111-4111-8111-111111111111', metodoPago: 'EFECTIVO', items: [{ idPro: 1, cantidad: 1 }], montoRecibido: -1 })).rejects.toMatchObject({ status: 400 });
    });

    it('debe manejar venta repetida (idempotencia o error de empleado)', async () => {
      // Misma venta
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: {
            findUnique: jest.fn().mockResolvedValue({ idVenta: 10, idEmp: 1, idSuc: 1 }),
          },
        });
      });
      jest.spyOn(ventasService, 'obtenerVentaRegistrada').mockResolvedValue({ id: 'enc10' } as any);
      const res = await ventasService.crearVenta(dummyEmpleado, {
        uuidVenta: '11111111-1111-4111-8111-111111111111',
        metodoPago: 'TARJETA',
        items: [{ idPro: 1, cantidad: 1 }],
      });
      expect(res?.id).toBe('enc10');

      // Venta de otro empleado/sucursal
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: {
            findUnique: jest.fn().mockResolvedValue({ idVenta: 10, idEmp: 99, idSuc: 1 }),
          },
        });
      });
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'TARJETA',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 409, message: 'El identificador de venta ya está en uso.' });
    });

    it('debe rechazar si la caja no está abierta, si falta un producto, si está inactivo, sin precio, sin stock o efectivo insuficiente', async () => {
      // Caja no abierta
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: { findUnique: jest.fn().mockResolvedValue(null) },
          sesionCaja: { findFirst: jest.fn().mockResolvedValue(null) },
        });
      });
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'TARJETA',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 409, message: 'Debes abrir caja antes de registrar ventas.' });

      // Producto no encontrado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: { findUnique: jest.fn().mockResolvedValue(null) },
          sesionCaja: { findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1 }) },
          producto: { findMany: jest.fn().mockResolvedValue([]) },
        });
      });
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'TARJETA',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 404 });

      // Inactivo
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: { findUnique: jest.fn().mockResolvedValue(null) },
          sesionCaja: { findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1 }) },
          producto: { findMany: jest.fn().mockResolvedValue([{ ...dummyProducto, activoPro: false }]) },
        });
      });
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'TARJETA',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 409 });

      // Precio no válido
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: { findUnique: jest.fn().mockResolvedValue(null) },
          sesionCaja: { findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1 }) },
          producto: { findMany: jest.fn().mockResolvedValue([{ ...dummyProducto, precioVentaPro: -5 }]) },
        });
      });
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'TARJETA',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 409, message: 'Coca Cola no tiene un precio válido.' });

      // Stock insuficiente
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: { findUnique: jest.fn().mockResolvedValue(null) },
          sesionCaja: { findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1 }) },
          producto: { findMany: jest.fn().mockResolvedValue([{ ...dummyProducto, existenciaPro: 2 }]) },
        });
      });
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'TARJETA',
          items: [{ idPro: 1, cantidad: 10 }],
        }),
      ).rejects.toMatchObject({ status: 409 });

      // Efectivo insuficiente
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: { findUnique: jest.fn().mockResolvedValue(null) },
          sesionCaja: { findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1 }) },
          producto: { findMany: jest.fn().mockResolvedValue([dummyProducto]) },
        });
      });
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'EFECTIVO',
          montoRecibido: 10,
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 400, message: 'El efectivo recibido es insuficiente.' });
    });

    it('debe registrar venta exitosamente en efectivo y con tarjeta', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          venta: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ idVenta: 100 }),
          },
          sesionCaja: { findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1 }) },
          producto: {
            findMany: jest.fn().mockResolvedValue([dummyProducto]),
            update: jest.fn(),
          },
        });
      });
      jest.spyOn(ventasService, 'obtenerVentaRegistrada').mockResolvedValue({ id: 'enc100' } as any);

      // Efectivo
      const vEf = await ventasService.crearVenta(dummyEmpleado, {
        uuidVenta: '11111111-1111-4111-8111-111111111111',
        metodoPago: 'EFECTIVO',
        montoRecibido: 20,
        items: [{ idPro: 1, cantidad: 1 }],
      });
      expect(vEf?.id).toBe('enc100');

      // Tarjeta
      const vTar = await ventasService.crearVenta(dummyEmpleado, {
        uuidVenta: '22222222-2222-4222-8222-222222222222',
        metodoPago: 'TARJETA',
        items: [{ idPro: 1, cantidad: 1 }],
      });
      expect(vTar?.id).toBe('enc100');
    });
  });

  describe('cancelarVenta validaciones y ramas', () => {
    it('debe rechazar si motivo es inválido, venta no encontrada o en estado no cancelable', async () => {
      await expect(ventasService.cancelarVenta(1, 1, 1, 'ab')).rejects.toMatchObject({ status: 400 });

      // No encontrada
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({ venta: { findFirst: jest.fn().mockResolvedValue(null) } });
      });
      await expect(ventasService.cancelarVenta(1, 1, 1, 'Motivo')).rejects.toMatchObject({ status: 404 });

      // Ya cancelada
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: {
            findFirst: jest.fn().mockResolvedValue({
              idVenta: 1,
              idSuc: 1,
              estadoVenta: 'CANCELADA',
            }),
          },
        });
      });
      await expect(ventasService.cancelarVenta(1, 1, 1, 'Motivo')).rejects.toMatchObject({ status: 409, message: 'La venta ya fue cancelada.' });

      // Estado no cancelable (ej PENDIENTE)
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: {
            findFirst: jest.fn().mockResolvedValue({
              idVenta: 1,
              idSuc: 1,
              estadoVenta: 'PENDIENTE',
            }),
          },
        });
      });
      await expect(ventasService.cancelarVenta(1, 1, 1, 'Motivo')).rejects.toMatchObject({ status: 409, message: 'La venta no se encuentra en un estado cancelable.' });

      // Caja cerrada
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: {
            findFirst: jest.fn().mockResolvedValue({
              idVenta: 1,
              idSuc: 1,
              estadoVenta: 'COMPLETADA',
              idSesionCaja: 1,
              sesionCaja: { estado: 'CERRADA' },
              pedidos: [],
              detalles: [{ idPro: 1, cantidadDetVenta: 1 }],
            }),
          },
        });
      });
      await expect(ventasService.cancelarVenta(1, 1, 1, 'Motivo de cancelacion')).rejects.toMatchObject({ status: 409, message: 'La venta pertenece a una caja cerrada.' });

      // Pedido online
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: {
            findFirst: jest.fn().mockResolvedValue({
              idVenta: 1,
              idSuc: 1,
              estadoVenta: 'COMPLETADA',
              idSesionCaja: 1,
              sesionCaja: { estado: 'ABIERTA' },
              pedidos: [{ idPedido: 1 }],
              detalles: [{ idPro: 1, cantidadDetVenta: 1 }],
            }),
          },
        });
      });
      await expect(ventasService.cancelarVenta(1, 1, 1, 'Motivo de cancelacion')).rejects.toMatchObject({ status: 409, message: 'Las ventas de pedidos online deben gestionarse desde el pedido.' });

      // Sin detalles
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          venta: {
            findFirst: jest.fn().mockResolvedValue({
              idVenta: 1,
              idSuc: 1,
              estadoVenta: 'COMPLETADA',
              idSesionCaja: 1,
              sesionCaja: { estado: 'ABIERTA' },
              pedidos: [],
              detalles: [],
            }),
          },
        });
      });
      await expect(ventasService.cancelarVenta(1, 1, 1, 'Motivo de cancelacion')).rejects.toMatchObject({ status: 409, message: 'La venta no contiene detalles para restaurar.' });
    });

    it('debe cancelar exitosamente la venta restaurando inventario', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          venta: {
            findFirst: jest.fn().mockResolvedValue({
              idVenta: 1,
              idSuc: 1,
              estadoVenta: 'COMPLETADA',
              idSesionCaja: 1,
              sesionCaja: { estado: 'ABIERTA' },
              pedidos: [],
              detalles: [{ idPro: 1, cantidadDetVenta: 2 }],
            }),
            update: jest.fn().mockResolvedValue({
              idVenta: 1,
              estadoVenta: 'CANCELADA',
              fechaCancelacion: new Date(),
              motivoCancelacion: 'Error de cobro',
              idEmpCancela: 1,
            }),
          },
          producto: { update: jest.fn() },
        });
      });

      const res = await ventasService.cancelarVenta(1, 1, 1, 'Error de cobro');
      expect(res.estado).toBe('CANCELADA');
    });
  });

  describe('listarVentas y detalleVenta para Cajero y Administrador', () => {
    it('listarVentas y detalleVenta', async () => {
      jest.spyOn(prisma.venta, 'findMany').mockResolvedValue([
        {
          idVenta: 1,
          fechaVenta: new Date(),
          horaVenta: new Date(),
          total: 100,
          metodoPago: 'EFECTIVO',
          estadoVenta: 'COMPLETADA',
          idEmp: 1,
          idSesionCaja: 1,
          uuidVenta: 'uuid',
          empleado: dummyEmpleado,
          pedidos: [],
        } as any,
      ]);

      const lista = await ventasService.listarVentas({ idEmp: 1, idSuc: 1, cargo: 'ADMINISTRADOR' });
      expect(lista.length).toBe(1);
      expect(lista[0]?.origen).toBe('POS');

      jest.spyOn(prisma.venta, 'findFirst').mockResolvedValue({
        idVenta: 1,
        uuidVenta: 'uuid',
        fechaVenta: new Date(),
        horaVenta: new Date(),
        total: 100,
        metodoPago: 'EFECTIVO',
        estadoVenta: 'COMPLETADA',
        empleado: dummyEmpleado,
        empleadoCancela: null,
        sucursal: { nombreSuc: 'Central' },
        pedidos: [],
        detalles: [
          {
            idDetVenta: 1,
            idPro: 1,
            producto: dummyProducto,
            cantidadDetVenta: 1,
            precioUnitarioDetVenta: 15,
            subtotalDetVenta: 15,
          },
        ],
      } as any);

      const det = await ventasService.detalleVenta(1, { idEmp: 1, idSuc: 1, cargo: 'CAJERO' });
      expect(det?.id).toBeDefined();
      expect(det?.items.length).toBe(1);
    });
  });
});
