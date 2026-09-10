import {
  configuracionService,
  validarConfiguracionTransferencia,
} from '../../../src/modules/configuracion/configuracion.service';
import { pedidosService } from '../../../src/modules/pedidos/pedidos.service';
import { prisma } from '../../../src/config/prisma';

describe('ConfiguracionService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validarConfiguracionTransferencia', () => {
    it('debe validar configuración completa con CLABE de 18 dígitos', () => {
      const validacion = validarConfiguracionTransferencia({
        activo: true,
        banco: 'Santander',
        titular: 'Empresa SA de CV',
        clabe: '014180001234567890',
        numeroCuenta: '123456789',
        instrucciones: 'Favor de poner el folio en concepto',
      });

      expect(validacion.error).toBeUndefined();
      expect(validacion.valores?.banco).toBe('Santander');
      expect(validacion.valores?.clabe).toBe('014180001234567890');
    });

    it('valida límites de caracteres y tipos', () => {
      expect(validarConfiguracionTransferencia({ activo: 'invalido' }).error).toBe(
        'El estado de transferencias no es válido.',
      );
      expect(
        validarConfiguracionTransferencia({ activo: true, banco: 'a'.repeat(105) }).error,
      ).toBe('El banco no puede superar 100 caracteres.');
      expect(
        validarConfiguracionTransferencia({ activo: true, titular: 'a'.repeat(155) }).error,
      ).toBe('El titular no puede superar 150 caracteres.');
      expect(
        validarConfiguracionTransferencia({ activo: true, clabe: '123' }).error,
      ).toBe('La CLABE debe contener exactamente 18 dígitos.');
      expect(
        validarConfiguracionTransferencia({ activo: true, numeroCuenta: 'a'.repeat(55) }).error,
      ).toBe('El número de cuenta no puede superar 50 caracteres.');
      expect(
        validarConfiguracionTransferencia({ activo: true, instrucciones: 'a'.repeat(1005) }).error,
      ).toBe('Las instrucciones no pueden superar 1000 caracteres.');
      expect(
        validarConfiguracionTransferencia({ activo: true, banco: '', titular: '' }).error,
      ).toBe('Banco y titular son obligatorios al habilitar transferencias.');
      expect(
        validarConfiguracionTransferencia({ activo: true, banco: 'B', titular: 'T' }).error,
      ).toBe('Configura una CLABE o un número de cuenta.');
    });
  });

  describe('Consultas y Actualización', () => {
    it('obtenerAdmin debe retornar configuración formateada', async () => {
      jest.spyOn(prisma.configuracionTransferencia, 'findUnique').mockResolvedValue({
        idConfiguracion: 1,
        idSuc: 1,
        banco: 'BBVA',
        titular: 'Admin Tienda',
        clabe: '012180001234567890',
        numeroCuenta: null,
        instrucciones: 'Instrucciones',
        activo: true,
        fechaActualizacion: new Date(),
      });

      const conf = await configuracionService.obtenerAdmin(1);
      expect((conf as any)?.banco).toBe('BBVA');
      expect((conf as any)?.activo).toBe(true);
    });

    it('actualizarAdmin debe rechazar error de validación o hacer upsert', async () => {
      await expect(configuracionService.actualizarAdmin(1, { activo: 'invalido' })).rejects.toMatchObject({
        status: 400,
      });

      jest.spyOn(prisma.configuracionTransferencia, 'upsert').mockResolvedValue({
        idConfiguracion: 1,
        idSuc: 1,
        banco: 'Santander',
        titular: 'Tienda',
        clabe: '014180001234567890',
        numeroCuenta: null,
        instrucciones: null,
        activo: true,
        fechaActualizacion: new Date(),
      });

      const res = await configuracionService.actualizarAdmin(1, {
        activo: true,
        banco: 'Santander',
        titular: 'Tienda',
        clabe: '014180001234567890',
      });
      expect((res as any)?.banco).toBe('Santander');
    });

    it('obtenerCliente debe consultar sucursal y configuracion activa', async () => {
      jest.spyOn(pedidosService, 'obtenerSucursalDisponibleCliente').mockResolvedValue(1);
      jest.spyOn(pedidosService, 'obtenerConfiguracionTransferencia').mockResolvedValue({
        idConfiguracion: 1,
        idSuc: 1,
        banco: 'BBVA',
        titular: 'Tienda',
        clabe: '012180001234567890',
        numeroCuenta: null,
        instrucciones: null,
        activo: true,
      } as any);

      const clienteConf = await configuracionService.obtenerCliente();
      expect(clienteConf?.banco).toBe('BBVA');
    });
  });
});
