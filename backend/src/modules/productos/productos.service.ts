import fs from 'fs';
import path from 'path';
import { prisma, DbClient } from '../../config/prisma';
import { env } from '../../config/env';
import { eliminarObjetoS3, esUrlS3, generarPresignedUpload } from '../../config/s3';
import { productosUploadDir } from '../../middlewares/upload.middleware';
import { idValido, texto, textoNullable, errorFuncional } from '../../utils/formatters';
import { toProductoDto, toProductoListDto } from '../../dtos/producto.dto';

export function validarProducto(producto: any): string | null {
  if (!texto(producto.nombre)) return 'El nombre del producto es obligatorio';
  if (!Number.isFinite(Number(producto.precio)) || Number(producto.precio) < 0) {
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
  if (!rutaPublica) return;
  if (esUrlS3(rutaPublica)) {
    void eliminarObjetoS3(rutaPublica);
    return;
  }
  if (!rutaPublica.startsWith(prefijo)) return;
  const nombre = path.basename(rutaPublica);
  const ruta = path.join(directorio, nombre);
  if (path.dirname(ruta) === directorio) fs.unlink(ruta, () => undefined);
}

export class ProductosService {
  async obtenerProducto(idPro: number, client: DbClient = prisma) {
    const p = await client.producto.findUnique({
      where: { idPro },
      include: {
        marca: true,
        categoria: true,
      },
    });
    if (!p) return null;
    return toProductoDto(p);
  }

  async validarCatalogosProducto(producto: any): Promise<string | null> {
    const [marca, categoria] = await Promise.all([
      producto.idMarca ? prisma.marca.findUnique({ where: { idMarca: idValido(producto.idMarca)! } }) : null,
      producto.idCat ? prisma.categoria.findUnique({ where: { idCat: idValido(producto.idCat)! } }) : null,
    ]);
    if (producto.idMarca && !marca) return 'La marca seleccionada no existe';
    if (producto.idCat && !categoria) return 'La categoría seleccionada no existe';
    return null;
  }

  async codigoEnUso(codigoQR: string | null | undefined, idPro = 0): Promise<boolean> {
    const codigo = texto(codigoQR);
    if (!codigo) return false;
    const existente = await prisma.producto.findFirst({
      where: {
        codigoQR: codigo,
        NOT: { idPro: Number(idPro) },
      },
      select: { idPro: true },
    });
    return Boolean(existente);
  }

  async listarAdmin() {
    const productos = await prisma.producto.findMany({
      orderBy: { nombrePro: 'asc' },
      include: {
        marca: true,
        categoria: true,
      },
    });
    return productos.map((p) => toProductoListDto(p));
  }

  async listarPos() {
    const productos = await prisma.producto.findMany({
      where: { activoPro: true },
      orderBy: [{ nombrePro: 'asc' }, { idPro: 'asc' }],
      include: {
        marca: true,
        categoria: true,
      },
    });
    return productos.map((p) => toProductoListDto(p));
  }

  async listarPublico() {
    const productos = await prisma.producto.findMany({
      where: { activoPro: true },
      orderBy: { nombrePro: 'asc' },
      include: {
        marca: true,
        categoria: true,
      },
    });
    return productos.map((p) => toProductoListDto(p));
  }

  async buscarPorQR(codigoQR: string) {
    const p = await prisma.producto.findUnique({
      where: { codigoQR },
      include: {
        marca: true,
        categoria: true,
      },
    });
    if (!p) return null;
    return toProductoDto(p);
  }

  async consultarExterno(codigo: string) {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json`, {
      headers: {
        'User-Agent': env.OPEN_FOOD_FACTS_USER_AGENT,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 404) {
      return { encontrado: false, fuente: 'Open Food Facts', codigoQR: codigo };
    }
    if (!response.ok) {
      throw errorFuncional('El proveedor de información no está disponible', 502);
    }

    const data: any = await response.json();
    const producto = data.product;
    if (!producto) {
      return { encontrado: false, fuente: 'Open Food Facts', codigoQR: codigo };
    }

    return {
      encontrado: true,
      fuente: 'Open Food Facts',
      codigoQR: codigo,
      nombre: texto(producto.product_name),
      marca: texto(producto.brands).split(',')[0],
      categoria: texto(producto.categories).split(',')[0],
      tamano: texto(producto.quantity),
      presentacion: texto(producto.quantity),
      imagenUrl: texto(producto.image_front_url),
    };
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

    const nuevo = await prisma.producto.create({
      data: {
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
        imagenPro: textoNullable(body.imagen),
        idMarca: body.idMarca ? idValido(body.idMarca) : null,
        idCat: body.idCat ? idValido(body.idCat) : null,
      },
    });

    return await this.obtenerProducto(nuevo.idPro);
  }

  async actualizar(idPro: number, body: any) {
    const errorValidacion = validarProducto(body);
    if (errorValidacion) {
      throw errorFuncional(errorValidacion, 400);
    }

    if (!(await this.obtenerProducto(idPro))) {
      throw errorFuncional('Producto no encontrado', 404);
    }

    const errorCatalogos = await this.validarCatalogosProducto(body);
    if (errorCatalogos) {
      throw errorFuncional(errorCatalogos, 400);
    }

    if (await this.codigoEnUso(body.codigoQR, idPro)) {
      throw errorFuncional('El código de barras ya pertenece a otro producto', 409);
    }

    await prisma.producto.update({
      where: { idPro },
      data: {
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
        imagenPro: textoNullable(body.imagen),
        idMarca: body.idMarca ? idValido(body.idMarca) : null,
        idCat: body.idCat ? idValido(body.idCat) : null,
      },
    });

    return await this.obtenerProducto(idPro);
  }

  async presignImagen(idPro: number, mimeType: string, extension?: string) {
    const producto = await this.obtenerProducto(idPro);
    if (!producto) {
      throw errorFuncional('Producto no encontrado', 404);
    }
    return await generarPresignedUpload({
      folder: 'productos',
      mimeType,
      extensionOriginal: extension,
      nombreArchivoOriginal: producto.nombre,
    });
  }

  async confirmarImagen(idPro: number, keyOUrl: string) {
    const anterior = await prisma.producto.findUnique({ where: { idPro } });
    if (!anterior) {
      throw errorFuncional('Producto no encontrado', 404);
    }

    const rutaFinal = keyOUrl.startsWith('http')
      ? keyOUrl
      : `https://${env.AWS_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${keyOUrl}`;

    await prisma.producto.update({
      where: { idPro },
      data: { imagenPro: rutaFinal },
    });

    if (anterior.imagenPro && anterior.imagenPro !== rutaFinal) {
      eliminarUploadControlado(anterior.imagenPro, productosUploadDir, '/uploads/productos/');
    }

    return await this.obtenerProducto(idPro);
  }

  async eliminar(idPro: number) {
    const producto = await this.obtenerProducto(idPro);
    if (!producto) {
      throw errorFuncional('Producto no encontrado', 404);
    }

    const [ventas, compras, pedidos] = await Promise.all([
      prisma.detVenta.count({ where: { idPro } }),
      prisma.detCompra.count({ where: { idPro } }),
      prisma.detallePedidoCliente.count({ where: { idPro } }),
    ]);

    if (ventas > 0 || compras > 0 || pedidos > 0) {
      const error: any = new Error(
        'No se puede eliminar el producto porque tiene ventas, compras o pedidos relacionados',
      );
      error.status = 409;
      throw error;
    }

    if (producto.imagen) {
      eliminarUploadControlado(producto.imagen, productosUploadDir, '/uploads/productos/');
    }

    await prisma.producto.delete({ where: { idPro } });
    return { message: 'Producto eliminado correctamente' };
  }
}

export const productosService = new ProductosService();






