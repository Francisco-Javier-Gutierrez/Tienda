import { TestBed } from '@angular/core/testing';
import { CartStorageService } from './cart-storage.service';
import { ItemCarrito } from '../models/carrito';

describe('CartStorageService (Single Responsibility Principle)', () => {
  let service: CartStorageService;
  const storageKey = 'tienda.cliente.carrito';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [CartStorageService],
    });
    service = TestBed.inject(CartStorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debe retornar lista vacia cuando no hay datos guardados', () => {
    const items = service.leer();
    expect(items).toEqual([]);
  });

  it('debe persistir y recuperar items válidos en localStorage', () => {
    const items: ItemCarrito[] = [
      {
        id: 'p-1',
        nombre: 'Laptop Gamer',
        precioMostrado: 1500,
        cantidad: 2,
        stockConocido: 5,
        imagen: 'https://img.com/lap.png',
        presentacion: 'Negro · 16GB',
      },
    ];

    service.guardar(items);
    const recuperados = service.leer();

    expect(recuperados.length).toBe(1);
    expect(recuperados[0].id).toBe('p-1');
    expect(recuperados[0].nombre).toBe('Laptop Gamer');
    expect(recuperados[0].precioMostrado).toBe(1500);
    expect(recuperados[0].cantidad).toBe(2);
  });

  it('debe sanear y limitar la cantidad si supera el stock conocido', () => {
    const rawData = [
      {
        id: 'p-2',
        nombre: 'Mouse Inalámbrico',
        precioMostrado: 25,
        cantidad: 10,
        stockConocido: 3,
      },
    ];
    localStorage.setItem(storageKey, JSON.stringify(rawData));

    const recuperados = service.leer();
    expect(recuperados.length).toBe(1);
    expect(recuperados[0].cantidad).toBe(3);
  });

  it('debe filtrar items corruptos o invalidos', () => {
    const corruptedData = [
      { id: '', nombre: 'Invalido sin id', precioMostrado: 10, cantidad: 1, stockConocido: 5 },
      { id: 'p-3', nombre: 'Valido', precioMostrado: 20, cantidad: 1, stockConocido: 5 },
      { id: 'p-4', nombre: 'Precio invalido', precioMostrado: -5, cantidad: 1, stockConocido: 5 },
      null,
      'no-json-object',
    ];
    localStorage.setItem(storageKey, JSON.stringify(corruptedData));

    const recuperados = service.leer();
    expect(recuperados.length).toBe(1);
    expect(recuperados[0].id).toBe('p-3');
  });

  it('debe limpiar los datos del localStorage', () => {
    service.guardar([
      { id: 'p-1', nombre: 'Prod 1', precioMostrado: 10, cantidad: 1, stockConocido: 5, imagen: null, presentacion: null },
    ]);
    expect(service.leer().length).toBe(1);

    service.limpiar();
    expect(service.leer().length).toBe(0);
  });
});
