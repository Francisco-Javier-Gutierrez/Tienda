import { inject, Injectable } from '@angular/core';
import { ItemCarrito } from '../models/carrito';
import { STORAGE_DRIVER } from './tokens';

/**
 * =========================================================================
 * Single Responsibility, LSP & DIP (SOLID)
 * =========================================================================
 * Responsabilidad única: Persistencia, serialización y saneamiento del carrito.
 * Inversión de Dependencias: Depende de la abstracción STORAGE_DRIVER.
 */
@Injectable({
  providedIn: 'root',
})
export class CartStorageService {
  private readonly storageKey = 'tienda.cliente.carrito';
  private readonly driver = inject(STORAGE_DRIVER);

  leer(): ItemCarrito[] {
    try {
      const raw = this.driver.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(this.esItemValido)
        .map((item) => ({ ...item, cantidad: Math.min(item.cantidad, item.stockConocido) }));
    } catch {
      return [];
    }
  }

  guardar(items: ItemCarrito[]): void {
    this.driver.setItem(this.storageKey, JSON.stringify(items));
  }

  private esItemValido(valor: unknown): valor is ItemCarrito {
    if (!valor || typeof valor !== 'object') return false;
    const item = valor as Partial<ItemCarrito>;
    return (
      typeof item.id === 'string' &&
      Boolean(item.id) &&
      typeof item.nombre === 'string' &&
      typeof item.precioMostrado === 'number' &&
      Number.isFinite(item.precioMostrado) &&
      item.precioMostrado >= 0 &&
      typeof item.cantidad === 'number' &&
      Number.isInteger(item.cantidad) &&
      item.cantidad > 0 &&
      typeof item.stockConocido === 'number' &&
      Number.isInteger(item.stockConocido) &&
      item.stockConocido > 0
    );
  }

  limpiar(): void {
    this.driver.removeItem(this.storageKey);
  }
}
