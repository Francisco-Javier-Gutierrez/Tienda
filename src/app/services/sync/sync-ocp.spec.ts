import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SyncHandlerRegistry } from './sync-handler.registry';
import { SyncOperationHandler, SyncHandlerResult } from './sync-handler.interface';
import { MarcaSyncHandler } from './handlers/marca-sync.handler';
import { CategoriaSyncHandler } from './handlers/categoria-sync.handler';
import { CajaAperturaSyncHandler } from './handlers/caja-apertura-sync.handler';
import { CajaMovimientoSyncHandler } from './handlers/caja-movimiento-sync.handler';
import { ProductoSyncHandler } from './handlers/producto-sync.handler';
import { VentaSyncHandler } from './handlers/venta-sync.handler';
import { CierreSyncHandler } from './handlers/cierre-sync.handler';
import { ItemColaSync } from '../sqlite/sqlite-sync-queue.repository';

describe('Sync Operation Handlers & Registry (Open/Closed Principle - OCP)', () => {
  let registry: SyncHandlerRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SyncHandlerRegistry,
        MarcaSyncHandler,
        CategoriaSyncHandler,
        CajaAperturaSyncHandler,
        CajaMovimientoSyncHandler,
        ProductoSyncHandler,
        VentaSyncHandler,
        CierreSyncHandler,
      ],
    });

    registry = TestBed.inject(SyncHandlerRegistry);
  });

  it('debe crearse correctamente e inicializar los manejadores predeterminados', () => {
    expect(registry).toBeTruthy();
    const tipos = registry.tiposRegistrados();
    expect(tipos).toContain('MARCA_CREAR');
    expect(tipos).toContain('CATEGORIA_CREAR');
    expect(tipos).toContain('APERTURA');
    expect(tipos).toContain('MOVIMIENTO');
    expect(tipos).toContain('PRODUCTO_CREAR');
    expect(tipos).toContain('VENTA');
    expect(tipos).toContain('CIERRE');
    expect(tipos.length).toBe(7);
  });

  it('debe resolver el manejador correspondiente para cada tipo de operacion', () => {
    expect(registry.obtener('MARCA_CREAR')).toBeInstanceOf(MarcaSyncHandler);
    expect(registry.obtener('CATEGORIA_CREAR')).toBeInstanceOf(CategoriaSyncHandler);
    expect(registry.obtener('APERTURA')).toBeInstanceOf(CajaAperturaSyncHandler);
    expect(registry.obtener('MOVIMIENTO')).toBeInstanceOf(CajaMovimientoSyncHandler);
    expect(registry.obtener('PRODUCTO_CREAR')).toBeInstanceOf(ProductoSyncHandler);
    expect(registry.obtener('VENTA')).toBeInstanceOf(VentaSyncHandler);
    expect(registry.obtener('CIERRE')).toBeInstanceOf(CierreSyncHandler);
  });

  it('debe permitir extension dinámica con nuevos manejadores sin modificar el registro (OCP)', async () => {
    let ejecutado = false;

    // Nuevo manejador para una entidad futura (ej. PROVEEDOR_CREAR)
    class ProveedorSyncHandler implements SyncOperationHandler {
      readonly tipo = 'PROVEEDOR_CREAR';
      async ejecutar(op: ItemColaSync, payload: any): Promise<SyncHandlerResult | void> {
        ejecutado = true;
      }
    }

    const nuevoHandler = new ProveedorSyncHandler();
    registry.registrar(nuevoHandler);

    expect(registry.tiene('PROVEEDOR_CREAR')).toBeTrue();
    expect(registry.obtener('PROVEEDOR_CREAR')).toBe(nuevoHandler);

    const dummyOp: ItemColaSync = {
      id: '1',
      tipo: 'PROVEEDOR_CREAR',
      uuid: 'uuid-prov-1',
      payload: '{}',
      orden: 1,
      estado: 'PENDIENTE',
      error: null,
    };

    await registry.obtener('PROVEEDOR_CREAR')?.ejecutar(dummyOp, {});
    expect(ejecutado).toBeTrue();
  });

  it('debe retornar undefined para tipos no registrados', () => {
    expect(registry.obtener('TIPO_INEXISTENTE')).toBeUndefined();
    expect(registry.tiene('TIPO_INEXISTENTE')).toBeFalse();
  });
});
