import { Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';
import { ItemCarrito, ProductoParaCarrito } from '../models/carrito';

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly clave = 'tienda.cliente.carrito';
  private readonly subject = new BehaviorSubject<ItemCarrito[]>(this.leer());
  readonly items$ = this.subject.asObservable();
  readonly cantidadTotal$ = this.items$.pipe(map((items) => items.reduce((total, item) => total + item.cantidad, 0)));
  readonly totalMostrado$ = this.items$.pipe(
    map((items) => items.reduce((total, item) => total + item.precioMostrado * item.cantidad, 0)),
  );

  get items(): ItemCarrito[] {
    return this.subject.value;
  }
  get cantidadTotal(): number {
    return this.items.reduce((total, item) => total + item.cantidad, 0);
  }
  get totalMostrado(): number {
    return this.items.reduce((total, item) => total + item.precioMostrado * item.cantidad, 0);
  }

  agregar(producto: ProductoParaCarrito): boolean {
    const stock = Math.max(0, Math.trunc(Number(producto.existencia ?? 0)));
    if (!Number.isFinite(stock) || stock <= 0) return false;
    const precio = Number(producto.precioVenta);
    if (!Number.isFinite(precio) || precio < 0) return false;

    const idStr = String(producto.id);
    const existente = this.items.find((item) => item.id === idStr);
    if (existente && existente.cantidad >= stock) return false;
    const presentacion = [producto.tamano, producto.presentacion].filter(Boolean).join(' · ') || null;
    const actualizados = existente
      ? this.items.map((item) =>
          item.id === existente.id
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                precioMostrado: precio,
                stockConocido: stock,
                imagen: producto.imagen,
                presentacion,
              }
            : item,
        )
      : [
          ...this.items,
          {
            id: idStr,
            nombre: producto.nombre,
            precioMostrado: precio,
            cantidad: 1,
            imagen: producto.imagen,
            stockConocido: stock,
            presentacion,
          },
        ];
    this.actualizar(actualizados);
    return true;
  }

  incrementar(id: string): boolean {
    const item = this.items.find((actual) => actual.id === id);
    if (!item || item.cantidad >= item.stockConocido) return false;
    this.actualizar(
      this.items.map((actual) => (actual.id === id ? { ...actual, cantidad: actual.cantidad + 1 } : actual)),
    );
    return true;
  }

  decrementar(id: string): void {
    const item = this.items.find((actual) => actual.id === id);
    if (!item || item.cantidad <= 1) return;
    this.actualizar(
      this.items.map((actual) => (actual.id === id ? { ...actual, cantidad: actual.cantidad - 1 } : actual)),
    );
  }

  eliminar(id: string): void {
    this.actualizar(this.items.filter((item) => item.id !== id));
  }
  vaciar(): void {
    this.actualizar([]);
  }

  actualizarDisponibilidad(
    productos: Array<{ id: string; existencia?: number | null; precioVenta?: number; existenciaPro?: number | null; precioVentaPro?: number }>,
  ): void {
    const disponibles = new Map(productos.map((producto) => [String(producto.id), producto]));
    const actualizados = this.items.reduce<ItemCarrito[]>((resultado, item) => {
      const producto = disponibles.get(item.id);
      if (!producto) return resultado;
      const stock = Math.max(0, Math.trunc(Number((producto.existencia ?? producto.existenciaPro) ?? 0)));
      if (!stock) return resultado;
      const precio = Number(producto.precioVenta ?? producto.precioVentaPro);
      resultado.push({
        ...item,
        stockConocido: stock,
        cantidad: Math.min(item.cantidad, stock),
        precioMostrado: Number.isFinite(precio) && precio >= 0 ? precio : item.precioMostrado,
      });
      return resultado;
    }, []);
    this.actualizar(actualizados);
  }

  private actualizar(items: ItemCarrito[]): void {
    localStorage.setItem(this.clave, JSON.stringify(items));
    this.subject.next(items);
  }

  private leer(): ItemCarrito[] {
    try {
      const guardado = JSON.parse(localStorage.getItem(this.clave) || '[]') as unknown;
      if (!Array.isArray(guardado)) return [];
      return guardado
        .filter(this.esItemValido)
        .map((item) => ({ ...item, cantidad: Math.min(item.cantidad, item.stockConocido) }));
    } catch {
      return [];
    }
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
      item.stockConocido > 0 &&
      item.cantidad <= item.stockConocido
    );
  }
}
