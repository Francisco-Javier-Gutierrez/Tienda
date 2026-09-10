import { Request, Response } from 'express';
import { cajaController } from '../../../src/modules/caja/caja.controller';
import { cajaService } from '../../../src/modules/caja/caja.service';

describe('CajaController Comprehensive Suite', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      params: {},
      body: {},
      query: {},
      empleado: { idEmp: 1, idSuc: 1, cargo: 'CAJERO' } as any,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('abrir (sin empleado y con éxito)', async () => {
    mockReq.empleado = undefined;
    await cajaController.abrir(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
    mockReq.body = { uuidSesionCaja: 'uuid-123', fondoInicial: 500 };
    jest.spyOn(cajaService, 'abrirCaja').mockResolvedValue({ idSesionCaja: 10 } as any);

    await cajaController.abrir(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ idSesionCaja: 10 });
  });

  it('actual y actualResumen (sin empleado, sin caja, y con éxito)', async () => {
    mockReq.empleado = undefined;
    await cajaController.actual(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1 } as any;
    jest.spyOn(cajaService, 'obtenerCajaActual').mockResolvedValue({ idSesionCaja: 10 } as any);
    await cajaController.actual(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ caja: { idSesionCaja: 10 } });

    // actualResumen
    mockReq.empleado = undefined;
    await cajaController.actualResumen(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1 } as any;
    jest.spyOn(cajaService, 'obtenerCajaActual').mockResolvedValueOnce(null);
    await cajaController.actualResumen(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(404);

    jest.spyOn(cajaService, 'obtenerCajaActual').mockResolvedValueOnce({ idSesionCaja: 10 } as any);
    jest.spyOn(cajaService, 'calcularResumenCaja').mockResolvedValue({ totalVentas: 500 } as any);
    await cajaController.actualResumen(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ totalVentas: 500 });
  });

  it('registrarMovimiento y listarMovimientos', async () => {
    mockReq.empleado = undefined;
    await cajaController.registrarMovimiento(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1 } as any;
    mockReq.body = { uuidMovimientoCaja: 'uuid', tipoMovimiento: 'INGRESO', concepto: 'Cambio', monto: 100 };
    jest.spyOn(cajaService, 'registrarMovimiento').mockResolvedValue({ idMovimientoCaja: 1 } as any);

    await cajaController.registrarMovimiento(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ idMovimientoCaja: 1 });

    // listarMovimientos
    mockReq.empleado = undefined;
    await cajaController.listarMovimientos(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1 } as any;
    jest.spyOn(cajaService, 'listarMovimientos').mockResolvedValue([{ idMovimientoCaja: 1 }] as any);
    await cajaController.listarMovimientos(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith([{ idMovimientoCaja: 1 }]);
  });

  it('cerrar e historial', async () => {
    mockReq.empleado = undefined;
    await cajaController.cerrar(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1 } as any;
    mockReq.body = { efectivoContado: 500 };
    jest.spyOn(cajaService, 'cerrarCaja').mockResolvedValue({ idSesionCaja: 10, estado: 'CERRADA' } as any);

    await cajaController.cerrar(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ idSesionCaja: 10, estado: 'CERRADA' });

    // Historial
    mockReq.empleado = undefined;
    await cajaController.historial(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1, idSuc: 1, cargo: 'CAJERO' } as any;
    jest.spyOn(cajaService, 'historial').mockResolvedValue([{ idSesionCaja: 1 }] as any);
    await cajaController.historial(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith([{ idSesionCaja: 1 }]);
  });

  it('detalle (invalido, sin empleado, no encontrado, encontrado)', async () => {
    mockReq.params = { id: 'invalido' };
    await cajaController.detalle(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '1' };
    mockReq.empleado = undefined;
    await cajaController.detalle(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1, idSuc: 1, cargo: 'CAJERO' } as any;
    jest.spyOn(cajaService, 'detalle').mockResolvedValueOnce(null);
    await cajaController.detalle(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(404);

    jest.spyOn(cajaService, 'detalle').mockResolvedValueOnce({ idSesionCaja: 1 } as any);
    await cajaController.detalle(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ idSesionCaja: 1 });
  });
});
