import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogosService } from './catalogos.service';
import { MarcaCatalogReader, MarcaCatalogWriter, CategoriaCatalogReader, CategoriaCatalogWriter } from './catalogos.interface';
import { ProductosService } from './productos.service';
import { ProductoReader, ProductoWriter, ProductoMediaHandler, ProductoExternalLookup } from './productos.interface';
import { SqliteService } from './sqlite.service';
import {
  SqliteProductoOperations,
  SqliteCatalogoOperations,
  SqliteCajaOperations,
  SqliteSyncQueueOperations,
  SqliteAuthOperations,
  SqliteDatabaseLifecycle,
} from './sqlite/sqlite-operations.interface';
import { Producto, ProductoIdentidad, ProductoPrecios, ProductoStock } from '../models/productos';

describe('Interface Segregation Principle (ISP) - Segregated Client Interfaces', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CatalogosService,
        ProductosService,
        SqliteService,
      ],
    });
  });

  describe('CatalogosService Segregated Interfaces', () => {
    it('debe permitir consumir CatalogosService únicamente como MarcaCatalogReader', () => {
      const service = TestBed.inject(CatalogosService);
      const reader: MarcaCatalogReader = service;

      expect(typeof reader.getMarcas).toBe('function');
    });

    it('debe permitir consumir CatalogosService únicamente como MarcaCatalogWriter', () => {
      const service = TestBed.inject(CatalogosService);
      const writer: MarcaCatalogWriter = service;

      expect(typeof writer.crearMarca).toBe('function');
      expect(typeof writer.actualizarMarca).toBe('function');
      expect(typeof writer.eliminarMarca).toBe('function');
    });

    it('debe permitir consumir CatalogosService únicamente como CategoriaCatalogReader', () => {
      const service = TestBed.inject(CatalogosService);
      const reader: CategoriaCatalogReader = service;

      expect(typeof reader.getCategorias).toBe('function');
    });

    it('debe permitir consumir CatalogosService únicamente como CategoriaCatalogWriter', () => {
      const service = TestBed.inject(CatalogosService);
      const writer: CategoriaCatalogWriter = service;

      expect(typeof writer.crearCategoria).toBe('function');
      expect(typeof writer.actualizarCategoria).toBe('function');
      expect(typeof writer.eliminarCategoria).toBe('function');
    });
  });

  describe('ProductosService Segregated Interfaces', () => {
    it('debe permitir consumir ProductosService como ProductoReader', () => {
      const service = TestBed.inject(ProductosService);
      const reader: ProductoReader = service;

      expect(typeof reader.getProductos).toBe('function');
      expect(typeof reader.getByQR).toBe('function');
    });

    it('debe permitir consumir ProductosService como ProductoWriter', () => {
      const service = TestBed.inject(ProductosService);
      const writer: ProductoWriter = service;

      expect(typeof writer.addProducto).toBe('function');
      expect(typeof writer.updateProducto).toBe('function');
      expect(typeof writer.deleteProducto).toBe('function');
    });

    it('debe permitir consumir ProductosService como ProductoMediaHandler', () => {
      const service = TestBed.inject(ProductosService);
      const media: ProductoMediaHandler = service;

      expect(typeof media.subirImagen).toBe('function');
      expect(typeof media.resolverImagenProducto).toBe('function');
    });

    it('debe permitir consumir ProductosService como ProductoExternalLookup', () => {
      const service = TestBed.inject(ProductosService);
      const lookup: ProductoExternalLookup = service;

      expect(typeof lookup.buscarInformacionPublica).toBe('function');
    });
  });

  describe('SqliteService Segregated Operations', () => {
    let sqlite: SqliteService;

    beforeEach(() => {
      sqlite = TestBed.inject(SqliteService);
    });

    it('debe cumplir con SqliteDatabaseLifecycle', () => {
      const lifecycle: SqliteDatabaseLifecycle = sqlite;
      expect(typeof lifecycle.initDB).toBe('function');
      expect(typeof lifecycle.hashTexto).toBe('function');
      expect(typeof lifecycle.disponible).toBe('boolean');
    });

    it('debe cumplir con SqliteProductoOperations sin requerir metodos de caja', () => {
      const prodOps: SqliteProductoOperations = sqlite;
      expect(typeof prodOps.guardarProducto).toBe('function');
      expect(typeof prodOps.buscarPorQR).toBe('function');
      expect(typeof prodOps.getProductosLocales).toBe('function');
    });

    it('debe cumplir con SqliteCatalogoOperations para marcas y categorias', () => {
      const catOps: SqliteCatalogoOperations = sqlite;
      expect(typeof catOps.sincronizarMarcas).toBe('function');
      expect(typeof catOps.sincronizarCategorias).toBe('function');
    });

    it('debe cumplir con SqliteCajaOperations para arqueo y cobro POS', () => {
      const cajaOps: SqliteCajaOperations = sqlite;
      expect(typeof cajaOps.guardarCajaLocal).toBe('function');
      expect(typeof cajaOps.guardarVentaOffline).toBe('function');
      expect(typeof cajaOps.cerrarCajaOffline).toBe('function');
    });

    it('debe cumplir con SqliteSyncQueueOperations para la cola Outbox', () => {
      const queueOps: SqliteSyncQueueOperations = sqlite;
      expect(typeof queueOps.encolar).toBe('function');
      expect(typeof queueOps.pendientesSync).toBe('function');
      expect(typeof queueOps.actualizarCola).toBe('function');
    });

    it('debe cumplir con SqliteAuthOperations para credenciales offline', () => {
      const authOps: SqliteAuthOperations = sqlite;
      expect(typeof authOps.guardarUsuarioOffline).toBe('function');
      expect(typeof authOps.verificarUsuarioOffline).toBe('function');
    });
  });

  describe('Domain Models Segregation (Producto)', () => {
    it('un objeto Producto debe satisfacer las sub-interfaces de dominio segregadas', () => {
      const p: Producto = {
        id: 'p-1',
        nombre: 'Cereal',
        precioVenta: 45,
        costo: 30,
        existencia: 10,
        stockMinimo: 2,
        tamano: '500g',
        presentacion: 'Caja',
        tipo: 'ABARROTES',
        codigoQR: '123456789',
        sku: 'SKU-123',
        imagen: 'https://img.com/cereal.jpg',
        activo: true,
        marca: { id: 'm-1', nombre: 'Kellogg' },
        categoria: { id: 'c-1', nombre: 'Desayuno' },
      };

      const identidad: ProductoIdentidad = p;
      const precios: ProductoPrecios = p;
      const stock: ProductoStock = p;

      expect(identidad.id).toBe('p-1');
      expect(precios.precioVenta).toBe(45);
      expect(stock.existencia).toBe(10);
    });
  });
});
