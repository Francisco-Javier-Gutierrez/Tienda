import { Request, Response } from 'express';
import { ventasController } from '../../../src/modules/ventas/ventas.controller';
import { ventasService } from '../../../src/modules/ventas/ventas.service';

describe('VentasController Comprehensive Suite', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      params: {},
      body: {},
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

  it('crear (sin empleado y con éxito)', async () => {
    mockReq.empleado = undefined;
    await ventasController.crear(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
    mockReq.body = { uuidVenta: 'uuid', metodoPago: 'EFECTIVO', items: [{ idPro: 1, cantidad: 1 }] };
    jest.spyOn(ventasService, 'crearVenta').mockResolvedValue({ idVenta: 100 } as any);

    await ventasController.crear(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ idVenta: 100 });
  });

  it('cancelar (invalido, sin empleado, y con éxito)', async () => {
    mockReq.params = { id: 'invalido' };
    await ventasController.cancelar(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '100' };
    mockReq.empleado = undefined;
    await ventasController.cancelar(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
    mockReq.body = { motivo: 'Error en cobro' };
    jest.spyOn(ventasService, 'cancelarVenta').mockResolvedValue({ idVenta: 100, estadoVenta: 'CANCELADA' } as any);

    await ventasController.cancelar(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('cancelada correctamente') }),
    );
  });

  it('listar (sin empleado y con éxito)', async () => {
    mockReq.empleado = undefined;
    await ventasController.listar(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1, idSuc: 1, cargo: 'ADMINISTRADOR' } as any;
    jest.spyOn(ventasService, 'listarVentas').mockResolvedValue([{ idVenta: 100 } as any]);
    await ventasController.listar(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith([{ idVenta: 100 }]);
  });

  it('detalle (invalido, sin empleado, no encontrado, y encontrado)', async () => {
    mockReq.params = { id: 'invalido' };
    await ventasController.detalle(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '100' };
    mockReq.empleado = undefined;
    await ventasController.detalle(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = { idEmp: 1, idSuc: 1, cargo: 'CAJERO' } as any;
    jest.spyOn(ventasService, 'detalleVenta').mockResolvedValueOnce(null);
    await ventasController.detalle(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(404);

    jest.spyOn(ventasService, 'detalleVenta').mockResolvedValueOnce({ idVenta: 100 } as any);
    await ventasController.detalle(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ idVenta: 100 });
  });
});
