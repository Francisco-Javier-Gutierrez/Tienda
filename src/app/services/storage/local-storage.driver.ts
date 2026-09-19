import { Injectable } from '@angular/core';
import { StorageDriver } from './storage-driver.interface';

/**
 * =========================================================================
 * Liskov Substitution Principle (LSP) - Local Storage Driver
 * =========================================================================
 * Implementación de almacenamiento persistente en navegador (localStorage).
 * Sustituible por cualquier otra implementación de StorageDriver.
 */
@Injectable({
  providedIn: 'root',
})
export class LocalStorageDriver implements StorageDriver {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Manejo tolerante ante fallos de cuota o modo privado
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Manejo tolerante
    }
  }

  clear(): void {
    try {
      localStorage.clear();
    } catch {
      // Manejo tolerante
    }
  }
}
