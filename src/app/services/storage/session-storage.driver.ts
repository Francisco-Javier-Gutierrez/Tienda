import { Injectable } from '@angular/core';
import { StorageDriver } from './storage-driver.interface';

/**
 * =========================================================================
 * Liskov Substitution Principle (LSP) - Session Storage Driver
 * =========================================================================
 * Implementación de almacenamiento de sesión en navegador (sessionStorage).
 * Sustituible por cualquier otra implementación de StorageDriver.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionStorageDriver implements StorageDriver {
  getItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Manejo tolerante ante fallos de cuota o modo privado
    }
  }

  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Manejo tolerante
    }
  }

  clear(): void {
    try {
      sessionStorage.clear();
    } catch {
      // Manejo tolerante
    }
  }
}
