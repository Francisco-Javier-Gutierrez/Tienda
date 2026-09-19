import { env } from '../../config/env';
import { texto, errorFuncional } from '../../utils/formatters';

export interface ExternalProductResult {
  readonly encontrado: boolean;
  readonly mensaje?: string;
  readonly fuente?: string;
  readonly codigoQR?: string;
  readonly nombre?: string;
  readonly marca?: string;
  readonly categoria?: string;
  readonly tamano?: string;
  readonly presentacion?: string;
  readonly imagenUrl?: string;
}

export interface IProductLookupProvider {
  readonly nombreProveedor: string;
  consultar(codigo: string): Promise<ExternalProductResult | null>;
}

/**
 * BaseProductLookupProvider: Clase base abstracta que implementa el Principio de Sustitución
 * de Liskov (LSP) para proveedores de catálogos externos.
 * - Garantiza precondiciones uniformes (sanitización de códigos de barras).
 * - Garantiza postcondiciones uniformes (estructura normalizada e inmutable de ExternalProductResult).
 * - Todos los subtipos son 100% intercambiables dentro de CompositeProductLookupProvider.
 */
export abstract class BaseProductLookupProvider implements IProductLookupProvider {
  abstract readonly nombreProveedor: string;

  async consultar(codigo: string): Promise<ExternalProductResult | null> {
    const codigoNormalizado = String(codigo || '').trim();
    if (!codigoNormalizado) {
      return {
        encontrado: false,
        fuente: this.nombreProveedor,
        codigoQR: '',
      };
    }

    try {
      const parcial = await this.buscarEnFuente(codigoNormalizado);
      if (!parcial || !parcial.encontrado) {
        return {
          encontrado: false,
          fuente: this.nombreProveedor,
          codigoQR: codigoNormalizado,
        };
      }

      return {
        encontrado: true,
        fuente: parcial.fuente || this.nombreProveedor,
        codigoQR: codigoNormalizado,
        nombre: parcial.nombre,
        marca: parcial.marca,
        categoria: parcial.categoria,
        tamano: parcial.tamano,
        presentacion: parcial.presentacion,
        imagenUrl: parcial.imagenUrl,
      };
    } catch (err: any) {
      if (err && typeof err === 'object' && 'status' in err) {
        throw err;
      }
      throw errorFuncional('El proveedor de información no está disponible', 502);
    }
  }

  protected abstract buscarEnFuente(codigo: string): Promise<ExternalProductResult | null>;
}

/**
 * Proveedor de catálogo externo vía Open Food Facts API.
 * Hereda de BaseProductLookupProvider cumpliendo el principio LSP.
 */
export class OpenFoodFactsLookupProvider extends BaseProductLookupProvider {
  readonly nombreProveedor = 'Open Food Facts';

  protected async buscarEnFuente(codigo: string): Promise<ExternalProductResult | null> {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json`, {
      headers: {
        'User-Agent': env.OPEN_FOOD_FACTS_USER_AGENT,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw errorFuncional('El proveedor de información no está disponible', 502);
    }

    const data: any = await res.json();
    const producto = data?.product;
    if (!producto) {
      return null;
    }

    return {
      encontrado: true,
      fuente: this.nombreProveedor,
      codigoQR: codigo,
      nombre: texto(producto.product_name),
      marca: texto(producto.brands).split(',')[0],
      categoria: texto(producto.categories).split(',')[0],
      tamano: texto(producto.quantity),
      presentacion: texto(producto.quantity),
      imagenUrl: texto(producto.image_front_url),
    };
  }
}

/**
 * Cadena de proveedores de catálogo (Composite / Chain):
 * Permite agregar nuevos proveedores (UPCItemDB, Base Interna, BarcodeLookup)
 * sustituibles bajo LSP sin modificar ProductosService.
 */
export class CompositeProductLookupProvider {
  private providers: IProductLookupProvider[] = [];

  constructor(initialProviders?: IProductLookupProvider[]) {
    if (initialProviders) {
      this.providers = [...initialProviders];
    } else {
      this.providers.push(new OpenFoodFactsLookupProvider());
    }
  }

  registrarProveedor(provider: IProductLookupProvider): this {
    this.providers.push(provider);
    return this;
  }

  async consultar(codigo: string): Promise<ExternalProductResult> {
    for (const provider of this.providers) {
      const resultado = await provider.consultar(codigo);
      if (resultado && resultado.encontrado) {
        return resultado;
      }
    }

    return {
      encontrado: false,
      fuente: 'Open Food Facts',
      codigoQR: codigo,
    };
  }
}

export const defaultProductLookupProvider = new CompositeProductLookupProvider();
