import { authService } from '../../../src/modules/auth/auth.service';
import { prisma } from '../../../src/config/prisma';
import { env } from '../../../src/config/env';
import bcrypt from 'bcryptjs';
import { googleClient } from '../../../src/config/google';

describe('AuthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loginEmpleado', () => {
    it('debe rechazar campos vacíos con 400', async () => {
      await expect(authService.loginEmpleado('', '')).rejects.toMatchObject({
        status: 400,
        message: 'Correo y contraseña son obligatorios',
      });
    });

    it('debe rechazar credenciales inválidas con 401', async () => {
      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValue(null);
      await expect(
        authService.loginEmpleado('noexiste@correo.com', 'password123'),
      ).rejects.toMatchObject({
        status: 401,
        message: 'Correo o contraseña incorrectos',
      });
    });

    it('debe rechazar si la contraseña no coincide con el hash', async () => {
      const hash = await bcrypt.hash('CorrectPassword123', 10);
      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValue({
        idEmp: 1,
        correoEmp: 'cajero@tienda.com',
        contrasenaHash: hash,
        estadoEmp: true,
        cargo: { nombreCargo: 'CAJERO', idSuc: 1, sucursal: { nombreSuc: 'Sucursal 1' } },
      } as any);

      await expect(
        authService.loginEmpleado('cajero@tienda.com', 'WrongPassword'),
      ).rejects.toMatchObject({
        status: 401,
        message: 'Correo o contraseña incorrectos',
      });
    });

    it('debe rechazar cuenta desactivada con 403', async () => {
      const hash = await bcrypt.hash('CorrectPassword123', 10);
      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValue({
        idEmp: 1,
        correoEmp: 'cajero@tienda.com',
        contrasenaHash: hash,
        estadoEmp: false,
        cargo: { nombreCargo: 'CAJERO', idSuc: 1, sucursal: { nombreSuc: 'Sucursal 1' } },
      } as any);

      await expect(
        authService.loginEmpleado('cajero@tienda.com', 'CorrectPassword123'),
      ).rejects.toMatchObject({
        status: 403,
        message: 'Tu cuenta está desactivada',
      });
    });

    it('debe rechazar cargo no autorizado con 403', async () => {
      const hash = await bcrypt.hash('CorrectPassword123', 10);
      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValue({
        idEmp: 1,
        correoEmp: 'limpieza@tienda.com',
        contrasenaHash: hash,
        estadoEmp: true,
        cargo: { nombreCargo: 'LIMPIEZA', idSuc: 1 },
      } as any);

      await expect(
        authService.loginEmpleado('limpieza@tienda.com', 'CorrectPassword123'),
      ).rejects.toMatchObject({
        status: 403,
        message: 'Tu cuenta no tiene un cargo autorizado',
      });
    });

    it('debe retornar token y datos seguros en login exitoso', async () => {
      const hash = await bcrypt.hash('CorrectPassword123', 10);
      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValue({
        idEmp: 1,
        nombreEmp: 'Juan',
        apellidoPatEmp: 'Pérez',
        apellidoMatEmp: null,
        correoEmp: 'juan@tienda.com',
        contrasenaHash: hash,
        estadoEmp: true,
        idCargo: 1,
        cargo: {
          idCargo: 1,
          nombreCargo: 'ADMINISTRADOR',
          idSuc: 1,
          sucursal: { nombreSuc: 'Central' },
        },
      } as any);

      const result = await authService.loginEmpleado('juan@tienda.com', 'CorrectPassword123');
      expect(result.token).toBeDefined();
      expect(result.empleado.nombre).toBe('Juan Pérez');
      expect(result.empleado.cargo).toBe('ADMINISTRADOR');
    });
  });

  describe('googleAuthEmpleado', () => {
    it('debe rechazar token de Google faltante', async () => {
      await expect(authService.googleAuthEmpleado('')).rejects.toMatchObject({
        status: 400,
      });
    });

    it('debe validar configuración de GOOGLE_CLIENT_ID y payload', async () => {
      const origId = env.GOOGLE_CLIENT_ID;
      (env as any).GOOGLE_CLIENT_ID = '';
      await expect(authService.googleAuthEmpleado('tok')).rejects.toMatchObject({ status: 503 });
      (env as any).GOOGLE_CLIENT_ID = origId || 'test-client-id';

      jest.spyOn(googleClient, 'verifyIdToken').mockImplementation((() =>
        Promise.resolve({
          getPayload: () => ({ sub: '123', email: 'a@a.com', email_verified: false }),
        })) as any);
      await expect(authService.googleAuthEmpleado('tok')).rejects.toMatchObject({ status: 401 });
    });

    it('debe rechazar empleado no encontrado, desactivado, sin cargo o con sub mismatch', async () => {
      (env as any).GOOGLE_CLIENT_ID = 'test-client-id';
      jest.spyOn(googleClient, 'verifyIdToken').mockImplementation((() =>
        Promise.resolve({
          getPayload: () => ({ sub: 'google-sub-1', email: 'emp@tienda.com', email_verified: true }),
        })) as any);

      // No encontrado
      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValueOnce(null);
      await expect(authService.googleAuthEmpleado('tok')).rejects.toMatchObject({ status: 403 });

      // Desactivado
      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValueOnce({
        idEmp: 1,
        estadoEmp: false,
      } as any);
      await expect(authService.googleAuthEmpleado('tok')).rejects.toMatchObject({ status: 403, message: 'Tu cuenta está desactivada' });

      // Sin cargo
      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValueOnce({
        idEmp: 1,
        estadoEmp: true,
        cargo: { nombreCargo: 'OTRO' },
      } as any);
      await expect(authService.googleAuthEmpleado('tok')).rejects.toMatchObject({ status: 403, message: 'Tu cuenta no tiene un cargo autorizado' });

      // Sub mismatch
      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValueOnce({
        idEmp: 1,
        estadoEmp: true,
        googleSub: 'otro-sub',
        cargo: { nombreCargo: 'ADMINISTRADOR' },
      } as any);
      await expect(authService.googleAuthEmpleado('tok')).rejects.toMatchObject({ status: 403, message: 'Esta cuenta Google no coincide con la cuenta vinculada' });
    });

    it('debe autenticar exitosamente y vincular googleSub si no estaba vinculado', async () => {
      (env as any).GOOGLE_CLIENT_ID = 'test-client-id';
      jest.spyOn(googleClient, 'verifyIdToken').mockImplementation((() =>
        Promise.resolve({
          getPayload: () => ({
            sub: 'google-sub-999',
            email: 'admin@tienda.com',
            email_verified: true,
            name: 'Admin Google',
          }),
        })) as any);

      jest.spyOn(prisma.empleado, 'findFirst').mockResolvedValue({
        idEmp: 2,
        nombreEmp: 'Admin',
        correoEmp: 'admin@tienda.com',
        estadoEmp: true,
        googleSub: null,
        idCargo: 1,
        cargo: { nombreCargo: 'ADMINISTRADOR', idSuc: 1, sucursal: { nombreSuc: 'Central' } },
      } as any);

      jest.spyOn(prisma.empleado, 'update').mockResolvedValue({
        idEmp: 2,
        nombreEmp: 'Admin',
        correoEmp: 'admin@tienda.com',
        estadoEmp: true,
        googleSub: 'google-sub-999',
        idCargo: 1,
        cargo: { nombreCargo: 'ADMINISTRADOR', idSuc: 1, sucursal: { nombreSuc: 'Central' } },
      } as any);

      const result = await authService.googleAuthEmpleado('fake-id-token');
      expect(result.token).toBeDefined();
      expect(result.empleado.idEmp).toBe(2);
    });
  });

  describe('googleAuthCliente y resolverClienteGoogle', () => {
    it('debe rechazar si falta token o si Google no está configurado', async () => {
      await expect(authService.googleAuthCliente('')).rejects.toMatchObject({ status: 400 });

      const origId = env.GOOGLE_CLIENT_ID;
      (env as any).GOOGLE_CLIENT_ID = '';
      await expect(authService.googleAuthCliente('tok')).rejects.toMatchObject({ status: 503 });
      (env as any).GOOGLE_CLIENT_ID = origId || 'test-client-id';

      jest.spyOn(googleClient, 'verifyIdToken').mockImplementation((() =>
        Promise.resolve({
          getPayload: () => ({ sub: '123', email: 'a@a.com', email_verified: false }),
        })) as any);
      await expect(authService.googleAuthCliente('tok')).rejects.toMatchObject({ status: 401 });
    });

    it('debe rechazar si la cuenta de cliente está desactivada o tiene sub mismatch', async () => {
      jest.spyOn(googleClient, 'verifyIdToken').mockImplementation((() =>
        Promise.resolve({
          getPayload: () => ({
            sub: 'sub-cli-1',
            email: 'cli@tienda.com',
            email_verified: true,
          }),
        })) as any);

      // Sub mismatch
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          cliente: {
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn().mockResolvedValue({ idCliente: 1, googleSub: 'diferente' }),
          },
        });
      });
      await expect(authService.googleAuthCliente('tok')).rejects.toMatchObject({ status: 403 });

      // Desactivado
      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => {
        return cb({
          cliente: {
            findUnique: jest.fn().mockResolvedValue({ idCliente: 1, estadoCliente: false }),
          },
        });
      });
      await expect(authService.googleAuthCliente('tok')).rejects.toMatchObject({ status: 403, message: 'Tu cuenta de cliente está desactivada' });
    });

    it('debe autenticar o registrar automáticamente cliente mediante Google', async () => {
      jest.spyOn(googleClient, 'verifyIdToken').mockImplementation((() =>
        Promise.resolve({
          getPayload: () => ({
            sub: 'google-sub-cliente-1',
            email: 'cliente.nuevo@gmail.com',
            email_verified: true,
            name: 'Ana García',
            given_name: 'Ana',
            family_name: 'García',
            picture: 'https://lh3.google/photo.jpg',
          }),
        })) as any);

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          cliente: {
            findUnique: jest.fn().mockResolvedValue(null),
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              idCliente: 100,
              nombreCliente: 'Ana',
              apellidoPatCliente: 'García',
              correoCliente: 'cliente.nuevo@gmail.com',
              googleSub: 'google-sub-cliente-1',
              fotoPerfil: 'https://lh3.google/photo.jpg',
              estadoCliente: true,
              fechaRegistro: new Date(),
              ultimoAcceso: new Date(),
            }),
            update: jest.fn(),
          },
        });
      });

      const result = await authService.googleAuthCliente('fake-client-token');
      expect(result.token).toBeDefined();
      expect(result.cliente.idCliente).toBe(100);
      expect(result.cliente.nombre).toBe('Ana');
      expect(result.cliente.correo).toBe('cliente.nuevo@gmail.com');
    });

    it('debe actualizar cliente existente encontrado por googleSub', async () => {
      jest.spyOn(googleClient, 'verifyIdToken').mockImplementation((() =>
        Promise.resolve({
          getPayload: () => ({
            sub: 'google-sub-cliente-1',
            email: 'cliente.existente@gmail.com',
            email_verified: true,
            name: 'Ana',
          }),
        })) as any);

      jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          cliente: {
            findUnique: jest.fn().mockResolvedValue({
              idCliente: 100,
              nombreCliente: 'Ana',
              correoCliente: 'cliente.existente@gmail.com',
              googleSub: 'google-sub-cliente-1',
              estadoCliente: true,
            }),
            update: jest.fn().mockResolvedValue({
              idCliente: 100,
              nombreCliente: 'Ana',
              correoCliente: 'cliente.existente@gmail.com',
              googleSub: 'google-sub-cliente-1',
              estadoCliente: true,
            }),
          },
        });
      });

      const result = await authService.googleAuthCliente('fake-client-token');
      expect(result.token).toBeDefined();
      expect(result.cliente.idCliente).toBe(100);
    });
  });
});
