import { ventasService } from '../../../src/modules/ventas/ventas.service';
import { cajaRepository } from '../../../src/db/repositories/caja.repository';
import { productoRepository } from '../../../src/db/repositories/producto.repository';
import { ventaRepository } from '../../../src/db/repositories/venta.repository';

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

    it('debe rechazar si la caja no está abierta, si falta un producto, sin stock o efectivo insuficiente', async () => {
      // Caja no abierta
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValueOnce(null);
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'TARJETA',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 409, message: 'Debes abrir caja antes de registrar ventas.' });

      // Producto no encontrado
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValueOnce({ idSesionCaja: 1 } as any);
      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValueOnce(null);
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'TARJETA',
          items: [{ idPro: 1, cantidad: 1 }],
        }),
      ).rejects.toMatchObject({ status: 404, message: 'El producto no existe' });

      // Stock insuficiente
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValueOnce({ idSesionCaja: 1 } as any);
      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValueOnce({ ...dummyProducto, existenciaPro: 2 } as any);
      await expect(
        ventasService.crearVenta(dummyEmpleado, {
          uuidVenta: '11111111-1111-4111-8111-111111111111',
          metodoPago: 'TARJETA',
          items: [{ idPro: 1, cantidad: 10 }],
        }),
      ).rejects.toMatchObject({ status: 409 });

      // Efectivo insuficiente
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValueOnce({ idSesionCaja: 1 } as any);
      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValueOnce(dummyProducto as any);
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
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValue({ idSesionCaja: 1 } as any);
      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValue(dummyProducto as any);
      jest.spyOn(ventaRepository, 'createVenta').mockResolvedValue({
        idVenta: 100,
        idSuc: 1,
        idEmp: 1,
        idSesionCaja: 1,
        totalVenta: 15,
        pagoCon: 20,
        cambio: 5,
        metodoPago: 'EFECTIVO',
        items: [{ idPro: 1, nombrePro: 'Coca Cola', cantidad: 1, precioUnitario: 15 }],
        fechaVenta: new Date().toISOString(),
      } as any);

      // Efectivo
      const vEf = await ventasService.crearVenta(dummyEmpleado, {
        uuidVenta: '11111111-1111-4111-8111-111111111111',
        metodoPago: 'EFECTIVO',
        montoRecibido: 20,
        items: [{ idPro: 1, cantidad: 1 }],
      });
      expect(vEf?.id).toBeDefined();

      // Tarjeta
      jest.spyOn(ventaRepository, 'createVenta').mockResolvedValue({
        idVenta: 101,
        idSuc: 1,
        idEmp: 1,
        idSesionCaja: 1,
        totalVenta: 15,
        pagoCon: 15,
        cambio: 0,
        metodoPago: 'TARJETA',
        items: [{ idPro: 1, nombrePro: 'Coca Cola', cantidad: 1, precioUnitario: 15 }],
        fechaVenta: new Date().toISOString(),
      } as any);
      const vTar = await ventasService.crearVenta(dummyEmpleado, {
        uuidVenta: '22222222-2222-4222-8222-222222222222',
        metodoPago: 'TARJETA',
        items: [{ idPro: 1, cantidad: 1 }],
      });
      expect(vTar?.id).toBeDefined();
    });
  });

  describe('cancelarVenta validaciones y ramas', () => {
    it('debe rechazar si motivo es inválido (< 3 caracteres)', async () => {
      await expect(ventasService.cancelarVenta(1, 1, 1, 'ab')).rejects.toMatchObject({ status: 400 });
    });

    it('debe cancelar exitosamente la venta', async () => {
      jest.spyOn(ventaRepository, 'cancelarVenta').mockResolvedValue({
        idVenta: 1,
        estadoVenta: 'CANCELADA',
        motivoCancelacion: 'Error de cobro',
      } as any);

      const res = await ventasService.cancelarVenta(1, 1, 1, 'Error de cobro');
      expect(res.estadoVenta).toBe('CANCELADA');
    });

    it('debe retornar venta existente si uuidVenta ya fue registrado previamente (idempotencia)', async () => {
      const mockExistente = {
        idVenta: 100,
        uuidVenta: '22222222-2222-4222-8222-222222222222',
        idSuc: 1,
        idEmp: 1,
        idSesionCaja: 1,
        totalVenta: 15,
        pagoCon: 20,
        cambio: 5,
        metodoPago: 'EFECTIVO',
        estadoVenta: 'COMPLETADA',
        fechaVenta: new Date().toISOString(),
        detalles: [{ idPro: 1, nombrePro: 'Coca Cola', cantidad: 1, precioUnitario: 15, subtotal: 15 }],
      };

      jest.spyOn(ventaRepository, 'getVentaByUuid').mockResolvedValueOnce(mockExistente as any);
      const spyCreate = jest.spyOn(ventaRepository, 'createVenta');

      const res = await ventasService.crearVenta(dummyEmpleado, {
        uuidVenta: '22222222-2222-4222-8222-222222222222',
        metodoPago: 'EFECTIVO',
        items: [{ idPro: 1, cantidad: 1 }],
      });

      expect(res).toBeDefined();
      expect(res?.uuid).toBe('22222222-2222-4222-8222-222222222222');
      // No debe haber intentado crear una nueva venta
      expect(spyCreate).not.toHaveBeenCalled();
    });
  });

  describe('listarVentas y detalleVenta para Cajero y Administrador', () => {
    it('listarVentas y detalleVenta', async () => {
      jest.spyOn(ventaRepository, 'listVentas').mockResolvedValue([
        {
          idVenta: 1,
          fechaVenta: new Date().toISOString(),
          totalVenta: 100,
          metodoPago: 'EFECTIVO',
          estadoVenta: 'COMPLETADA',
          idEmp: 1,
          idSesionCaja: 1,
          items: [],
        } as any,
      ]);

      const lista = await ventasService.listarVentas({ idEmp: 1, idSuc: 1, cargo: 'ADMINISTRADOR' });
      expect(lista.length).toBe(1);

      jest.spyOn(ventaRepository, 'getVentaById').mockResolvedValue({
        idVenta: 1,
        fechaVenta: new Date().toISOString(),
        totalVenta: 100,
        metodoPago: 'EFECTIVO',
        estadoVenta: 'COMPLETADA',
        idEmp: 1,
        items: [
          {
            idPro: 1,
            nombrePro: 'Coca Cola',
            cantidad: 1,
            precioUnitario: 15,
          },
        ],
      } as any);

      const det = await ventasService.detalleVenta(1, { idEmp: 1, idSuc: 1, cargo: 'CAJERO' });
      expect(det?.id).toBeDefined();
      expect(det?.items.length).toBe(1);

      // Si otro cajero intenta ver una venta que no le pertenece
      const detOtro = await ventasService.detalleVenta(1, { idEmp: 99, idSuc: 1, cargo: 'CAJERO' });
      expect(detOtro).toBeNull();
    });
  });
});
