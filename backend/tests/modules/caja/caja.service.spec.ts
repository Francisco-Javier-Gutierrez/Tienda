import { cajaService } from '../../../src/modules/caja/caja.service';
import { cajaRepository } from '../../../src/db/repositories/caja.repository';
import { ventaRepository } from '../../../src/db/repositories/venta.repository';

describe('CajaService Complete Coverage', () => {
  const dummySesion = {
    idSesionCaja: 1,
    idSuc: 1,
    idEmp: 1,
    fondoInicial: 500,
    totalVentas: 0,
    estado: 'ABIERTA' as const,
    fechaApertura: new Date().toISOString(),
    empleadoNombre: 'Cajero Uno',
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

    it('debe rechazar si ya tiene una caja abierta', async () => {
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValue(dummySesion);

      await expect(
        cajaService.abrirCaja(1, 1, '11111111-1111-4111-8111-111111111111', 500),
      ).rejects.toMatchObject({ status: 409, message: 'Ya tienes una caja abierta.' });
    });

    it('debe crear una nueva caja exitosamente', async () => {
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValue(null);
      jest.spyOn(cajaRepository, 'abrirSesion').mockResolvedValue({
        ...dummySesion,
        idSesionCaja: 10,
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
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValueOnce(null);
      await expect(cajaService.cerrarCaja(1, 100)).rejects.toMatchObject({ status: 409 });

      // Exito
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValue(dummySesion);
      jest.spyOn(ventaRepository, 'listVentas').mockResolvedValue([
        { idVenta: 1, idSuc: 1, idEmp: 1, idSesionCaja: 1, totalVenta: 100, metodoPago: 'EFECTIVO', fechaVenta: '', detalles: [] },
        { idVenta: 2, idSuc: 1, idEmp: 1, idSesionCaja: 1, totalVenta: 200, metodoPago: 'TARJETA', fechaVenta: '', detalles: [] },
        { idVenta: 3, idSuc: 1, idEmp: 1, idSesionCaja: 1, totalVenta: 50, metodoPago: 'TRANSFERENCIA', fechaVenta: '', detalles: [] },
      ]);
      jest.spyOn(cajaRepository, 'listMovimientos').mockResolvedValue([
        { tipoMovimiento: 'INGRESO', monto: 20 },
        { tipoMovimiento: 'RETIRO', monto: 10 },
      ]);
      jest.spyOn(cajaRepository, 'cerrarSesion').mockResolvedValue({
        ...dummySesion,
        estado: 'CERRADA',
        montoReal: 610,
        diferencia: 0,
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
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValue(null);

      await expect(
        cajaService.registrarMovimiento(1, '11111111-1111-4111-8111-111111111111', 'INGRESO', 'Cambio', 100),
      ).rejects.toMatchObject({ status: 409, message: 'No tienes una caja abierta.' });
    });

    it('debe crear un nuevo movimiento y listar movimientos', async () => {
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValue(dummySesion);
      jest.spyOn(cajaRepository, 'registrarMovimiento').mockResolvedValue({
        idMovimientoCaja: 20,
        uuidMovimientoCaja: '11111111-1111-4111-8111-111111111111',
        idSesionCaja: 1,
        idEmp: 1,
        tipoMovimiento: 'RETIRO',
        monto: 15,
        concepto: 'Retiro',
        fechaHora: new Date().toISOString(),
      });

      const nuevo = await cajaService.registrarMovimiento(1, '11111111-1111-4111-8111-111111111111', 'RETIRO', 'Retiro', 15);
      expect(nuevo.idMovimientoCaja).toBe(20);

      // Listar movimientos
      jest.spyOn(cajaRepository, 'listMovimientos').mockResolvedValue([
        { idMovimientoCaja: 20, monto: 15 },
      ]);
      const lista = await cajaService.listarMovimientos(1);
      expect(lista.length).toBe(1);
    });
  });

  describe('historial y detalle con rol Administrador y Cajero', () => {
    it('historial con filtros de estado para admin y cajero', async () => {
      jest.spyOn(cajaRepository, 'listSesiones').mockResolvedValue([
        dummySesion,
        { ...dummySesion, idEmp: 2, idSesionCaja: 2, estado: 'CERRADA' },
      ]);

      // Cajero
      const resCaj = await cajaService.historial({ idEmp: 2, idSuc: 1, cargo: 'CAJERO' }, { estado: 'CERRADA' });
      expect(resCaj.length).toBe(1);

      // Admin
      const resAdmin = await cajaService.historial({ idEmp: 1, idSuc: 1, cargo: 'ADMINISTRADOR' }, { estado: 'ABIERTA' });
      expect(resAdmin.length).toBe(1);
    });

    it('detalle para Administrador y Cajero', async () => {
      jest.spyOn(cajaRepository, 'getSesionById').mockResolvedValue(dummySesion);
      jest.spyOn(cajaRepository, 'listMovimientos').mockResolvedValue([]);

      const detAdmin = await cajaService.detalle(1, { idEmp: 9, idSuc: 1, cargo: 'ADMINISTRADOR' });
      expect(detAdmin?.id).toBeDefined();

      const detCaj = await cajaService.detalle(1, { idEmp: 1, idSuc: 1, cargo: 'CAJERO' });
      expect(detCaj?.id).toBeDefined();
    });
  });
});
