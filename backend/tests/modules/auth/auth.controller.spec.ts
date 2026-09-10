import { Request, Response } from 'express';
import { authController } from '../../../src/modules/auth/auth.controller';
import { authService } from '../../../src/modules/auth/auth.service';

describe('AuthController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('login debe llamar a authService.loginEmpleado y responder json', async () => {
    mockReq.body = { correo: 'test@correo.com', password: '123' };
    jest.spyOn(authService, 'loginEmpleado').mockResolvedValue({
      token: 'jwt-token',
      empleado: { idEmp: 1 } as any,
    });

    await authController.login(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'jwt-token' }),
    );
  });

  it('googleEmpleado debe llamar a authService.googleAuthEmpleado', async () => {
    mockReq.body = { idToken: 'google-token' };
    jest.spyOn(authService, 'googleAuthEmpleado').mockResolvedValue({
      token: 'jwt-token',
      empleado: { idEmp: 2 } as any,
    });

    await authController.googleEmpleado(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'jwt-token' }),
    );
  });

  it('googleCliente debe llamar a authService.googleAuthCliente', async () => {
    mockReq.body = { idToken: 'google-token' };
    jest.spyOn(authService, 'googleAuthCliente').mockResolvedValue({
      token: 'jwt-token-client',
      cliente: { idCliente: 5 } as any,
    });

    await authController.googleCliente(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'jwt-token-client' }),
    );
  });

  it('meEmpleado (sin empleado y con empleado)', () => {
    mockReq.empleado = undefined;
    authController.meEmpleado(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.empleado = {
      idEmp: 1,
      nombre: 'Admin',
      nombreEmp: 'Admin',
      apellidoPatEmp: null,
      apellidoMatEmp: null,
      correo: 'admin@tienda.com',
      telefono: null,
      fechaIngreso: null,
      fotoPerfil: null,
      idCargo: 1,
      cargo: 'ADMINISTRADOR',
      idSuc: 1,
      nombreSuc: 'Central',
      estadoEmp: true,
    };

    authController.meEmpleado(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        empleado: expect.objectContaining({ idEmp: 1 }),
      }),
    );
  });

  it('meCliente (sin cliente y con cliente)', () => {
    mockReq.cliente = undefined;
    authController.meCliente(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(401);

    mockReq.cliente = {
      idCliente: 10,
      nombre: 'Cliente',
      apellidoPat: null,
      apellidoMat: null,
      correo: 'cliente@tienda.com',
      fotoPerfil: null,
      estadoCliente: true,
      fechaRegistro: null,
      ultimoAcceso: null,
      rol: 'CLIENTE',
    };

    authController.meCliente(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        cliente: expect.objectContaining({ idCliente: 10 }),
      }),
    );
  });
});
