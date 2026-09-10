import {
  dineroCentavos,
  eliminarUploadControlado,
  errorFuncional,
  formatearFechaVenta,
  formatearHoraVenta,
  idValido,
  numero,
  texto,
  textoNullable,
  uuidValido,
} from '../../src/utils/formatters';
import fs from 'fs';
import path from 'path';

describe('Formatters & Validation Utils', () => {
  describe('idValido', () => {
    it('debe retornar número entero positivo válido', () => {
      expect(idValido(1)).toBe(1);
      expect(idValido('42')).toBe(42);
      expect(idValido(999)).toBe(999);
    });

    it('debe retornar null para valores inválidos o negativos', () => {
      expect(idValido(0)).toBeNull();
      expect(idValido(-5)).toBeNull();
      expect(idValido(3.14)).toBeNull();
      expect(idValido('abc')).toBeNull();
      expect(idValido(null)).toBeNull();
      expect(idValido(undefined)).toBeNull();
      expect(idValido({})).toBeNull();
    });
  });

  describe('texto y textoNullable', () => {
    it('debe limpiar espacios en blanco', () => {
      expect(texto('  hola mundo  ')).toBe('hola mundo');
      expect(texto(123)).toBe('');
      expect(texto(null)).toBe('');
    });

    it('debe retornar null si la cadena queda vacía', () => {
      expect(textoNullable('   ')).toBeNull();
      expect(textoNullable(null)).toBeNull();
      expect(textoNullable('Producto')).toBe('Producto');
    });
  });

  describe('numero', () => {
    it('debe convertir números finitos válidos', () => {
      expect(numero(42.5)).toBe(42.5);
      expect(numero('100')).toBe(100);
      expect(numero('0')).toBe(0);
    });

    it('debe retornar fallback para valores no numéricos', () => {
      expect(numero('invalido', 10)).toBe(10);
      expect(numero(NaN, 5)).toBe(5);
      expect(numero(Infinity)).toBe(0);
    });
  });

  describe('dineroCentavos', () => {
    it('debe convertir montos en moneda a enteros en centavos con redondeo preciso', () => {
      expect(dineroCentavos(10.5)).toBe(1050);
      expect(dineroCentavos('19.99')).toBe(1999);
      expect(dineroCentavos(0)).toBe(0);
      expect(dineroCentavos('0.00')).toBe(0);
      expect(dineroCentavos(123.456)).toBe(12346);
    });

    it('debe retornar null para montos no finitos o inválidos', () => {
      expect(dineroCentavos('abc')).toBeNull();
      expect(dineroCentavos(null)).toBeNull();
      expect(dineroCentavos(undefined)).toBeNull();
      expect(dineroCentavos(NaN)).toBeNull();
    });
  });

  describe('uuidValido', () => {
    it('debe aceptar UUIDs v4 estándar en minúsculas o mayúsculas', () => {
      const uuid = '89f2d791-a986-4e3f-b4a2-29bd03867ccc';
      expect(uuidValido(uuid)).toBe(uuid);
      expect(uuidValido(uuid.toUpperCase())).toBe(uuid);
    });

    it('debe rechazar cadenas que no sean UUIDs válidos', () => {
      expect(uuidValido('12345')).toBeNull();
      expect(uuidValido('89f2d791-a986-4e3f-b4a2')).toBeNull();
      expect(uuidValido("1' OR '1'='1")).toBeNull();
      expect(uuidValido(null)).toBeNull();
    });
  });

  describe('formatearFechaVenta y formatearHoraVenta', () => {
    it('debe formatear fechas y horas correctamente', () => {
      const fecha = new Date('2026-08-29T18:47:16.983Z');
      expect(formatearFechaVenta(fecha)).toBe('2026-08-29');
      expect(formatearHoraVenta(fecha)).toBe('18:47:16');
      expect(formatearFechaVenta('2026-08-29T00:00:00.000Z')).toBe('2026-08-29');
      expect(formatearHoraVenta('12:30:00')).toBe('12:30:00');
    });

    it('debe retornar null si no hay valor', () => {
      expect(formatearFechaVenta(null)).toBeNull();
      expect(formatearHoraVenta(null)).toBeNull();
    });
  });

  describe('errorFuncional', () => {
    it('debe crear un Error con propiedad status', () => {
      const err = errorFuncional('Mensaje de prueba', 409);
      expect(err.message).toBe('Mensaje de prueba');
      expect(err.status).toBe(409);
    });

    it('debe usar 400 como status por defecto', () => {
      const err = errorFuncional('Error default');
      expect(err.status).toBe(400);
    });
  });

  describe('eliminarUploadControlado', () => {
    it('debe invocar fs.unlink si la ruta coincide con el prefijo', () => {
      const unlinkSpy = jest.spyOn(fs, 'unlink').mockImplementation((_p, cb: any) => cb(null));
      const testDir = path.resolve('/fake/uploads');
      eliminarUploadControlado('/fake/uploads/foto.jpg', testDir, '/fake/uploads/');
      expect(unlinkSpy).toHaveBeenCalled();
      unlinkSpy.mockRestore();
    });

    it('no debe hacer nada si la ruta no tiene el prefijo o es nula', () => {
      const unlinkSpy = jest.spyOn(fs, 'unlink').mockImplementation((_p, cb: any) => cb(null));
      eliminarUploadControlado(null, '/dir', '/prefijo/');
      eliminarUploadControlado('/otro/archivo.jpg', '/dir', '/prefijo/');
      expect(unlinkSpy).not.toHaveBeenCalled();
      unlinkSpy.mockRestore();
    });
  });
});
