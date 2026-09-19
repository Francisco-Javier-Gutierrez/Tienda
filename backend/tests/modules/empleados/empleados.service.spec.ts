import { empleadosService } from '../../../src/modules/empleados/empleados.service';
import { empleadoRepository } from '../../../src/db/repositories/empleado.repository';

describe('EmpleadosService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listar', () => {
    it('debe retornar lista de empleados con formato seguro', async () => {
      jest.spyOn(empleadoRepository, 'listEmpleados').mockResolvedValue([
        {
          idEmp: 1,
          idSuc: 1,
          idCargo: 1,
          nombreEmp: 'Admin',
          apellidoPatEmp: 'Sistema',
          apellidoMatEmp: null,
          correoEmp: 'admin@tienda.com',
          contrasenaHash: 'hash',
          telefono: '11223344',
          fotoPerfil: null,
          cargoNombre: 'ADMINISTRADOR',
          cargo: 'ADMINISTRADOR',
          nombreSuc: 'Central',
          estadoEmp: true,
        },
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

    it('debe crear el empleado exitosamente', async () => {
      jest.spyOn(empleadoRepository, 'createEmpleado').mockResolvedValue({
        idEmp: 10,
        idSuc: 1,
        idCargo: 2,
        nombreEmp: 'Pedro',
        apellidoPatEmp: 'Gómez',
        apellidoMatEmp: '',
        correoEmp: 'pedro@tienda.com',
        contrasenaHash: 'hash',
        cargo: 'CAJERO',
        cargoNombre: 'CAJERO',
        nombreSuc: 'Doña paty',
        estadoEmp: true,
      });

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

      jest.spyOn(empleadoRepository, 'updateEmpleado').mockResolvedValueOnce(null);
      await expect(
        empleadosService.actualizar(1, { nombre: 'A', correo: 'a@a.com', idCargo: 1 }),
      ).rejects.toMatchObject({ status: 404 });

      // Éxito con password y fechaIngreso
      jest.spyOn(empleadoRepository, 'updateEmpleado').mockResolvedValue({
        idEmp: 1,
        idSuc: 1,
        idCargo: 1,
        nombreEmp: 'Juan',
        apellidoPatEmp: 'Perez',
        apellidoMatEmp: '',
        correoEmp: 'juan@tienda.com',
        contrasenaHash: 'hash',
        cargo: 'ADMINISTRADOR',
        cargoNombre: 'ADMINISTRADOR',
        nombreSuc: 'Doña paty',
        estadoEmp: true,
      });

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
      jest.spyOn(empleadoRepository, 'updateEmpleado').mockResolvedValue({
        idEmp: 2,
        idSuc: 1,
        idCargo: 2,
        nombreEmp: 'Cajero',
        apellidoPatEmp: 'Tienda',
        apellidoMatEmp: '',
        correoEmp: 'cajero@tienda.com',
        contrasenaHash: 'hash',
        cargo: 'CAJERO',
        cargoNombre: 'CAJERO',
        nombreSuc: 'Doña paty',
        estadoEmp: false,
      });

      const actualizado = await empleadosService.cambiarEstado(2, 1, false);
      expect(actualizado?.estado).toBe(false);
    });
  });
});
