import { TestBed } from '@angular/core/testing';
import { StorageDriver } from '../storage/storage-driver.interface';
import { LocalStorageDriver } from '../storage/local-storage.driver';
import { SessionStorageDriver } from '../storage/session-storage.driver';
import { MemoryStorageDriver } from '../storage/memory-storage.driver';
import { BaseSessionStore, SessionPrincipal } from './base-session-store';
import { AuthSessionStore } from '../auth-session.service';
import { ClienteSessionStore } from '../cliente-session.service';
import { AuthSession } from '../../models/auth';

describe('Liskov Substitution Principle (LSP) - Storage & Session Stores', () => {
  describe('StorageDriver Subtypes Substitutability', () => {
    const drivers: Array<{ name: string; create: () => StorageDriver }> = [
      { name: 'MemoryStorageDriver', create: () => new MemoryStorageDriver() },
      { name: 'LocalStorageDriver', create: () => new LocalStorageDriver() },
      { name: 'SessionStorageDriver', create: () => new SessionStorageDriver() },
    ];

    drivers.forEach(({ name, create }) => {
      describe(`${name} como sustituto de StorageDriver`, () => {
        let driver: StorageDriver;
        const testKey = 'test.lsp.key';

        beforeEach(() => {
          driver = create();
          driver.clear();
        });

        afterEach(() => {
          driver.clear();
        });

        it('debe retornar null cuando una clave no existe', () => {
          expect(driver.getItem('clave_inexistente')).toBeNull();
        });

        it('debe guardar y recuperar valores consistentes', () => {
          driver.setItem(testKey, 'valor-prueba');
          expect(driver.getItem(testKey)).toBe('valor-prueba');
        });

        it('debe eliminar valores existentes', () => {
          driver.setItem(testKey, 'valor-prueba');
          expect(driver.getItem(testKey)).toBe('valor-prueba');

          driver.removeItem(testKey);
          expect(driver.getItem(testKey)).toBeNull();
        });

        it('debe limpiar todo el almacenamiento', () => {
          driver.setItem('k1', 'v1');
          driver.setItem('k2', 'v2');

          driver.clear();
          expect(driver.getItem('k1')).toBeNull();
          expect(driver.getItem('k2')).toBeNull();
        });
      });
    });
  });

  describe('BaseSessionStore Subtypes Substitutability', () => {
    // Implementación en memoria sustituible para pruebas o entornos aislados
    class MemorySessionStore<T extends SessionPrincipal> extends BaseSessionStore<T> {
      constructor(clave: string) {
        super(clave, new MemoryStorageDriver());
      }
    }

    it('AuthSessionStore debe heredar y ser sustituible como BaseSessionStore', () => {
      TestBed.configureTestingModule({
        providers: [AuthSessionStore, SessionStorageDriver],
      });
      const store: BaseSessionStore<AuthSession> = TestBed.inject(AuthSessionStore);

      expect(store).toBeInstanceOf(BaseSessionStore);
      expect(store.sesion).toBeNull();
      expect(store.token).toBeNull();

      const testSession: AuthSession = {
        token: 'jwt-token-123',
        empleado: {
          id: '1',
          correo: 'admin@tienda.com',
          nombre: 'Admin',
          nombreEmp: 'Admin',
          apellidoPatEmp: 'Test',
          apellidoMatEmp: null,
          cargo: 'ADMINISTRADOR',
          cargoId: '1',
          sucursalId: '1',
          nombreSuc: 'Central',
          telefono: null,
          fechaIngreso: null,
          fotoPerfil: null,
          estadoEmp: true,
        },
      };

      store.guardar(testSession);
      expect(store.sesion).toEqual(testSession);
      expect(store.token).toBe('jwt-token-123');

      store.limpiar();
      expect(store.sesion).toBeNull();
      expect(store.token).toBeNull();
    });

    it('MemorySessionStore debe sustituir a cualquier sesion persistente sin alterar el contrato', () => {
      const store: BaseSessionStore<{ token: string; usuario: string }> = new MemorySessionStore('test.mock.session');

      expect(store.sesion).toBeNull();
      expect(store.token).toBeNull();

      store.guardar({ token: 'mock-token-xyz', usuario: 'mock-user' });
      expect(store.token).toBe('mock-token-xyz');
      expect(store.sesion?.usuario).toBe('mock-user');

      store.limpiar();
      expect(store.sesion).toBeNull();
      expect(store.token).toBeNull();
    });
  });
});
