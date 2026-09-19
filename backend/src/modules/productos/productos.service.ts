import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';
import { productosUploadDir } from '../../middlewares/upload.middleware';
import { idValido, texto, textoNullable, errorFuncional } from '../../utils/formatters';
import { toProductoDto, toProductoListDto } from '../../dtos/producto.dto';
import { productoRepository, IProductoRepository } from '../../db/repositories/producto.repository';
import { catalogoRepository } from '../../db/repositories/catalogo.repository';
import { pedidoRepository } from '../../db/repositories/pedido.repository';
import { storageService, IStorageService } from '../../services/storage.service';
import { CompositeProductLookupProvider, defaultProductLookupProvider } from './product-lookup.provider';

export function validarProducto(producto: any): string | null {
  if (!texto(producto.nombre)) return 'El nombre del producto es obligatorio';
  const precio = producto.precio !== undefined ? producto.precio : producto.precioVenta;
  if (!Number.isFinite(Number(precio)) || Number(precio) < 0) {
    return 'El precio de venta debe ser un número mayor o igual a cero';
  }
  if (!Number.isInteger(Number(producto.existencia)) || Number(producto.existencia) < 0) {
    return 'La existencia debe ser un entero mayor o igual a cero';
  }
  if (
    producto.costo !== null &&
    producto.costo !== undefined &&
    producto.costo !== '' &&
    (!Number.isFinite(Number(producto.costo)) || Number(producto.costo) < 0)
  ) {
    return 'El costo debe ser un número mayor o igual a cero';
  }
  if (
    producto.stockMinimo !== null &&
    producto.stockMinimo !== undefined &&
    producto.stockMinimo !== '' &&
    (!Number.isInteger(Number(producto.stockMinimo)) || Number(producto.stockMinimo) < 0)
  ) {
    return 'El stock mínimo debe ser un entero mayor o igual a cero';
  }
  if (!idValido(producto.idMarca)) return 'Selecciona una marca válida';
  if (!idValido(producto.idCat)) return 'Selecciona una categoría válida';
  return null;
}

export function eliminarUploadControlado(
  rutaPublica?: string | null,
  directorio = productosUploadDir,
  prefijo = '/uploads/productos/',
): void {
  void storageService.eliminarArchivo(rutaPublica, directorio, prefijo);
}

/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - Catálogo de Productos
 * =========================================================================
 * - IProductoPublicService: Operaciones públicas para tienda/ecommerce
 * - IProductoAdminService: Operaciones de administración y gestión de inventario
 * - IProductoPosService: Operaciones de búsqueda por código y caja
 */
export interface IProductoPublicService {
  listarPublico(): Promise<any>;
  consultarExterno(codigo: string): Promise<any>;
}

export interface IProductoAdminService {
  listarAdmin(): Promise<any>;
  crear(body: any): Promise<any>;
  actualizar(idPro: number, body: any): Promise<any>;
  eliminar(idPro: number): Promise<any>;
}

export interface IProductoPosService {
  listarPos(): Promise<any>;
  buscarPorQR(codigoQR: string): Promise<any>;
  obtenerProducto(idPro: number): Promise<any>;
}

export interface IProductosService
  extends IProductoPublicService,
    IProductoAdminService,
    IProductoPosService {}

export class ProductosService implements IProductosService {
  constructor(
    private lookupProvider: CompositeProductLookupProvider = defaultProductLookupProvider,
    private repo: IProductoRepository = productoRepository,
    private storage: IStorageService = storageService,
  ) {}

  async obtenerProducto(idPro: number) {
    const p = await this.repo.getProductoById(idPro);
    if (!p) return null;
    let nombreMarca: string | null = null;
    let nombreCat: string | null = null;
    if (p.idMarca) {
      const m = await catalogoRepository.getMarcaById(p.idMarca);
      nombreMarca = m?.nombreMarca || null;
    }
    if (p.idCat) {
      const c = await catalogoRepository.getCategoriaById(p.idCat);
      nombreCat = c?.nombreCat || null;
    }
    return toProductoDto({ ...p, nombreMarca, nombreCat });
  }

  async validarCatalogosProducto(producto: any): Promise<string | null> {
    return null;
  }

  async codigoEnUso(codigoQR: string | null | undefined, idPro = 0): Promise<boolean> {
    const codigo = texto(codigoQR);
    if (!codigo) return false;
    const existente = await this.repo.findByCodigoQR(codigo);
    return Boolean(existente && existente.idPro !== Number(idPro));
  }

  async listarAdmin() {
    const [prods, marcas, cats] = await Promise.all([
      this.repo.listProductos(1),
      catalogoRepository.listMarcas(),
      catalogoRepository.listCategorias(),
    ]);
    const marcasMap = new Map(marcas.map((m) => [m.idMarca, m.nombreMarca]));
    const catsMap = new Map(cats.map((c) => [c.idCat, c.nombreCat]));
    return prods.map((p: any) =>
      toProductoListDto({
        ...p,
        nombreMarca: p.idMarca ? marcasMap.get(p.idMarca) : null,
        nombreCat: p.idCat ? catsMap.get(p.idCat) : null,
      }),
    );
  }

  async listarPos() {
    const [prods, marcas, cats] = await Promise.all([
      this.repo.listProductos(1, { soloActivos: true }),
      catalogoRepository.listMarcas(),
      catalogoRepository.listCategorias(),
    ]);
    const marcasMap = new Map(marcas.map((m) => [m.idMarca, m.nombreMarca]));
    const catsMap = new Map(cats.map((c) => [c.idCat, c.nombreCat]));
    return prods.map((p: any) =>
      toProductoListDto({
        ...p,
        nombreMarca: p.idMarca ? marcasMap.get(p.idMarca) : null,
        nombreCat: p.idCat ? catsMap.get(p.idCat) : null,
      }),
    );
  }

  async listarPublico() {
    const prods = await this.repo.listProductos(1, { soloActivos: true });
    return prods.map((p: any) => toProductoListDto(p));
  }

  async buscarPorQR(codigoQR: string) {
    const p = await this.repo.findByCodigoQR(codigoQR);
    if (!p) return null;
    return toProductoDto(p);
  }

  async consultarExterno(codigo: string) {
    return this.lookupProvider.consultar(codigo);
  }

  async crear(body: any) {
    const errorValidacion = validarProducto(body);
    if (errorValidacion) {
      throw errorFuncional(errorValidacion, 400);
    }

    const errorCatalogos = await this.validarCatalogosProducto(body);
    if (errorCatalogos) {
      throw errorFuncional(errorCatalogos, 400);
    }

    if (await this.codigoEnUso(body.codigoQR)) {
      throw errorFuncional('El código de barras ya pertenece a otro producto', 409);
    }

    const nuevo = await this.repo.createProducto({
      idSuc: 1,
      nombrePro: texto(body.nombre),
      precioVentaPro: Number(body.precio !== undefined ? body.precio : body.precioVenta),
      costoPro: body.costo !== null && body.costo !== undefined && body.costo !== '' ? Number(body.costo) : 0,
      existenciaPro: Number(body.existencia),
      stockMinimoPro: body.stockMinimo ? Number(body.stockMinimo) : 1,
      tamanoPro: textoNullable(body.tamano),
      presentacionPro: textoNullable(body.presentacion),
      tipoPro: textoNullable(body.tipo),
      codigoQR: textoNullable(body.codigoQR),
      skuPro: textoNullable(body.sku),
      imagenPro: textoNullable(body.imagen),
      idMarca: body.idMarca ? Number(idValido(body.idMarca)) : null,
      idCat: body.idCat ? Number(idValido(body.idCat)) : null,
      activoPro: true,
    });
    return await this.obtenerProducto(nuevo.idPro);
  }

  async actualizar(idPro: number, body: any) {
    const errorValidacion = validarProducto(body);
    if (errorValidacion) {
      throw errorFuncional(errorValidacion, 400);
    }

    const productoExistente = await this.obtenerProducto(idPro);
    if (!productoExistente) {
      throw errorFuncional('Producto no encontrado', 404);
    }

    const errorCatalogos = await this.validarCatalogosProducto(body);
    if (errorCatalogos) {
      throw errorFuncional(errorCatalogos, 400);
    }

    if (await this.codigoEnUso(body.codigoQR, idPro)) {
      throw errorFuncional('El código de barras ya pertenece a otro producto', 409);
    }

    // Preserve existing image if body.imagen is undefined (not sent)
    const imagenPro = body.imagen !== undefined ? textoNullable(body.imagen) : (productoExistente.imagen || null);
    const idMarca = body.idMarca !== undefined
      ? (body.idMarca ? Number(idValido(body.idMarca)) : null)
      : (productoExistente.idMarca ? Number(idValido(productoExistente.idMarca)) : null);
    const idCat = body.idCat !== undefined
      ? (body.idCat ? Number(idValido(body.idCat)) : null)
      : (productoExistente.idCat ? Number(idValido(productoExistente.idCat)) : null);

    await this.repo.updateProducto(idPro, {
      nombrePro: texto(body.nombre),
      precioVentaPro: Number(body.precio),
      costoPro: body.costo !== null && body.costo !== undefined && body.costo !== '' ? Number(body.costo) : 0,
      existenciaPro: Number(body.existencia),
      stockMinimoPro: body.stockMinimo ? Number(body.stockMinimo) : 1,
      tamanoPro: textoNullable(body.tamano),
      presentacionPro: textoNullable(body.presentacion),
      tipoPro: textoNullable(body.tipo),
      codigoQR: textoNullable(body.codigoQR),
      skuPro: textoNullable(body.sku),
      imagenPro,
      idMarca,
      idCat,
    });
    return await this.obtenerProducto(idPro);
  }

  async actualizarImagenLocal(idPro: number, filename: string, filePath?: string) {
    const productoExistente = await this.obtenerProducto(idPro);
    if (!productoExistente) {
      if (filePath) fs.unlink(filePath, () => undefined);
      throw errorFuncional('Producto no encontrado', 404);
    }

    const rutaPublica = `/uploads/productos/${filename}`;
    try {
      await this.repo.updateProducto(idPro, { imagenPro: rutaPublica });
      return await this.obtenerProducto(idPro);
    } catch (error) {
      if (filePath) fs.unlink(filePath, () => undefined);
      throw error;
    }
  }

  async presignImagen(idPro: number, mimeType: string, extension?: string) {
    const producto = await this.obtenerProducto(idPro);
    if (!producto) {
      throw errorFuncional('Producto no encontrado', 404);
    }
    return await this.storage.generarPresignedUpload({
      folder: 'productos',
      mimeType,
      extensionOriginal: extension,
      nombreArchivoOriginal: producto.nombre,
    });
  }

  async confirmarImagen(idPro: number, keyOUrl: string) {
    const anterior = await this.obtenerProducto(idPro);
    if (!anterior) {
      throw errorFuncional('Producto no encontrado', 404);
    }

    const rutaFinal = keyOUrl.startsWith('http')
      ? keyOUrl
      : `https://${env.AWS_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${keyOUrl}`;

    await this.repo.updateProducto(idPro, { imagenPro: rutaFinal });

    if (anterior.imagen && anterior.imagen !== rutaFinal) {
      void this.storage.eliminarArchivo(anterior.imagen, productosUploadDir, '/uploads/productos/');
    }

    return await this.obtenerProducto(idPro);
  }

  async eliminar(idPro: number) {
    const producto = await this.obtenerProducto(idPro);
    if (!producto) {
      throw errorFuncional('Producto no encontrado', 404);
    }

    if (producto.imagen) {
      void this.storage.eliminarArchivo(producto.imagen, productosUploadDir, '/uploads/productos/');
    }
    await this.repo.deleteProducto(idPro);
    return { message: 'Producto eliminado correctamente' };
  }
}

export const productosService = new ProductosService();
