import { TestBed } from '@angular/core/testing';
import { SqliteDatabaseService } from './sqlite-database.service';
import { SqliteSyncQueueRepository } from './sqlite-sync-queue.repository';
import { SqliteProductoRepository } from './sqlite-producto.repository';
import { SqliteCatalogoRepository } from './sqlite-catalogo.repository';
import { SqliteCajaRepository } from './sqlite-caja.repository';
import { SqliteAuthRepository } from './sqlite-auth.repository';
import { SqliteService } from '../sqlite.service';

describe('SQLite Modular Repositories (Single Responsibility Principle)', () => {
  let dbService: SqliteDatabaseService;
  let syncQueueRepo: SqliteSyncQueueRepository;
  let productoRepo: SqliteProductoRepository;
  let catalogoRepo: SqliteCatalogoRepository;
  let cajaRepo: SqliteCajaRepository;
  let authRepo: SqliteAuthRepository;
  let sqliteFacade: SqliteService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SqliteDatabaseService,
        SqliteSyncQueueRepository,
        SqliteProductoRepository,
        SqliteCatalogoRepository,
        SqliteCajaRepository,
        SqliteAuthRepository,
        SqliteService,
      ],
    });

    dbService = TestBed.inject(SqliteDatabaseService);
    syncQueueRepo = TestBed.inject(SqliteSyncQueueRepository);
    productoRepo = TestBed.inject(SqliteProductoRepository);
    catalogoRepo = TestBed.inject(SqliteCatalogoRepository);
    cajaRepo = TestBed.inject(SqliteCajaRepository);
    authRepo = TestBed.inject(SqliteAuthRepository);
    sqliteFacade = TestBed.inject(SqliteService);
  });

  it('cada repositorio y servicio debe instanciarse con responsabilidad unica', () => {
    expect(dbService).toBeTruthy();
    expect(syncQueueRepo).toBeTruthy();
    expect(productoRepo).toBeTruthy();
    expect(catalogoRepo).toBeTruthy();
    expect(cajaRepo).toBeTruthy();
    expect(authRepo).toBeTruthy();
    expect(sqliteFacade).toBeTruthy();
  });

  describe('SqliteDatabaseService (SRP - Lifecycle, connection & hashing)', () => {
    it('debe calcular hash SHA-256 consistente en entorno web/navegador', async () => {
      const hash1 = await dbService.hashTexto('password123');
      const hash2 = await dbService.hashTexto('password123');
      const hash3 = await dbService.hashTexto('otraPassword');

      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(64);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('debe exponer metodos de inicializacion y conexion', () => {
      expect(typeof dbService.initDB).toBe('function');
      expect(typeof dbService.getDB).toBe('function');
    });
  });

  describe('SqliteSyncQueueRepository (SRP - Outbox Sync Queue)', () => {
    it('debe contener metodos dedicados a la cola de sincronizacion', () => {
      expect(typeof syncQueueRepo.encolar).toBe('function');
      expect(typeof syncQueueRepo.pendientesSync).toBe('function');
      expect(typeof syncQueueRepo.actualizarCola).toBe('function');
      expect(typeof syncQueueRepo.marcarEntidadSync).toBe('function');
    });
  });

  describe('SqliteProductoRepository (SRP - Persistencia de Productos)', () => {
    it('debe contener metodos dedicados al ciclo de vida offline de productos', () => {
      expect(typeof productoRepo.guardarProducto).toBe('function');
      expect(typeof productoRepo.getProductosLocales).toBe('function');
      expect(typeof productoRepo.buscarPorQR).toBe('function');
      expect(typeof productoRepo.guardarProductoOffline).toBe('function');
    });
  });

  describe('SqliteCatalogoRepository (SRP - Persistencia de Categorias y Marcas)', () => {
    it('debe contener metodos dedicados al catalogo maestro', () => {
      expect(typeof catalogoRepo.sincronizarCategorias).toBe('function');
      expect(typeof catalogoRepo.getCategoriasLocales).toBe('function');
      expect(typeof catalogoRepo.sincronizarMarcas).toBe('function');
      expect(typeof catalogoRepo.getMarcasLocales).toBe('function');
    });
  });

  describe('SqliteCajaRepository (SRP - Transacciones POS y Arqueo)', () => {
    it('debe contener metodos dedicados a turnos y ventas offline', () => {
      expect(typeof cajaRepo.guardarCajaLocal).toBe('function');
      expect(typeof cajaRepo.cajaLocalAbierta).toBe('function');
      expect(typeof cajaRepo.cerrarCajaOffline).toBe('function');
      expect(typeof cajaRepo.guardarVentaOffline).toBe('function');
      expect(typeof cajaRepo.guardarMovimientoOffline).toBe('function');
    });
  });

  describe('SqliteAuthRepository (SRP - Credenciales de usuarios offline)', () => {
    it('debe contener metodos dedicados a credenciales locales', () => {
      expect(typeof authRepo.guardarUsuarioOffline).toBe('function');
      expect(typeof authRepo.verificarUsuarioOffline).toBe('function');
    });
  });

  describe('SqliteService (SRP - Fachada y orquestador hacia repositorios)', () => {
    it('debe exponer la API publica consolidada delegando a los repositorios modulares', () => {
      expect(typeof sqliteFacade.initDB).toBe('function');
      expect(typeof sqliteFacade.guardarProducto).toBe('function');
      expect(typeof sqliteFacade.getProductosLocales).toBe('function');
      expect(typeof sqliteFacade.sincronizarCategorias).toBe('function');
      expect(typeof sqliteFacade.sincronizarMarcas).toBe('function');
      expect(typeof sqliteFacade.encolar).toBe('function');
      expect(typeof sqliteFacade.guardarVentaOffline).toBe('function');
      expect(typeof sqliteFacade.guardarUsuarioOffline).toBe('function');
    });
  });
});
