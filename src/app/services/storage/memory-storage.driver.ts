import { Injectable } from '@angular/core';
import { StorageDriver } from './storage-driver.interface';

/**
 * =========================================================================
 * Liskov Substitution Principle (LSP) - Memory Storage Driver
 * =========================================================================
 * Implementación de almacenamiento en memoria volátil (Map).
 * Cumple idéntico contrato que LocalStorageDriver y SessionStorageDriver,
 * permitiendo sustitución transparente en pruebas, SSR o entornos aislados.
 */
@Injectable({
  providedIn: 'root',
})
export class MemoryStorageDriver implements StorageDriver {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
