import {
  clienteSeguro,
  comparePassword,
  emitirSesionCliente,
  emitirSesionEmpleado,
  empleadoSeguro,
  hashPassword,
  verificarToken,
} from '../../src/utils/security';
import { env } from '../../src/config/env';

describe('Security & Auth Utilities', () => {
  describe('hashPassword y comparePassword', () => {
    it('debe generar un hash válido y verificarlo correctamente', async () => {
      const password = 'PasswordSeguro123!';
      const hash = await hashPassword(password);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      const coinciden = await comparePassword(password, hash);
      expect(coinciden).toBe(true);

      const noCoinciden = await comparePassword('PasswordIncorrecto', hash);
      expect(noCoinciden).toBe(false);
    });
  });

  describe('Tokens JWT de Empleado y Cliente', () => {
    it('debe emitir y verificar un token de Empleado', () => {
      const token = emitirSesionEmpleado({ idEmp: 7 });
      expect(typeof token).toBe('string');

      const payload = verificarToken(token);
      expect(payload.sub).toBe('7');
      expect(payload.tipo).toBe('EMPLEADO');
    });

    it('debe emitir y verificar un token de Cliente', () => {
      const token = emitirSesionCliente({ idCliente: 42 });
      expect(typeof token).toBe('string');

      const payload = verificarToken(token);
      expect(payload.sub).toBe('42');
      expect(payload.tipo).toBe('CLIENTE');
    });

    it('debe fallar al verificar un token inválido o manipulado', () => {
      expect(() => verificarToken('token.falso.invalido')).toThrow();
    });
  });

  describe('empleadoSeguro y clienteSeguro', () => {
    it('debe estructurar y sanitizar datos de empleado correctamente', () => {
      const raw = {
        idEmp: 1,
        nombreEmp: 'Carlos',
        apellidoPatEmp: 'López',
        apellidoMatEmp: 'García',
        correoEmp: 'carlos@empresa.com',
        telefono: '5551234567',
        fechaIngreso: new Date('2024-01-15'),
        fotoPerfil: 'https://s3/foto.jpg',
        contrasenaHash: '$2a$12$hashPrivadoOculto',
        googleSub: 'sub123',
        idCargo: 2,
        estadoEmp: true,
        cargo: {
          nombreCargo: 'CAJERO',
          idSuc: 1,
          sucursal: { nombreSuc: 'Sucursal Central' },
        },
      };

      const seguro = empleadoSeguro(raw);
      expect(seguro.idEmp).toBe(1);
      expect(seguro.nombre).toBe('Carlos López García');
      expect(seguro.correo).toBe('carlos@empresa.com');
      expect(seguro.cargo).toBe('CAJERO');
      expect(seguro.idSuc).toBe(1);
      expect(seguro.nombreSuc).toBe('Sucursal Central');
      expect((seguro as any).contrasenaHash).toBeUndefined();
      expect((seguro as any).googleSub).toBeUndefined();
    });

    it('debe estructurar y sanitizar datos de cliente correctamente', () => {
      const raw = {
        idCliente: 10,
        nombreCliente: 'María',
        apellidoPatCliente: 'Pérez',
        apellidoMatCliente: null,
        correoCliente: 'maria@cliente.com',
        fotoPerfil: null,
        estadoCliente: true,
        fechaRegistro: new Date('2025-06-01'),
        ultimoAcceso: new Date('2026-08-29'),
        googleSub: 'googleSubCliente123',
      };

      const seguro = clienteSeguro(raw);
      expect(seguro.idCliente).toBe(10);
      expect(seguro.nombre).toBe('María');
      expect(seguro.apellidoPat).toBe('Pérez');
      expect(seguro.apellidoMat).toBeNull();
      expect(seguro.correo).toBe('maria@cliente.com');
      expect(seguro.rol).toBe('CLIENTE');
      expect((seguro as any).googleSub).toBeUndefined();
    });
  });
});
