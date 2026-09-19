import { env } from '../../config/env';
import { extensionesImagen, generarPresignedUpload, s3Bucket, s3Region } from '../../config/s3';
import { tiendaUploadDir } from '../../middlewares/upload.middleware';
import { eliminarUploadControlado } from '../productos/productos.service';
import { texto, textoNullable, errorFuncional } from '../../utils/formatters';
import { toMarcaDto, toCategoriaDto, toSucursalDto, toSucursalPublicaDto } from '../../dtos/catalogo.dto';
import { catalogoRepository } from '../../db/repositories/catalogo.repository';
import { sucursalRepository } from '../../db/repositories/sucursal.repository';

export function validarSucursal(sucursal: any): string | null {
  const nombre = texto(sucursal.nombreSuc || sucursal.nombre);
  if (!nombre) return 'El nombre de la sucursal es obligatorio';
  const limites: Record<string, number> = {
    nombreSuc: 100,
    descripcionSuc: 255,
    telefonoSuc: 15,
    correoSuc: 100,
    paginaWebSuc: 100,
    redSocialSuc: 100,
  };
  const mapeados: Record<string, any> = {
    nombreSuc: sucursal.nombreSuc || sucursal.nombre,
    descripcionSuc: sucursal.descripcionSuc ?? sucursal.descripcion,
    telefonoSuc: sucursal.telefonoSuc ?? sucursal.telefono,
    correoSuc: sucursal.correoSuc ?? sucursal.correo,
    paginaWebSuc: sucursal.paginaWebSuc ?? sucursal.paginaWeb,
    redSocialSuc: sucursal.redSocialSuc ?? sucursal.redSocial,
  };
  for (const [campo, limite] of Object.entries(limites)) {
    if (texto(mapeados[campo]).length > limite) {
      return `El campo ${campo} no puede superar ${limite} caracteres`;
    }
  }
  const correo = texto(mapeados.correoSuc);
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return 'El correo no tiene un formato válido';
  }
  const paginaWeb = texto(mapeados.paginaWebSuc);
  if (paginaWeb) {
    try {
      const url = new URL(paginaWeb);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return 'La página web debe usar http o https';
      }
    } catch {
      return 'La página web no es una URL válida';
    }
  }
  return null;
}

export class CatalogosService {
  // MARCAS
  async listarMarcas() {
    const marcas = await catalogoRepository.listMarcas();
    return marcas.map(toMarcaDto);
  }

  async crearMarca(nombre: string, descripcion?: string | null) {
    const nombreLimpio = texto(nombre);
    if (!nombreLimpio) {
      throw errorFuncional('El nombre de la marca es obligatorio', 400);
    }
    const marca = await catalogoRepository.createMarca({ nombreMarca: nombreLimpio, descripMarca: descripcion || undefined });
    return toMarcaDto(marca);
  }

  async actualizarMarca(idMarca: number, nombre: string, descripcion?: string | null) {
    const nombreLimpio = texto(nombre);
    if (!nombreLimpio) {
      throw errorFuncional('El nombre de la marca es obligatorio', 400);
    }
    const marca = await catalogoRepository.updateMarca(idMarca, { nombreMarca: nombreLimpio, descripMarca: descripcion || undefined });
    return toMarcaDto(marca);
  }

  async eliminarMarca(idMarca: number) {
    await catalogoRepository.deleteMarca(idMarca);
    return { message: 'Marca eliminada correctamente' };
  }

  // CATEGORÍAS
  async listarCategorias() {
    const categorias = await catalogoRepository.listCategorias();
    return categorias.map(toCategoriaDto);
  }

  async crearCategoria(nombre: string, descripcion?: string | null) {
    const nombreLimpio = texto(nombre);
    if (!nombreLimpio) {
      throw errorFuncional('El nombre de la categoría es obligatorio', 400);
    }
    const categoria = await catalogoRepository.createCategoria({ nombreCat: nombreLimpio, descripCat: descripcion || undefined });
    return toCategoriaDto(categoria);
  }

  async actualizarCategoria(idCat: number, nombre: string, descripcion?: string | null) {
    const nombreLimpio = texto(nombre);
    if (!nombreLimpio) {
      throw errorFuncional('El nombre de la categoría es obligatorio', 400);
    }
    const categoria = await catalogoRepository.updateCategoria(idCat, { nombreCat: nombreLimpio, descripCat: descripcion || undefined });
    return toCategoriaDto(categoria);
  }

  async eliminarCategoria(idCat: number) {
    await catalogoRepository.deleteCategoria(idCat);
    return { message: 'Categoría eliminada correctamente' };
  }

  // SUCURSALES
  async obtenerSucursal(idSuc: number) {
    const s = await sucursalRepository.getById(idSuc);
    return toSucursalDto(s);
  }

  async listarSucursales() {
    const s = await sucursalRepository.getById(1);
    return s ? [toSucursalDto(s)] : [];
  }

  async crearSucursal(body: any) {
    const errorValidacion = validarSucursal(body);
    if (errorValidacion) {
      throw errorFuncional(errorValidacion, 400);
    }
    const datosNormalizados = {
      nombreSuc: texto(body.nombreSuc || body.nombre),
      descripcionSuc: textoNullable(body.descripcionSuc ?? body.descripcion),
      telefonoSuc: textoNullable(body.telefonoSuc ?? body.telefono),
      correoSuc: textoNullable(body.correoSuc ?? body.correo),
      paginaWebSuc: textoNullable(body.paginaWebSuc ?? body.paginaWeb),
      redSocialSuc: textoNullable(body.redSocialSuc ?? body.redSocial),
    };
    const creada = await sucursalRepository.create(datosNormalizados);
    return toSucursalDto(creada);
  }

  async actualizarSucursal(idSuc: number, body: any) {
    const errorValidacion = validarSucursal(body);
    if (errorValidacion) {
      throw errorFuncional(errorValidacion, 400);
    }
    const datosNormalizados = {
      nombreSuc: texto(body.nombreSuc || body.nombre),
      descripcionSuc: textoNullable(body.descripcionSuc ?? body.descripcion),
      telefonoSuc: textoNullable(body.telefonoSuc ?? body.telefono),
      correoSuc: textoNullable(body.correoSuc ?? body.correo),
      paginaWebSuc: textoNullable(body.paginaWebSuc ?? body.paginaWeb),
      redSocialSuc: textoNullable(body.redSocialSuc ?? body.redSocial),
    };
    await sucursalRepository.update(idSuc, datosNormalizados);
    return await this.obtenerSucursal(idSuc);
  }

  async presignLogo(idSuc: number, mimeType: string, nombreOriginal?: string) {
    const sucursal = await this.obtenerSucursal(idSuc);
    if (!sucursal) {
      throw errorFuncional('Sucursal no encontrada', 404);
    }
    const presigned = await generarPresignedUpload({
      folder: 'tienda',
      mimeType,
      nombreArchivoOriginal: nombreOriginal || undefined,
    });
    return { ...presigned, idSuc, expiresIn: 900 };
  }

  async confirmarLogo(idSuc: number, logoUrlInput: string) {
    const anterior = await this.obtenerSucursal(idSuc);
    if (!anterior) {
      throw errorFuncional('Sucursal no encontrada', 404);
    }

    const rutaFinal =
      logoUrlInput.startsWith('http://') || logoUrlInput.startsWith('https://') || logoUrlInput.startsWith('/uploads')
        ? logoUrlInput
        : `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${logoUrlInput}`;

    await sucursalRepository.updateLogo(idSuc, rutaFinal);

    if (anterior.logo && anterior.logo !== rutaFinal) {
      eliminarUploadControlado(anterior.logo, tiendaUploadDir, '/uploads/tienda/');
    }

    return await this.obtenerSucursal(idSuc);
  }

  async eliminarLogo(idSuc: number) {
    const anterior = await this.obtenerSucursal(idSuc);
    if (!anterior) {
      throw errorFuncional('Sucursal no encontrada', 404);
    }
    await sucursalRepository.updateLogo(idSuc, null);
    eliminarUploadControlado(anterior.logo, tiendaUploadDir, '/uploads/tienda/');
    return await this.obtenerSucursal(idSuc);
  }

  // CARGOS
  async listarCargos() {
    return await catalogoRepository.listCargos();
  }

  // TIENDA PÚBLICA
  async listarTiendaPublica() {
    const sucursales = await sucursalRepository.getPublic(1);
    return sucursales.map(toSucursalPublicaDto).filter(Boolean);
  }
}

export const catalogosService = new CatalogosService();
