import { encodeId } from '../utils/formatters';

export const toProductoDto = (producto: any) => {
  if (!producto) return null;
  const prodId = encodeId(producto.idPro);
  return {
    id: prodId,
    nombre: producto.nombrePro,
    precio: Number(producto.precioVentaPro),
    precioVenta: Number(producto.precioVentaPro),
    costo: producto.costoPro !== null && producto.costoPro !== undefined ? Number(producto.costoPro) : null,
    existencia: producto.existenciaPro ?? 0,
    stockMinimo: producto.stockMinimoPro !== null && producto.stockMinimoPro !== undefined ? Number(producto.stockMinimoPro) : null,
    tamano: producto.tamanoPro || null,
    presentacion: producto.presentacionPro || null,
    tipo: producto.tipoPro || null,
    codigoQR: producto.codigoQR || null,
    sku: producto.skuPro || null,
    imagen: producto.imagenPro || null,
    activo: Boolean(producto.activoPro),
    idMarca: encodeId(producto.idMarca || producto.marca?.idMarca || producto.marca?.id) || null,
    idCat: encodeId(producto.idCat || producto.categoria?.idCat || producto.categoria?.id) || null,
    marca: (producto.idMarca || producto.marca || producto.nombreMarca || producto.marcaNombre) ? {
      id: encodeId(producto.idMarca || producto.marca?.idMarca || producto.marca?.id) || null,
      nombre: producto.marca?.nombreMarca || producto.marca?.nombre || producto.nombreMarca || producto.marcaNombre || null
    } : null,
    categoria: (producto.idCat || producto.categoria || producto.nombreCat || producto.categoriaNombre) ? {
      id: encodeId(producto.idCat || producto.categoria?.idCat || producto.categoria?.id) || null,
      nombre: producto.categoria?.nombreCat || producto.categoria?.nombre || producto.nombreCat || producto.categoriaNombre || null
    } : null,
  };
};

export const toProductoListDto = (producto: any) => {
  if (!producto) return null;
  const prodId = encodeId(producto.idPro);
  return {
    id: prodId,
    nombre: producto.nombrePro,
    precio: Number(producto.precioVentaPro),
    precioVenta: Number(producto.precioVentaPro),
    costo: producto.costoPro !== null && producto.costoPro !== undefined ? Number(producto.costoPro) : null,
    existencia: producto.existenciaPro ?? 0,
    stockMinimo: producto.stockMinimoPro !== null && producto.stockMinimoPro !== undefined ? Number(producto.stockMinimoPro) : null,
    codigoQR: producto.codigoQR || null,
    sku: producto.skuPro || null,
    imagen: producto.imagenPro || null,
    tamano: producto.tamanoPro || null,
    presentacion: producto.presentacionPro || null,
    activo: Boolean(producto.activoPro),
    idMarca: encodeId(producto.idMarca || producto.marca?.idMarca || producto.marca?.id) || null,
    idCat: encodeId(producto.idCat || producto.categoria?.idCat || producto.categoria?.id) || null,
    marca: (producto.idMarca || producto.marca || producto.nombreMarca || producto.marcaNombre) ? {
      id: encodeId(producto.idMarca || producto.marca?.idMarca || producto.marca?.id) || null,
      nombre: producto.marca?.nombreMarca || producto.marca?.nombre || producto.nombreMarca || producto.marcaNombre || null
    } : null,
    categoria: (producto.idCat || producto.categoria || producto.nombreCat || producto.categoriaNombre) ? {
      id: encodeId(producto.idCat || producto.categoria?.idCat || producto.categoria?.id) || null,
      nombre: producto.categoria?.nombreCat || producto.categoria?.nombre || producto.nombreCat || producto.categoriaNombre || null
    } : null,
  };
};
