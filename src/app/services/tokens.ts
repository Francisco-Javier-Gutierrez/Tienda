import { inject, InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';
import { StorageDriver } from './storage/storage-driver.interface';
import { LocalStorageDriver } from './storage/local-storage.driver';
import { BaseSessionStore } from './session/base-session-store';
import { AuthSession } from '../models/auth';
import { ClienteAuthSession } from '../models/cliente-auth';
import { AuthSessionStore } from './auth-session.service';
import { ClienteSessionStore } from './cliente-session.service';
import { ProductosOperations } from './productos.interface';
import { ProductosService } from './productos.service';
import { CategoriaCatalogService, MarcaCatalogService } from './catalogos.interface';
import { CatalogosService } from './catalogos.service';

/**
 * =========================================================================
 * Dependency Inversion Principle (DIP) - Central Injection Tokens
 * =========================================================================
 * Abstracciones mediante InjectionTokens para invertir las dependencias.
 * Los módulos de alto nivel dependen de estos tokens en lugar de clases concretas
 * o ficheros de configuración estáticos.
 */

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.API_BASE_URL,
});

export const STORAGE_DRIVER = new InjectionToken<StorageDriver>('STORAGE_DRIVER', {
  providedIn: 'root',
  factory: () => inject(LocalStorageDriver),
});

export const AUTH_SESSION_STORE = new InjectionToken<BaseSessionStore<AuthSession>>('AUTH_SESSION_STORE', {
  providedIn: 'root',
  factory: () => inject(AuthSessionStore),
});

export const CLIENTE_SESSION_STORE = new InjectionToken<BaseSessionStore<ClienteAuthSession>>('CLIENTE_SESSION_STORE', {
  providedIn: 'root',
  factory: () => inject(ClienteSessionStore),
});

export const PRODUCTOS_SERVICE = new InjectionToken<ProductosOperations>('PRODUCTOS_SERVICE', {
  providedIn: 'root',
  factory: () => inject(ProductosService),
});

export const CATALOGOS_SERVICE = new InjectionToken<MarcaCatalogService & CategoriaCatalogService>('CATALOGOS_SERVICE', {
  providedIn: 'root',
  factory: () => inject(CatalogosService),
});
