import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import {
  API_BASE_URL,
  STORAGE_DRIVER,
  AUTH_SESSION_STORE,
  CLIENTE_SESSION_STORE,
  PRODUCTOS_SERVICE,
  CATALOGOS_SERVICE,
} from './tokens';
import { CartStorageService } from './cart-storage.service';
import { MemoryStorageDriver } from './storage/memory-storage.driver';
import { BaseSessionStore } from './session/base-session-store';
import { AuthSession } from '../models/auth';
import { ClienteAuthSession } from '../models/cliente-auth';
import { AuthInterceptor } from './auth.interceptor';
import { CatalogosService } from './catalogos.service';
import { ProductosService } from './productos.service';

describe('Dependency Inversion Principle (DIP) - Injection Tokens', () => {
  describe('CartStorageService with Inverted STORAGE_DRIVER', () => {
    it('debe permitir sobreescribir el STORAGE_DRIVER por un MemoryStorageDriver sin alterar CartStorageService', () => {
      const memoryDriver = new MemoryStorageDriver();

      TestBed.configureTestingModule({
        providers: [
          CartStorageService,
          { provide: STORAGE_DRIVER, useValue: memoryDriver },
        ],
      });

      const cartStorage = TestBed.inject(CartStorageService);
      expect(cartStorage).toBeTruthy();

      cartStorage.guardar([
        {
          id: 'dip-item-1',
          nombre: 'Producto Invertido',
          precioMostrado: 99.99,
          cantidad: 1,
          stockConocido: 10,
          imagen: null,
          presentacion: null,
        },
      ]);

      expect(memoryDriver.getItem('tienda.cliente.carrito')).toBeTruthy();
      expect(cartStorage.leer().length).toBe(1);
      expect(cartStorage.leer()[0].nombre).toBe('Producto Invertido');
    });
  });

  describe('API_BASE_URL Token Inversion', () => {
    it('CatalogosService debe usar la URL proporcionada mediante API_BASE_URL token', () => {
      const customApiUrl = 'https://custom-aws-api.execute-api.us-east-1.amazonaws.com/prod';

      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          CatalogosService,
          { provide: API_BASE_URL, useValue: customApiUrl },
        ],
      });

      const catalogos = TestBed.inject(CatalogosService);
      const httpMock = TestBed.inject(HttpTestingController);

      catalogos.getMarcas().subscribe();

      const req = httpMock.expectOne(`${customApiUrl}/marca`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
      httpMock.verify();
    });

    it('ProductosService debe construir sus rutas a partir del token API_BASE_URL', () => {
      const customApiUrl = 'https://custom-aws-api.execute-api.us-east-1.amazonaws.com/prod';

      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          ProductosService,
          { provide: API_BASE_URL, useValue: customApiUrl },
        ],
      });

      const productos = TestBed.inject(ProductosService);
      const httpMock = TestBed.inject(HttpTestingController);

      productos.getProductos().subscribe();

      const req = httpMock.expectOne(`${customApiUrl}/productos`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
      httpMock.verify();
    });
  });

  describe('AuthInterceptor with Inverted Session Stores', () => {
    class MockAuthStore extends BaseSessionStore<AuthSession> {
      constructor() {
        super('mock.auth', new MemoryStorageDriver());
      }
    }

    class MockClienteStore extends BaseSessionStore<ClienteAuthSession> {
      constructor() {
        super('mock.cliente', new MemoryStorageDriver());
      }
    }

    it('AuthInterceptor debe inyectar el Bearer token provisto por la abstracción de sesión', () => {
      const mockAuth = new MockAuthStore();
      mockAuth.guardar({
        token: 'dip-bearer-token',
        empleado: {
          id: '1',
          nombre: 'Admin',
          nombreEmp: 'Admin',
          apellidoPatEmp: null,
          apellidoMatEmp: null,
          correo: 'admin@tienda.com',
          telefono: null,
          fechaIngreso: null,
          fotoPerfil: null,
          cargoId: '1',
          cargo: 'ADMINISTRADOR',
          sucursalId: '1',
          nombreSuc: null,
          estadoEmp: true,
        },
      });

      const apiUrl = 'https://api.tienda.com';

      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(withInterceptorsFromDi()),
          provideHttpClientTesting(),
          { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
          { provide: API_BASE_URL, useValue: apiUrl },
          { provide: AUTH_SESSION_STORE, useValue: mockAuth },
          { provide: CLIENTE_SESSION_STORE, useClass: MockClienteStore },
        ],
      });

      const http = TestBed.inject(HttpClient);
      const httpMock = TestBed.inject(HttpTestingController);

      http.get(`${apiUrl}/caja/estado`).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/caja/estado`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer dip-bearer-token');
      req.flush({});
      httpMock.verify();
    });
  });

  describe('Tokens Default Factory Resolution', () => {
    it('debe instanciar los servicios predeterminados cuando no se especifican overrides', () => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });

      const apiUrl = TestBed.inject(API_BASE_URL);
      const storage = TestBed.inject(STORAGE_DRIVER);
      const auth = TestBed.inject(AUTH_SESSION_STORE);
      const cliente = TestBed.inject(CLIENTE_SESSION_STORE);
      const productos = TestBed.inject(PRODUCTOS_SERVICE);
      const catalogos = TestBed.inject(CATALOGOS_SERVICE);

      expect(typeof apiUrl).toBe('string');
      expect(storage).toBeTruthy();
      expect(auth).toBeTruthy();
      expect(cliente).toBeTruthy();
      expect(productos).toBeTruthy();
      expect(catalogos).toBeTruthy();
    });
  });
});
