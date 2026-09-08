import {
  productosService,
  validarProducto,
  eliminarUploadControlado,
} from '../../../src/modules/productos/productos.service';
import { prisma } from '../../../src/config/prisma';

describe('ProductosService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('validarProducto y eliminarUploadControlado', () => {
    it('eliminarUploadControlado maneja null, s3 y rutas locales', () => {
      expect(() => eliminarUploadControlado(null)).not.toThrow();
      expect(() => eliminarUploadControlado('https://bucket.s3.amazonaws.com/test.jpg')).not.toThrow();
      expect(() => eliminarUploadControlado('/otra/ruta/foto.jpg')).not.toThrow();
      expect(() => eliminarUploadControlado('/uploads/productos/foto.jpg')).not.toThrow();
    });

    it('debe validar un producto completo correctamente', () => {
      const error = validarProducto({
        nombre: 'Galletas de Chocolate',
        precio: 25.5,
        existencia: 10,
        costo: 15.0,
        stockMinimo: 2,
        idMarca: 1,
        idCat: 2,
      });
      expect(error).toBeNull();
    });

    it('debe requerir nombre', () => {
      const error = validarProducto({ nombre: '', precio: 10, existencia: 5, idMarca: 1, idCat: 1 });
      expect(error).toBe('El nombre del producto es obligatorio');
    });

    it('debe validar que precio y existencia sean positivos/válidos', () => {
      expect(
        validarProducto({ nombre: 'Item', precio: -1, existencia: 5, idMarca: 1, idCat: 1 }),
      ).toBe('El precio de venta debe ser un número mayor o igual a cero');

      expect(
        validarProducto({ nombre: 'Item', precio: 10, existencia: -3, idMarca: 1, idCat: 1 }),
      ).toBe('La existencia debe ser un entero mayor o igual a cero');
    });

    it('debe validar costo y stock mínimo opcionales pero no negativos', () => {
      expect(
        validarProducto({
          nombre: 'Item',
          precio: 10,
          existencia: 5,
          costo: -5,
          idMarca: 1,
          idCat: 1,
        }),
      ).toBe('El costo debe ser un número mayor o igual a cero');

      expect(
        validarProducto({
          nombre: 'Item',
          precio: 10,
          existencia: 5,
          stockMinimo: -1,
          idMarca: 1,
          idCat: 1,
        }),
      ).toBe('El stock mínimo debe ser un entero mayor o igual a cero');
    });

    it('debe validar que idMarca e idCat sean válidos', () => {
      expect(
        validarProducto({ nombre: 'Item', precio: 10, existencia: 5, idMarca: 0, idCat: 1 }),
      ).toBe('Selecciona una marca válida');

      expect(
        validarProducto({ nombre: 'Item', precio: 10, existencia: 5, idMarca: 1, idCat: null }),
      ).toBe('Selecciona una categoría válida');
    });
  });

  describe('Consultas y Listados de Productos', () => {
    it('obtenerProducto con y sin resultado', async () => {
      jest.spyOn(prisma.producto, 'findUnique').mockResolvedValueOnce(null);
      expect(await productosService.obtenerProducto(999)).toBeNull();

      jest.spyOn(prisma.producto, 'findUnique').mockResolvedValueOnce({
        idPro: 1,
        nombrePro: 'Test',
        precioVentaPro: 10 as any,
        costoPro: null,
        existenciaPro: 5,
        stockMinimoPro: 1,
        tamanoPro: null,
        presentacionPro: null,
        tipoPro: null,
        codigoQR: null,
        skuPro: null,
        imagenPro: null,
        idMarca: null,
        idCat: null,
        marca: null,
        categoria: null,
        activoPro: true,
      } as any);
      const res = await productosService.obtenerProducto(1);
      expect(res?.id).toBeDefined();
    });

    it('listarAdmin debe formatear precios y catalogos', async () => {
      jest.spyOn(prisma.producto, 'findMany').mockResolvedValue([
        {
          idPro: 1,
          nombrePro: 'Leche Entera',
          precioVentaPro: 28.0 as any,
          costoPro: 20.0 as any,
          existenciaPro: 15,
          stockMinimoPro: 3,
          tamanoPro: '1L',
          presentacionPro: 'Tetrapack',
          tipoPro: 'Lácteo',
          codigoQR: '7501234567890',
          skuPro: 'SKU-001',
          imagenPro: null,
          idMarca: 1,
          idCat: 1,
          activoPro: true,
          marca: { nombreMarca: 'Lala' },
          categoria: { nombreCat: 'Lácteos' },
        } as any,
      ]);

      const items = await productosService.listarAdmin();
      expect(items.length).toBe(1);
      expect(items[0]?.nombre).toBe('Leche Entera');
      expect(items[0]?.marca?.nombre || items[0]?.marca).toBe('Lala');
      expect(items[0]?.precioVenta).toBe(28);
    });

    it('listarPos y listarPublico deben retornar productos activos', async () => {
      jest.spyOn(prisma.producto, 'findMany').mockResolvedValue([
        {
          idPro: 1,
          nombrePro: 'Agua',
          precioVentaPro: 10 as any,
          existenciaPro: 20,
          codigoQR: 'QR123',
          skuPro: 'SKU1',
          imagenPro: null,
          marca: null,
          categoria: null,
        } as any,
      ]);

      const pos = await productosService.listarPos();
      expect(pos.length).toBe(1);
      expect(pos[0]?.nombre).toBe('Agua');

      const pub = await productosService.listarPublico();
      expect(pub.length).toBe(1);
    });

    it('buscarPorQR debe retornar el producto si existe', async () => {
      jest.spyOn(prisma.producto, 'findUnique').mockResolvedValue({
        idPro: 2,
        nombrePro: 'Agua Natural',
        precioVentaPro: 12.0 as any,
        costoPro: 6.0 as any,
        existenciaPro: 50,
        stockMinimoPro: 5,
        codigoQR: '1122334455',
        activoPro: true,
        marca: null,
        categoria: null,
      } as any);

      const prod = await productosService.buscarPorQR('1122334455');
      expect(prod).not.toBeNull();
      expect(prod?.nombre).toBe('Agua Natural');
    });
  });

  describe('Creación, Actualización e Imágenes', () => {
    it('crear debe rechazar validaciones de catálogo o código repetido', async () => {
      await expect(productosService.crear({ nombre: '' })).rejects.toMatchObject({ status: 400 });

      jest.spyOn(prisma.marca, 'findUnique').mockResolvedValue(null);
      await expect(
        productosService.crear({ nombre: 'P', precio: 10, existencia: 5, idMarca: 99, idCat: 1 }),
      ).rejects.toMatchObject({ status: 400, message: 'La marca seleccionada no existe' });

      jest.spyOn(prisma.marca, 'findUnique').mockResolvedValue({ idMarca: 1 } as any);
      jest.spyOn(prisma.categoria, 'findUnique').mockResolvedValue(null);
      await expect(
        productosService.crear({ nombre: 'P', precio: 10, existencia: 5, idMarca: 1, idCat: 99 }),
      ).rejects.toMatchObject({ status: 400, message: 'La categoría seleccionada no existe' });

      jest.spyOn(prisma.marca, 'findUnique').mockResolvedValue({ idMarca: 1 } as any);
      jest.spyOn(prisma.categoria, 'findUnique').mockResolvedValue({ idCat: 1 } as any);
      jest.spyOn(prisma.producto, 'findFirst').mockResolvedValue({ idPro: 99 } as any);

      await expect(
        productosService.crear({
          nombre: 'Producto Repetido',
          precio: 20,
          existencia: 5,
          idMarca: 1,
          idCat: 1,
          codigoQR: 'EXISTE_123',
        }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'El código de barras ya pertenece a otro producto',
      });
    });

    it('crear debe insertar y retornar el producto creado', async () => {
      jest.spyOn(prisma.marca, 'findUnique').mockResolvedValue({ idMarca: 1 } as any);
      jest.spyOn(prisma.categoria, 'findUnique').mockResolvedValue({ idCat: 1 } as any);
      jest.spyOn(prisma.producto, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.producto, 'create').mockResolvedValue({ idPro: 10 } as any);
      jest.spyOn(productosService, 'obtenerProducto').mockResolvedValue({
        id: 'enc10',
        nombre: 'Nuevo Producto',
        precioVenta: 30,
      } as any);

      const creado = await productosService.crear({
        nombre: 'Nuevo Producto',
        precio: 30,
        existencia: 10,
        idMarca: 1,
        idCat: 1,
      });

      expect(creado?.id).toBeDefined();
    });

    it('actualizar validaciones y éxito', async () => {
      await expect(productosService.actualizar(1, { nombre: '' })).rejects.toMatchObject({ status: 400 });

      jest.spyOn(productosService, 'obtenerProducto').mockResolvedValueOnce(null);
      await expect(
        productosService.actualizar(1, { nombre: 'P', precio: 10, existencia: 1, idMarca: 1, idCat: 1 }),
      ).rejects.toMatchObject({ status: 404 });

      jest.spyOn(productosService, 'obtenerProducto').mockResolvedValue({ id: 'enc1', idPro: 1 } as any);
      jest.spyOn(prisma.marca, 'findUnique').mockResolvedValue(null);
      await expect(
        productosService.actualizar(1, { nombre: 'P', precio: 10, existencia: 1, idMarca: 99, idCat: 1 }),
      ).rejects.toMatchObject({ status: 400 });

      jest.spyOn(prisma.marca, 'findUnique').mockResolvedValue({ idMarca: 1 } as any);
      jest.spyOn(prisma.categoria, 'findUnique').mockResolvedValue({ idCat: 1 } as any);
      jest.spyOn(prisma.producto, 'findFirst').mockResolvedValue({ idPro: 99 } as any);
      await expect(
        productosService.actualizar(1, { nombre: 'P', precio: 10, existencia: 1, idMarca: 1, idCat: 1, codigoQR: '123' }),
      ).rejects.toMatchObject({ status: 409 });

      jest.spyOn(prisma.producto, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.producto, 'update').mockResolvedValue({ idPro: 1 } as any);
      jest.spyOn(productosService, 'obtenerProducto').mockResolvedValue({ id: 'enc1', idPro: 1 } as any);
      const act = await productosService.actualizar(1, {
        nombre: 'Producto Actualizado',
        precio: 35,
        existencia: 8,
        idMarca: 1,
        idCat: 1,
      });
      expect(act?.id).toBeDefined();
    });

    it('presignImagen debe generar url o rechazar si producto no existe', async () => {
      jest.spyOn(productosService, 'obtenerProducto').mockResolvedValueOnce(null);
      await expect(productosService.presignImagen(1, 'image/png')).rejects.toMatchObject({ status: 404 });

      jest.spyOn(productosService, 'obtenerProducto').mockResolvedValueOnce({ idPro: 1, nombrePro: 'Galleta' } as any);
      const presign = await productosService.presignImagen(1, 'image/png', 'png');
      expect(presign.uploadUrl).toBeDefined();
    });

    it('confirmarImagen debe actualizar la URL y eliminar imagen anterior', async () => {
      jest.spyOn(prisma.producto, 'findUnique').mockResolvedValueOnce(null);
      await expect(productosService.confirmarImagen(1, 'key')).rejects.toMatchObject({ status: 404 });

      jest.spyOn(prisma.producto, 'findUnique').mockResolvedValue({
        idPro: 10,
        imagenPro: '/uploads/productos/antigua.jpg',
      } as any);
      jest.spyOn(prisma.producto, 'update').mockResolvedValue({} as any);
      jest.spyOn(productosService, 'obtenerProducto').mockResolvedValue({
        id: 'enc10',
        idPro: 10,
        imagen: 'https://s3/productos/nueva.jpg',
      } as any);

      const res = await productosService.confirmarImagen(10, 'https://s3/productos/nueva.jpg');
      expect(res?.imagen).toBe('https://s3/productos/nueva.jpg');

      const res2 = await productosService.confirmarImagen(10, 'productos/nueva.jpg');
      expect(res2?.imagen).toBe('https://s3/productos/nueva.jpg');
    });

    it('eliminar debe rechazar dependencias o eliminar con éxito', async () => {
      jest.spyOn(productosService, 'obtenerProducto').mockResolvedValueOnce(null);
      await expect(productosService.eliminar(5)).rejects.toMatchObject({ status: 404 });

      jest.spyOn(productosService, 'obtenerProducto').mockResolvedValue({
        idPro: 5,
        nombrePro: 'Producto Con Ventas',
        imagenPro: '/uploads/productos/foto.jpg',
      } as any);

      jest.spyOn(prisma.detVenta, 'count').mockResolvedValue(3);
      jest.spyOn(prisma.detCompra, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.detallePedidoCliente, 'count').mockResolvedValue(0);

      await expect(productosService.eliminar(5)).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining('No se puede eliminar'),
      });

      jest.spyOn(prisma.detVenta, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.producto, 'delete').mockResolvedValue({ idPro: 5 } as any);
      const res = await productosService.eliminar(5);
      expect(res.message).toBe('Producto eliminado correctamente');
    });
  });

  describe('consultarExterno (Open Food Facts)', () => {
    it('debe mapear respuesta de producto encontrado', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          product: {
            product_name: 'Nutella 350g',
            brands: 'Ferrero',
            categories: 'Untables',
            quantity: '350g',
            image_front_url: 'https://images.openfoodfacts.org/nutella.jpg',
          },
        }),
      });
      global.fetch = mockFetch as any;

      const resultado = await productosService.consultarExterno('750101112233');
      expect(resultado.encontrado).toBe(true);
      expect(resultado.nombre).toBe('Nutella 350g');
      expect(resultado.marca).toBe('Ferrero');
    });

    it('debe manejar producto no encontrado con 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as any;

      const resultado = await productosService.consultarExterno('0000000000');
      expect(resultado.encontrado).toBe(false);
    });

    it('debe manejar error 500 del proveedor', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as any;

      await expect(productosService.consultarExterno('0000000000')).rejects.toMatchObject({
        status: 502,
      });
    });
  });
});
