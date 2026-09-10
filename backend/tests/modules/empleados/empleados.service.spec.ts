import { empleadosService } from '../../../src/modules/empleados/empleados.service';
import { prisma } from '../../../src/config/prisma';

describe('EmpleadosService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listar', () => {
    it('debe retornar lista de empleados con formato seguro', async () => {
      jest.spyOn(prisma.empleado, 'findMany').mockResolvedValue([
        {
          idEmp: 1,
          nombreEmp: 'Admin',
          apellidoPatEmp: 'Sistema',
          apellidoMatEmp: null,
          correoEmp: 'admin@tienda.com',
          telefono: '11223344',
          fechaIngreso: new Date(),
          fotoPerfil: null,
          idCargo: 1,
          estadoEmp: true,
          cargo: { nombreCargo: 'ADMINISTRADOR', idSuc: 1, sucursal: { nombreSuc: 'Central' } },
        } as any,
      ]);

      const lista = await empleadosService.listar();
      expect(lista.length).toBe(1);
      expect(lista[0]?.nombreCompleto).toBe('Admin Sistema');
      expect(lista[0]?.cargo).toBe('ADMINISTRADOR');
    });
  });

  describe('crear', () => {
    it('debe rechazar si falta nombre, correo o cargo', async () => {
      await expect(
        empleadosService.crear({ nombre: '', correo: 'valido@correo.com', idCargo: 1 }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'Nombre, correo y cargo válidos son obligatorios',
      });
    });

    it('debe rechazar contraseña menor a 8 caracteres', async () => {
      await expect(
        empleadosService.crear({
          nombre: 'Juan',
          correo: 'juan@correo.com',
          idCargo: 2,
          password: '123',
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'La contraseña debe tener al menos 8 caracteres',
      });
    });

    it('debe rechazar cargo no autorizado', async () => {
      jest.spyOn(prisma.cargo, 'findFirst').mockResolvedValue(null);

      await expect(
        empleadosService.crear({
          nombre: 'Juan',
          correo: 'juan@correo.com',
          idCargo: 99,
          password: 'password123',
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'El cargo no es válido',
      });
    });

    it('debe crear el empleado exitosamente', async () => {
      jest.spyOn(prisma.cargo, 'findFirst').mockResolvedValue({
        idCargo: 2,
        nombreCargo: 'CAJERO',
      } as any);

      jest.spyOn(prisma.empleado, 'create').mockResolvedValue({
        idEmp: 10,
        nombreEmp: 'Pedro',
        apellidoPatEmp: 'Gómez',
        apellidoMatEmp: null,
        correoEmp: 'pedro@tienda.com',
        contrasenaHash: 'hash',
        estadoEmp: true,
        telefono: null,
        fechaIngreso: new Date(),
        fotoPerfil: null,
        idCargo: 2,
        cargo: { nombreCargo: 'CAJERO', idSuc: 1, sucursal: { nombreSuc: 'Central' } },
      } as any);

      const nuevo = await empleadosService.crear({
        nombre: 'Pedro',
        apellidoPat: 'Gómez',
        correo: 'pedro@tienda.com',
        password: 'password123',
        idCargo: 2,
      });

      expect(nuevo?.id).toBeDefined();
      expect(nuevo?.nombreCompleto).toBe('Pedro Gómez');
      expect(nuevo?.cargo).toBe('CAJERO');
    });
  });

  describe('actualizar', () => {
    it('valida datos obligatorios, contraseña y cargo', async () => {
      await expect(empleadosService.actualizar(0, { nombre: '' })).rejects.toMatchObject({ status: 400 });
      await expect(
        empleadosService.actualizar(1, { nombre: 'A', correo: 'a@a.com', idCargo: 1, password: '123' }),
      ).rejects.toMatchObject({ status: 400 });

      jest.spyOn(prisma.empleado, 'findUnique').mockResolvedValueOnce(null);
      await expect(
        empleadosService.actualizar(1, { nombre: 'A', correo: 'a@a.com', idCargo: 1 }),
      ).rejects.toMatchObject({ status: 404 });

      jest.spyOn(prisma.empleado, 'findUnique').mockResolvedValue({ idEmp: 1 } as any);
      jest.spyOn(prisma.cargo, 'findFirst').mockResolvedValueOnce(null);
      await expect(
        empleadosService.actualizar(1, { nombre: 'A', correo: 'a@a.com', idCargo: 99 }),
      ).rejects.toMatchObject({ status: 400 });

      // Éxito con password y fechaIngreso
      jest.spyOn(prisma.cargo, 'findFirst').mockResolvedValue({ idCargo: 1 } as any);
      jest.spyOn(prisma.empleado, 'update').mockResolvedValue({
        idEmp: 1,
        nombreEmp: 'Juan',
        apellidoPatEmp: 'Perez',
        apellidoMatEmp: null,
        correoEmp: 'juan@tienda.com',
        idCargo: 1,
        cargo: { nombreCargo: 'ADMINISTRADOR', idSuc: 1, sucursal: { nombreSuc: 'Central' } },
      } as any);

      const act = await empleadosService.actualizar(1, {
        nombre: 'Juan',
        correo: 'juan@tienda.com',
        idCargo: 1,
        password: 'nuevapassword123',
        fechaIngreso: '2026-01-01',
      });
      expect(act?.id).toBeDefined();
    });
  });

  describe('cambiarEstado', () => {
    it('debe impedir que el usuario desactive su propia sesión', async () => {
      await expect(empleadosService.cambiarEstado(1, 1, false)).rejects.toMatchObject({
        status: 400,
        message: 'No puedes desactivar tu propia sesión',
      });
    });

    it('debe actualizar el estado de otro empleado', async () => {
      jest.spyOn(prisma.empleado, 'update').mockResolvedValue({
        idEmp: 2,
        nombreEmp: 'Cajero',
        correoEmp: 'cajero@tienda.com',
        estadoEmp: false,
        idCargo: 2,
        cargo: { nombreCargo: 'CAJERO', idSuc: 1, sucursal: { nombreSuc: 'Central' } },
      } as any);

      const actualizado = await empleadosService.cambiarEstado(2, 1, false);
      expect(actualizado?.estado).toBe(false);
    });
  });
});
