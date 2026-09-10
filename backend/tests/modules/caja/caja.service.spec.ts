import { cajaService } from '../../../src/modules/caja/caja.service';
import { prisma } from '../../../src/config/prisma';

describe('CajaService Complete Coverage', () => {
  const dummyEmpleado = {
    nombreEmp: 'Cajero',
    apellidoPatEmp: 'Uno',
    apellidoMatEmp: null,
  };
  const dummySucursal = {
    nombreSuc: 'Sucursal Central',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('abrirCaja', () => {
    it('debe rechazar uuid o fondo inválido', async () => {
      await expect(cajaService.abrirCaja(1, 1, 'invalido', 100)).rejects.toMatchObject({
        status: 400,
      });
      await expect(
        cajaService.abrirCaja(1, 1, '11111111-1111-4111-8111-111111111111', -10),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('debe ser idempotente si el uuid ya existe para el mismo empleado y sucursal', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          sesionCaja: {
            findUnique: jest.fn().mockResolvedValue({
              idSesionCaja: 1,
              uuidSesionCaja: '11111111-1111-4111-8111-111111111111',
              idEmp: 1,
              idSuc: 1,
              fondoInicial: 500,
              estado: 'ABIERTA',
              empleado: dummyEmpleado,
              sucursal: dummySucursal,
            }),
          },
        });
      });

      const caja = await cajaService.abrirCaja(1, 1, '11111111-1111-4111-8111-111111111111', 500);
      expect(caja.id).toBeDefined();
    });

    it('debe rechazar si el uuid pertenece a otro empleado o sucursal', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          sesionCaja: {
            findUnique: jest.fn().mockResolvedValue({
              idSesionCaja: 1,
              uuidSesionCaja: '11111111-1111-4111-8111-111111111111',
              idEmp: 2,
              idSuc: 1,
              empleado: dummyEmpleado,
              sucursal: dummySucursal,
            }),
          },
        });
      });

      await expect(
        cajaService.abrirCaja(1, 1, '11111111-1111-4111-8111-111111111111', 500),
      ).rejects.toMatchObject({ status: 409, message: 'El identificador de caja ya está en uso.' });
    });

    it('debe rechazar si el empleado ya tiene una caja abierta', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          sesionCaja: {
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 2, estado: 'ABIERTA' }),
          },
        });
      });

      await expect(
        cajaService.abrirCaja(1, 1, '11111111-1111-4111-8111-111111111111', 500),
      ).rejects.toMatchObject({ status: 409, message: 'Ya tienes una caja abierta.' });
    });

    it('debe crear una nueva caja exitosamente', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          sesionCaja: {
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              idSesionCaja: 10,
              uuidSesionCaja: '11111111-1111-4111-8111-111111111111',
              idEmp: 1,
              idSuc: 1,
              fondoInicial: 500,
              estado: 'ABIERTA',
              empleado: dummyEmpleado,
              sucursal: dummySucursal,
            }),
          },
        });
      });

      const res = await cajaService.abrirCaja(1, 1, '11111111-1111-4111-8111-111111111111', 500);
      expect(res.id).toBeDefined();
      expect(res.estado).toBe('ABIERTA');
    });
  });

  describe('calcularResumenCaja y cerrarCaja', () => {
    it('debe calcular resumen y cerrar caja con y sin observaciones', async () => {
      await expect(cajaService.cerrarCaja(1, -1)).rejects.toMatchObject({ status: 400 });
      await expect(cajaService.cerrarCaja(1, 100, 'a'.repeat(1005))).rejects.toMatchObject({ status: 400 });

      // No abierta
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({ sesionCaja: { findFirst: jest.fn().mockResolvedValue(null) } });
      });
      await expect(cajaService.cerrarCaja(1, 100)).rejects.toMatchObject({ status: 409 });

      // Exito
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          sesionCaja: {
            findFirst: jest.fn().mockResolvedValue({
              idSesionCaja: 1,
              idEmp: 1,
              idSuc: 1,
              fondoInicial: 500,
              estado: 'ABIERTA',
              fechaHoraApertura: new Date(),
              empleado: dummyEmpleado,
              sucursal: dummySucursal,
            }),
            update: jest.fn().mockResolvedValue({
              idSesionCaja: 1,
              idEmp: 1,
              idSuc: 1,
              fondoInicial: 500,
              estado: 'CERRADA',
              empleado: dummyEmpleado,
              sucursal: dummySucursal,
            }),
          },
          venta: {
            findMany: jest.fn().mockResolvedValue([
              { total: 100, metodoPago: 'EFECTIVO', estadoVenta: 'COMPLETADA' },
              { total: 200, metodoPago: 'TARJETA', estadoVenta: 'COMPLETADA' },
              { total: 50, metodoPago: 'TRANSFERENCIA', estadoVenta: 'COMPLETADA' },
            ]),
          },
          movimientoCaja: {
            findMany: jest.fn().mockResolvedValue([
              { tipoMovimiento: 'INGRESO', monto: 20 },
              { tipoMovimiento: 'RETIRO', monto: 10 },
            ]),
          },
        });
      });

      const cerrada = await cajaService.cerrarCaja(1, 610, 'Cierre sin novedades');
      expect(cerrada.estado).toBe('CERRADA');
    });
  });

  describe('registrarMovimiento y listarMovimientos', () => {
    it('debe validar uuid, tipo, monto y concepto', async () => {
      await expect(cajaService.registrarMovimiento(1, 'inv', 'INGRESO', 'c', 10)).rejects.toMatchObject({ status: 400 });
      await expect(cajaService.registrarMovimiento(1, '11111111-1111-4111-8111-111111111111', 'OTRO', 'c', 10)).rejects.toMatchObject({ status: 400 });
      await expect(cajaService.registrarMovimiento(1, '11111111-1111-4111-8111-111111111111', 'INGRESO', 'c', 0)).rejects.toMatchObject({ status: 400 });
      await expect(cajaService.registrarMovimiento(1, '11111111-1111-4111-8111-111111111111', 'INGRESO', '', 10)).rejects.toMatchObject({ status: 400 });
    });

    it('debe rechazar si no hay caja abierta', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({ sesionCaja: { findFirst: jest.fn().mockResolvedValue(null) } });
      });

      await expect(
        cajaService.registrarMovimiento(1, '11111111-1111-4111-8111-111111111111', 'INGRESO', 'Cambio', 100),
      ).rejects.toMatchObject({ status: 409, message: 'No tienes una caja abierta.' });
    });

    it('debe ser idempotente con movimiento existente del mismo idSesionCaja y rechazar si es de otra', async () => {
      // Mismo
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          sesionCaja: { findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1, idEmp: 1 }) },
          movimientoCaja: {
            findUnique: jest.fn().mockResolvedValue({
              idMovimientoCaja: 1,
              idSesionCaja: 1,
              idEmp: 1,
              monto: 50,
            }),
          },
        });
      });
      const mov = await cajaService.registrarMovimiento(1, '11111111-1111-4111-8111-111111111111', 'INGRESO', 'Cambio', 50);
      expect(mov.idMovimientoCaja).toBe(1);

      // Diferente
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          sesionCaja: { findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1, idEmp: 1 }) },
          movimientoCaja: {
            findUnique: jest.fn().mockResolvedValue({
              idMovimientoCaja: 1,
              idSesionCaja: 99,
              idEmp: 2,
              monto: 50,
            }),
          },
        });
      });
      await expect(
        cajaService.registrarMovimiento(1, '11111111-1111-4111-8111-111111111111', 'INGRESO', 'Cambio', 50),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('debe crear un nuevo movimiento y listar movimientos', async () => {
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          sesionCaja: { findFirst: jest.fn().mockResolvedValue({ idSesionCaja: 1, idEmp: 1 }) },
          movimientoCaja: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              idMovimientoCaja: 20,
              uuidMovimientoCaja: '11111111-1111-4111-8111-111111111111',
              idSesionCaja: 1,
              idEmp: 1,
              tipoMovimiento: 'RETIRO',
              monto: 15,
              concepto: 'Retiro',
            }),
          },
        });
      });

      const nuevo = await cajaService.registrarMovimiento(1, '11111111-1111-4111-8111-111111111111', 'RETIRO', 'Retiro', 15);
      expect(nuevo.idMovimientoCaja).toBe(20);

      // Listar movimientos
      jest.spyOn(cajaService, 'obtenerCajaActual').mockResolvedValueOnce({ idSesionCaja: 1 } as any);
      jest.spyOn(prisma.movimientoCaja, 'findMany').mockResolvedValue([
        { idMovimientoCaja: 20, monto: 15 } as any,
      ]);
      const lista = await cajaService.listarMovimientos(1);
      expect(lista.length).toBe(1);
    });
  });

  describe('historial y detalle con rol Administrador y Cajero', () => {
    it('historial con filtros de fecha, estado y empleado para admin y cajero', async () => {
      jest.spyOn(prisma.sesionCaja, 'findMany').mockResolvedValue([]);

      // Cajero
      await cajaService.historial({ idEmp: 2, idSuc: 1, cargo: 'CAJERO' }, { estado: 'ABIERTA', fecha: '2026-05-10' });

      // Admin con idEmp
      await cajaService.historial({ idEmp: 1, idSuc: 1, cargo: 'ADMINISTRADOR' }, { idEmp: 2, estado: 'CERRADA', fecha: '2026-05-10' });
      expect(prisma.sesionCaja.findMany).toHaveBeenCalledTimes(2);
    });

    it('detalle para Administrador y Cajero', async () => {
      jest.spyOn(prisma.sesionCaja, 'findFirst').mockResolvedValue({
        idSesionCaja: 5,
        fondoInicial: 100,
        empleado: dummyEmpleado,
        sucursal: dummySucursal,
        movimientos: [],
        ventas: [],
      } as any);

      const detAdmin = await cajaService.detalle(5, { idEmp: 1, idSuc: 1, cargo: 'ADMINISTRADOR' });
      expect(detAdmin?.id).toBeDefined();

      const detCaj = await cajaService.detalle(5, { idEmp: 2, idSuc: 1, cargo: 'CAJERO' });
      expect(detCaj?.id).toBeDefined();
    });
  });
});
