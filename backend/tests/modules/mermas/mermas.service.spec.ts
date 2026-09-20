import { mermasService } from '../../../src/modules/mermas/mermas.service';
import { mermaRepository } from '../../../src/db/repositories/merma.repository';
import { productoRepository } from '../../../src/db/repositories/producto.repository';

describe('MermasService Complete Coverage', () => {
  const dummyEmpleado = {
    idEmp: 1,
    idSuc: 1,
    nombre: 'Admin Tienda',
  };

  const dummyProducto = {
    idPro: 5,
    idSuc: 1,
    nombrePro: 'Leche Entera 1L',
    costoPro: 20.5,
    precioVentaPro: 27.0,
    existenciaPro: 15,
    stockMinimoPro: 3,
    activoPro: true,
  };

  const dummyMerma = {
    idMerma: 101,
    uuidMerma: '11111111-1111-4111-8111-111111111111',
    idSuc: 1,
    idEmp: 1,
    empleadoNombre: 'Admin Tienda',
    idPro: 5,
    productoNombre: 'Leche Entera 1L',
    codigoQR: '75010001',
    cantidad: 2,
    tipo: 'CADUCADO' as const,
    motivo: 'Caducó el 18 de septiembre',
    costoUnitario: 20.5,
    costoTotal: 41.0,
    precioVentaUnitario: 27.0,
    idProv: null,
    proveedorNombre: null,
    estado: 'APLICADO' as const,
    fecha: '2026-09-19',
    fechaHora: '2026-09-19T10:00:00.000Z',
    createdAt: '2026-09-19T10:00:00.000Z',
    updatedAt: '2026-09-19T10:00:00.000Z',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registrarMerma', () => {
    it('debe rechazar si el idPro es inválido o no existe', async () => {
      await expect(
        mermasService.registrarMerma(dummyEmpleado, {
          idPro: 'invalido',
          cantidad: 1,
          tipo: 'CADUCADO',
          motivo: 'Prueba',
        }),
      ).rejects.toMatchObject({ status: 400 });

      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValue(null);
      await expect(
        mermasService.registrarMerma(dummyEmpleado, {
          idPro: 999,
          cantidad: 1,
          tipo: 'CADUCADO',
          motivo: 'Prueba',
        }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('debe rechazar si la cantidad es menor o igual a cero', async () => {
      await expect(
        mermasService.registrarMerma(dummyEmpleado, {
          idPro: 5,
          cantidad: 0,
          tipo: 'CADUCADO',
          motivo: 'Prueba',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('debe rechazar si la cantidad solicitada supera el stock disponible', async () => {
      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValue(dummyProducto as any);

      await expect(
        mermasService.registrarMerma(dummyEmpleado, {
          idPro: 5,
          cantidad: 20,
          tipo: 'CADUCADO',
          motivo: 'Stock insuficiente',
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('debe registrar exitosamente la merma y calcular los importes correctamente', async () => {
      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValue(dummyProducto as any);
      jest.spyOn(mermaRepository, 'createMerma').mockResolvedValue(dummyMerma);

      const res = await mermasService.registrarMerma(dummyEmpleado, {
        idPro: 5,
        cantidad: 2,
        tipo: 'CADUCADO',
        motivo: 'Caducó el 18 de septiembre',
      });

      expect(res).toBeDefined();
      expect(res.id).toBeDefined();
      expect(res.cantidad).toBe(2);
      expect(res.costoTotal).toBe(41);
      expect(res.estado).toBe('APLICADO');
    });

    it('debe asignar estado PENDIENTE_REPOSICION si el tipo es DEVOLUCION_PROVEEDOR', async () => {
      jest.spyOn(productoRepository, 'getProductoById').mockResolvedValue(dummyProducto as any);
      const devolucion = {
        ...dummyMerma,
        tipo: 'DEVOLUCION_PROVEEDOR' as const,
        estado: 'PENDIENTE_REPOSICION' as const,
      };
      jest.spyOn(mermaRepository, 'createMerma').mockResolvedValue(devolucion);

      const res = await mermasService.registrarMerma(dummyEmpleado, {
        idPro: 5,
        cantidad: 2,
        tipo: 'DEVOLUCION_PROVEEDOR',
        motivo: 'Empaque roto de fábrica para cambio',
      });

      expect(res.tipo).toBe('DEVOLUCION_PROVEEDOR');
      expect(res.estado).toBe('PENDIENTE_REPOSICION');
    });
  });

  describe('listarMermas y obtenerPorId', () => {
    it('debe retornar lista normalizada de mermas', async () => {
      jest.spyOn(mermaRepository, 'listMermas').mockResolvedValue([dummyMerma]);

      const lista = await mermasService.listarMermas(1, { tipo: 'CADUCADO' });
      expect(lista).toHaveLength(1);
      expect(lista[0].id).toBeDefined();
    });

    it('debe obtener y normalizar una merma por id', async () => {
      jest.spyOn(mermaRepository, 'getMermaById').mockResolvedValue(dummyMerma);

      const res = await mermasService.obtenerPorId(101, 1);
      expect(res.productoNombre).toBe('Leche Entera 1L');
    });

    it('debe rechazar si no encuentra la merma', async () => {
      jest.spyOn(mermaRepository, 'getMermaById').mockResolvedValue(null);

      await expect(mermasService.obtenerPorId(999, 1)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('actualizarEstado', () => {
    it('debe actualizar el estado de la merma', async () => {
      jest.spyOn(mermaRepository, 'updateEstadoMerma').mockResolvedValue({
        ...dummyMerma,
        estado: 'DEVUELTO_PROVEEDOR',
      });

      const res = await mermasService.actualizarEstado(101, 'DEVUELTO_PROVEEDOR', 1);
      expect(res.estado).toBe('DEVUELTO_PROVEEDOR');
    });
  });

  describe('obtenerResumen', () => {
    it('debe calcular correctamente métricas de pérdida y agrupaciones', async () => {
      const items = [
        dummyMerma,
        {
          ...dummyMerma,
          idMerma: 102,
          tipo: 'DEVOLUCION_PROVEEDOR' as const,
          estado: 'PENDIENTE_REPOSICION' as const,
          cantidad: 3,
          costoTotal: 61.5,
        },
        {
          ...dummyMerma,
          idMerma: 103,
          tipo: 'DANADO' as const,
          cantidad: 1,
          costoTotal: 20.5,
        },
      ];
      jest.spyOn(mermaRepository, 'listMermas').mockResolvedValue(items);

      const resumen = await mermasService.obtenerResumen(1);
      expect(resumen.totalRegistros).toBe(3);
      expect(resumen.totalPiezas).toBe(6);
      expect(resumen.totalPerdida).toBe(61.5); // 41 + 20.5 (excluyendo pendiente reposición)
      expect(resumen.totalDevolucionesPendientes).toBe(61.5);
      expect(resumen.piezasDevolucionesPendientes).toBe(3);
      expect(resumen.topProductos).toHaveLength(1);
    });
  });
});
