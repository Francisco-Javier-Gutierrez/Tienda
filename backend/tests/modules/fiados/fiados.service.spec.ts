import { fiadosService } from '../../../src/modules/fiados/fiados.service';
import { fiadoRepository } from '../../../src/db/repositories/fiado.repository';
import { cajaRepository } from '../../../src/db/repositories/caja.repository';

describe('FiadosService Complete Coverage', () => {
  const dummyEmpleado = {
    idEmp: 1,
    idSuc: 1,
    nombre: 'Don Pepe',
  };

  const dummyCliente = {
    idCliente: 10,
    nombreCliente: 'Juan',
    apellidoPatCliente: 'Pérez',
    telefono: '7771234567',
    correoCliente: 'vecino_10@tienda.local',
    saldoDeudor: 250,
    limiteCredito: 1000,
    estadoCliente: true,
  };

  const dummyMov = {
    idMov: 1,
    idCliente: 10,
    clienteNombre: 'Juan Pérez',
    idSuc: 1,
    idEmp: 1,
    empleadoNombre: 'Don Pepe',
    tipo: 'ABONO' as const,
    monto: 100,
    saldoAnterior: 250,
    saldoNuevo: 150,
    idSesionCaja: 5,
    concepto: 'Abono en efectivo',
    metodoPago: 'EFECTIVO' as const,
    fechaHora: '2026-09-19T12:00:00.000Z',
    fecha: '2026-09-19',
    createdAt: '2026-09-19T12:00:00.000Z',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listarDeudores y obtenerResumen', () => {
    it('debe listar deudores normalizados', async () => {
      jest.spyOn(fiadoRepository, 'listClientesDeudores').mockResolvedValue([dummyCliente]);

      const res = await fiadosService.listarDeudores(1);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBeDefined();
      expect(res[0].saldoDeudor).toBe(250);
    });

    it('debe calcular métricas del resumen de fiados', async () => {
      jest
        .spyOn(fiadoRepository, 'listClientesDeudores')
        .mockResolvedValue([dummyCliente, { ...dummyCliente, idCliente: 11, saldoDeudor: 150 }]);

      const resumen = await fiadosService.obtenerResumen(1);
      expect(resumen.totalDeudores).toBe(2);
      expect(resumen.totalDeuda).toBe(400);
      expect(resumen.deudaPromedio).toBe(200);
      expect(resumen.topDeudores).toHaveLength(2);
    });
  });

  describe('obtenerEstadoCuenta', () => {
    it('debe rechazar si el idCliente es inválido o no existe', async () => {
      await expect(fiadosService.obtenerEstadoCuenta('invalido')).rejects.toMatchObject({ status: 400 });

      jest.spyOn(fiadoRepository, 'getClienteById').mockResolvedValue(null);
      await expect(fiadosService.obtenerEstadoCuenta(999)).rejects.toMatchObject({ status: 404 });
    });

    it('debe retornar cliente y sus movimientos', async () => {
      jest.spyOn(fiadoRepository, 'getClienteById').mockResolvedValue(dummyCliente);
      jest.spyOn(fiadoRepository, 'getHistorialCuenta').mockResolvedValue([dummyMov]);

      const res = await fiadosService.obtenerEstadoCuenta(10);
      expect(res.cliente.nombre).toBe('Juan');
      expect(res.movimientos).toHaveLength(1);
      expect(res.movimientos[0].tipo).toBe('ABONO');
    });
  });

  describe('registrarAbono', () => {
    it('debe rechazar si el monto es <= 0 o idCliente inválido', async () => {
      await expect(
        fiadosService.registrarAbono(dummyEmpleado, 10, { monto: 0, metodoPago: 'EFECTIVO' }),
      ).rejects.toMatchObject({ status: 400 });

      await expect(
        fiadosService.registrarAbono(dummyEmpleado, 'invalido', { monto: 50, metodoPago: 'EFECTIVO' }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('debe rechazar si el cliente no existe', async () => {
      jest.spyOn(fiadoRepository, 'getClienteById').mockResolvedValue(null);

      await expect(
        fiadosService.registrarAbono(dummyEmpleado, 999, { monto: 50, metodoPago: 'EFECTIVO' }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('debe registrar abono exitosamente vinculando la caja abierta', async () => {
      jest.spyOn(fiadoRepository, 'getClienteById').mockResolvedValue(dummyCliente);
      jest.spyOn(cajaRepository, 'getSesionAbierta').mockResolvedValue({ idSesionCaja: 5 } as any);
      jest.spyOn(fiadoRepository, 'registrarAbono').mockResolvedValue(dummyMov);

      const res = await fiadosService.registrarAbono(dummyEmpleado, 10, {
        monto: 100,
        metodoPago: 'EFECTIVO',
      });

      expect(res.abono).toBeDefined();
      expect(res.nuevoSaldo).toBe(150);
      expect(res.mensaje).toContain('$100.00');
    });
  });

  describe('crearClienteRapido', () => {
    it('debe registrar y retornar el cliente rápido', async () => {
      jest.spyOn(fiadoRepository, 'crearClienteRapido').mockResolvedValue(dummyCliente);

      const res = await fiadosService.crearClienteRapido({
        nombreCliente: 'Juan',
        telefono: '7771234567',
      });

      expect(res.nombre).toBe('Juan');
      expect(res.telefono).toBe('7771234567');
    });
  });
});
