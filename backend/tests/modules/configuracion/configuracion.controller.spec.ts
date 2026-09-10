import { Request, Response } from 'express';
import { configuracionController } from '../../../src/modules/configuracion/configuracion.controller';
import { configuracionService } from '../../../src/modules/configuracion/configuracion.service';

describe('ConfiguracionController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      body: {},
      empleado: { idEmp: 1, idSuc: 1, cargo: 'ADMINISTRADOR' } as any,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('obtenerAdmin (sin sucursal y con éxito)', async () => {
    mockReq.empleado = { idEmp: 1, idSuc: null } as any;
    await configuracionController.obtenerAdmin(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(409);

    mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
    jest.spyOn(configuracionService, 'obtenerAdmin').mockResolvedValue({ banco: 'BBVA' } as any);
    await configuracionController.obtenerAdmin(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ configuracion: { banco: 'BBVA' } });
  });

  it('actualizarAdmin (sin sucursal y con éxito)', async () => {
    mockReq.empleado = { idEmp: 1, idSuc: null } as any;
    await configuracionController.actualizarAdmin(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(409);

    mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
    mockReq.body = { banco: 'Santander', titular: 'Tienda', activo: true };
    jest.spyOn(configuracionService, 'actualizarAdmin').mockResolvedValue({ banco: 'Santander' } as any);
    await configuracionController.actualizarAdmin(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ configuracion: { banco: 'Santander' } });
  });

  it('obtenerCliente debe retornar configuración para clientes', async () => {
    jest.spyOn(configuracionService, 'obtenerCliente').mockResolvedValue({ banco: 'BBVA' } as any);
    await configuracionController.obtenerCliente(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ configuracion: { banco: 'BBVA' } });
  });
});
