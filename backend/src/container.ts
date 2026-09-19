import { storageService, IStorageService } from './services/storage.service';
import { productoRepository, IProductoRepository } from './db/repositories/producto.repository';
import { cajaRepository, ICajaRepository } from './db/repositories/caja.repository';
import { pedidoRepository } from './db/repositories/pedido.repository';
import { ventaRepository } from './db/repositories/venta.repository';
import { configuracionRepository } from './db/repositories/configuracion.repository';
import { authRepository } from './db/repositories/auth.repository';

export const TOKENS = {
  StorageService: 'IStorageService',
  ProductoRepository: 'IProductoRepository',
  CajaRepository: 'ICajaRepository',
  PedidoRepository: 'IPedidoRepository',
  VentaRepository: 'IVentaRepository',
  ConfiguracionRepository: 'IConfiguracionRepository',
  AuthRepository: 'IAuthRepository',
  ProductosService: 'IProductosService',
  PedidosService: 'IPedidosService',
  VentasService: 'IVentasService',
  UploadsService: 'IUploadsService',
  CajaService: 'ICajaService',
} as const;

/**
 * Container: Contenedor ligero de Inyección de Dependencias (DIP) optimizado para AWS Serverless.
 * Cumple con el Principio de Inversión de Dependencias (DIP):
 * - Los módulos de alto nivel dependen de abstracciones y no de clases concretas o singletons rígidos.
 * - Permite resolver dependencias cacheadas por instancia de Lambda (minimiza cold starts).
 * - Permite crear scopes aislados para testing unitario sin necesidad de modificar el código de producción.
 */
export class Container {
  private instances = new Map<string, any>();
  private factories = new Map<string, () => any>();

  register<T>(token: string, instance: T): this {
    this.instances.set(token, instance);
    return this;
  }

  registerFactory<T>(token: string, factory: () => T): this {
    this.factories.set(token, factory);
    return this;
  }

  resolve<T>(token: string): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }
    if (this.factories.has(token)) {
      const instance = this.factories.get(token)!();
      this.instances.set(token, instance);
      return instance;
    }
    throw new Error(`Dependencia no registrada en el contenedor: ${token}`);
  }

  has(token: string): boolean {
    return this.instances.has(token) || this.factories.has(token);
  }

  createScope(): Container {
    const child = new Container();
    this.instances.forEach((v, k) => child.register(k, v));
    this.factories.forEach((v, k) => child.registerFactory(k, v));
    return child;
  }

  clear(): void {
    this.instances.clear();
    this.factories.clear();
  }
}

export const appContainer = new Container();

// Inicializar dependencias base en el contenedor
appContainer.register<IStorageService>(TOKENS.StorageService, storageService);
appContainer.register<IProductoRepository>(TOKENS.ProductoRepository, productoRepository);
appContainer.register<ICajaRepository>(TOKENS.CajaRepository, cajaRepository);
appContainer.register(TOKENS.PedidoRepository, pedidoRepository);
appContainer.register(TOKENS.VentaRepository, ventaRepository);
appContainer.register(TOKENS.ConfiguracionRepository, configuracionRepository);
appContainer.register(TOKENS.AuthRepository, authRepository);

// Inicializar servicios en el contenedor mediante factories perezosas
appContainer.registerFactory(TOKENS.ProductosService, () => {
  const { productosService } = require('./modules/productos/productos.service');
  return productosService;
});
appContainer.registerFactory(TOKENS.PedidosService, () => {
  const { pedidosService } = require('./modules/pedidos/pedidos.service');
  return pedidosService;
});
appContainer.registerFactory(TOKENS.VentasService, () => {
  const { ventasService } = require('./modules/ventas/ventas.service');
  return ventasService;
});
appContainer.registerFactory(TOKENS.UploadsService, () => {
  const { uploadsService } = require('./modules/uploads/uploads.service');
  return uploadsService;
});
appContainer.registerFactory(TOKENS.CajaService, () => {
  const { cajaService } = require('./modules/caja/caja.service');
  return cajaService;
});
