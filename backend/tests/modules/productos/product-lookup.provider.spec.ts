import {
  OpenFoodFactsLookupProvider,
  CompositeProductLookupProvider,
  IProductLookupProvider,
  ExternalProductResult,
} from '../../../src/modules/productos/product-lookup.provider';

describe('ProductLookupProvider (Principio Open/Closed - OCP)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('OpenFoodFactsLookupProvider', () => {
    let provider: OpenFoodFactsLookupProvider;

    beforeEach(() => {
      provider = new OpenFoodFactsLookupProvider();
    });

    it('retorna información normalizada cuando Open Food Facts encuentra el producto', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          product: {
            product_name: 'Bebida Energética',
            brands: 'Monster, Energy',
            categories: 'Bebidas, Refrescos',
            quantity: '473 ml',
            image_front_url: 'https://images.openfoodfacts.org/monster.jpg',
          },
        }),
      } as any);

      const resultado = await provider.consultar('750100012345');

      expect(resultado).toEqual({
        encontrado: true,
        fuente: 'Open Food Facts',
        codigoQR: '750100012345',
        nombre: 'Bebida Energética',
        marca: 'Monster',
        categoria: 'Bebidas',
        tamano: '473 ml',
        presentacion: '473 ml',
        imagenUrl: 'https://images.openfoodfacts.org/monster.jpg',
      });
    });

    it('retorna no encontrado si la respuesta HTTP es 404', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 404,
        ok: false,
      } as any);

      const resultado = await provider.consultar('999999999');

      expect(resultado).toEqual({
        encontrado: false,
        fuente: 'Open Food Facts',
        codigoQR: '999999999',
      });
    });

    it('retorna no encontrado si data.product no existe en la respuesta', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ status_verbose: 'product not found' }),
      } as any);

      const resultado = await provider.consultar('111111');

      expect(resultado).toEqual({
        encontrado: false,
        fuente: 'Open Food Facts',
        codigoQR: '111111',
      });
    });

    it('lanza error funcional 502 cuando la API externa falla con 500', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 500,
        ok: false,
      } as any);

      await expect(provider.consultar('123456')).rejects.toMatchObject({
        status: 502,
        message: 'El proveedor de información no está disponible',
      });
    });
  });

  describe('CompositeProductLookupProvider (Chain / Composite OCP)', () => {
    it('consulta múltiples proveedores y retorna el primer resultado positivo', async () => {
      const provider1: IProductLookupProvider = {
        nombreProveedor: 'Proveedor Mock 1',
        consultar: jest.fn().mockResolvedValue({ encontrado: false }),
      };

      const provider2: IProductLookupProvider = {
        nombreProveedor: 'Proveedor Mock 2',
        consultar: jest.fn().mockResolvedValue({
          encontrado: true,
          fuente: 'Proveedor Mock 2',
          nombre: 'Producto Encontrado',
          codigoQR: '123',
        }),
      };

      const provider3: IProductLookupProvider = {
        nombreProveedor: 'Proveedor Mock 3',
        consultar: jest.fn(),
      };

      const composite = new CompositeProductLookupProvider([provider1, provider2, provider3]);
      const resultado = await composite.consultar('123');

      expect(resultado.encontrado).toBe(true);
      expect(resultado.nombre).toBe('Producto Encontrado');
      expect(provider1.consultar).toHaveBeenCalledWith('123');
      expect(provider2.consultar).toHaveBeenCalledWith('123');
      // No debió consultar provider3 porque provider2 ya encontró el producto
      expect(provider3.consultar).not.toHaveBeenCalled();
    });

    it('permite registrar nuevos proveedores dinámicamente mediante registrarProveedor', async () => {
      const composite = new CompositeProductLookupProvider([]);

      const customProvider: IProductLookupProvider = {
        nombreProveedor: 'UPC Database',
        consultar: jest.fn().mockResolvedValue({
          encontrado: true,
          fuente: 'UPC Database',
          nombre: 'Galletas de Avena',
          codigoQR: '777',
        }),
      };

      composite.registrarProveedor(customProvider);
      const res = await composite.consultar('777');

      expect(res.encontrado).toBe(true);
      expect(res.nombre).toBe('Galletas de Avena');
      expect(res.fuente).toBe('UPC Database');
    });

    it('retorna encontrado: false si ningún proveedor tiene el producto', async () => {
      const composite = new CompositeProductLookupProvider([]);
      const res = await composite.consultar('000');

      expect(res).toEqual({
        encontrado: false,
        fuente: 'Open Food Facts',
        codigoQR: '000',
      });
    });
  });
});
