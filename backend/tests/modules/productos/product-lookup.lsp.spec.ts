import {
  BaseProductLookupProvider,
  CompositeProductLookupProvider,
  ExternalProductResult,
} from '../../../src/modules/productos/product-lookup.provider';

class MockBarcodeProvider extends BaseProductLookupProvider {
  readonly nombreProveedor = 'Mock Barcode System';

  constructor(private mockData: Record<string, Partial<ExternalProductResult>>) {
    super();
  }

  protected async buscarEnFuente(codigo: string): Promise<ExternalProductResult | null> {
    const item = this.mockData[codigo];
    if (!item) return null;
    return {
      encontrado: true,
      fuente: this.nombreProveedor,
      codigoQR: codigo,
      nombre: item.nombre,
      marca: item.marca,
      categoria: item.categoria,
    };
  }
}

class FaultyProvider extends BaseProductLookupProvider {
  readonly nombreProveedor = 'Faulty Provider';

  protected async buscarEnFuente(_codigo: string): Promise<ExternalProductResult | null> {
    throw new Error('Conexión perdida con la base de datos externa');
  }
}

describe('Liskov Substitution Principle (LSP) - Product Lookup Providers', () => {
  it('BaseProductLookupProvider maneja códigos vacíos garantizando el contrato de salida', async () => {
    const provider = new MockBarcodeProvider({});

    const resVacio = await provider.consultar('');
    expect(resVacio).toEqual({
      encontrado: false,
      fuente: 'Mock Barcode System',
      codigoQR: '',
    });

    const resEspacios = await provider.consultar('   ');
    expect(resEspacios).toEqual({
      encontrado: false,
      fuente: 'Mock Barcode System',
      codigoQR: '',
    });
  });

  it('un proveedor subtipo sustituye limpiamente a otro dentro de CompositeProductLookupProvider', async () => {
    const mockProvider = new MockBarcodeProvider({
      '7501055301234': {
        nombre: 'Cereal de Trigo',
        marca: 'Kelloggs',
        categoria: 'Cereales',
      },
    });

    const composite = new CompositeProductLookupProvider([mockProvider]);
    const res = await composite.consultar('7501055301234');

    expect(res.encontrado).toBe(true);
    expect(res.nombre).toBe('Cereal de Trigo');
    expect(res.fuente).toBe('Mock Barcode System');
  });

  it('normaliza errores inesperados de la fuente a error 502 uniforme', async () => {
    const faulty = new FaultyProvider();
    await expect(faulty.consultar('123456')).rejects.toMatchObject({
      status: 502,
      message: 'El proveedor de información no está disponible',
    });
  });
});
