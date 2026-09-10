import { Request, Response } from 'express';
import { empleadosController } from '../../../src/modules/empleados/empleados.controller';
import { empleadosService } from '../../../src/modules/empleados/empleados.service';

describe('EmpleadosController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = { params: {}, body: {}, empleado: { idEmp: 1 } as any };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('listar y crear', async () => {
    jest.spyOn(empleadosService, 'listar').mockResolvedValue([{ idEmp: 1 } as any]);
    await empleadosController.listar(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith([{ idEmp: 1 }]);

    mockReq.body = { nombre: 'Juan', correo: 'juan@tienda.com', idCargo: 1 };
    jest.spyOn(empleadosService, 'crear').mockResolvedValue({ idEmp: 10 } as any);

    await empleadosController.crear(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ idEmp: 10 });
  });

  it('actualizar (invalido y valido)', async () => {
    mockReq.params = { id: 'invalido' };
    await empleadosController.actualizar(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '2' };
    mockReq.body = { nombre: 'Juan Act' };
    jest.spyOn(empleadosService, 'actualizar').mockResolvedValue({ idEmp: 2, nombre: 'Juan Act' } as any);

    await empleadosController.actualizar(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ idEmp: 2, nombre: 'Juan Act' });
  });

  it('cambiarEstado (invalido y valido)', async () => {
    mockReq.params = { id: 'invalido' };
    await empleadosController.cambiarEstado(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '2' };
    mockReq.body = { estado: true };
    mockReq.empleado = undefined;
    jest.spyOn(empleadosService, 'cambiarEstado').mockResolvedValue({ idEmp: 2, estadoEmp: true } as any);

    await empleadosController.cambiarEstado(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ idEmp: 2, estadoEmp: true });
  });
});
