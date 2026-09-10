import { Request, Response, NextFunction } from 'express';
import {
  autenticar,
  autenticarCliente,
  autorizarRoles,
  rolesPos,
  soloAdministrador,
} from '../../src/middlewares/auth.middleware';
import { prisma } from '../../src/config/prisma';
import { emitirSesionCliente, emitirSesionEmpleado } from '../../src/utils/security';

describe('Auth & Authorization Middlewares', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('autenticar (Empleado)', () => {
    it('debe responder 401 si no hay token', async () => {
      await autenticar(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe responder 401 si se usa un token de Cliente en ruta de Empleado', async () => {
      const token = emitirSesionCliente({ idCliente: 1 });
      mockReq.headers = { authorization: `Bearer ${token}` };

      await autenticar(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe responder 401 si el empleado no existe o está desactivado', async () => {
      const token = emitirSesionEmpleado({ idEmp: 999 });
      mockReq.headers = { authorization: `Bearer ${token}` };

      jest.spyOn(prisma.empleado, 'findUnique').mockResolvedValue(null);

      await autenticar(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe adjuntar req.empleado y llamar a next si el token y empleado son válidos', async () => {
      const token = emitirSesionEmpleado({ idEmp: 1 });
      mockReq.headers = { authorization: `Bearer ${token}` };

      jest.spyOn(prisma.empleado, 'findUnique').mockResolvedValue({
        idEmp: 1,
        nombreEmp: 'Admin',
        apellidoPatEmp: 'Principal',
        apellidoMatEmp: null,
        correoEmp: 'admin@tienda.com',
        contrasenaHash: 'hash',
        telefono: '123',
        fechaIngreso: new Date(),
        fotoPerfil: null,
        idCargo: 1,
        estadoEmp: true,
        googleSub: null,
        cargo: {
          idCargo: 1,
          nombreCargo: 'ADMINISTRADOR',
          idSuc: 1,
          sucursal: {
            idSuc: 1,
            nombreSuc: 'Principal',
            descripcionSuc: null,
            telefonoSuc: null,
            correoSuc: null,
            paginaWebSuc: null,
            redSocialSuc: null,
            logoSuc: null,
            idDir: null,
          },
        },
      } as any);

      await autenticar(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.empleado?.idEmp).toBe(1);
      expect(mockReq.empleado?.cargo).toBe('ADMINISTRADOR');
    });
  });

  describe('autenticarCliente', () => {
    it('debe responder 401 si no hay token de cliente', async () => {
      await autenticarCliente(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('debe responder 401 si el cliente está desactivado', async () => {
      const token = emitirSesionCliente({ idCliente: 5 });
      mockReq.headers = { authorization: `Bearer ${token}` };

      jest.spyOn(prisma.cliente, 'findUnique').mockResolvedValue({
        idCliente: 5,
        nombreCliente: 'Inactivo',
        apellidoPatCliente: null,
        apellidoMatCliente: null,
        correoCliente: 'inactivo@tienda.com',
        fotoPerfil: null,
        estadoCliente: false,
        fechaRegistro: new Date(),
        ultimoAcceso: new Date(),
        googleSub: 'sub',
      } as any);

      await autenticarCliente(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debe adjuntar req.cliente y llamar a next si es válido', async () => {
      const token = emitirSesionCliente({ idCliente: 5 });
      mockReq.headers = { authorization: `Bearer ${token}` };

      jest.spyOn(prisma.cliente, 'findUnique').mockResolvedValue({
        idCliente: 5,
        nombreCliente: 'Cliente Activo',
        apellidoPatCliente: null,
        apellidoMatCliente: null,
        correoCliente: 'activo@tienda.com',
        fotoPerfil: null,
        estadoCliente: true,
        fechaRegistro: new Date(),
        ultimoAcceso: new Date(),
        googleSub: 'sub',
      } as any);

      await autenticarCliente(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.cliente?.idCliente).toBe(5);
    });
  });

  describe('autorizarRoles, soloAdministrador y rolesPos', () => {
    it('debe permitir acceso si el rol coincide', () => {
      mockReq.empleado = { cargo: 'ADMINISTRADOR' } as any;
      soloAdministrador(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('debe rechazar con 403 si el rol no coincide', () => {
      mockReq.empleado = { cargo: 'CAJERO' } as any;
      soloAdministrador(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('rolesPos debe permitir ADMINISTRADOR y CAJERO', () => {
      mockReq.empleado = { cargo: 'CAJERO' } as any;
      rolesPos(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
