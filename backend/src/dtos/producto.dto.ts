import { encodeId } from '../utils/formatters';

export const toProductoDto = (producto: any) => {
  if (!producto) return null;
  return {
    id: encodeId(producto.idPro),
    nombre: producto.nombrePro,
    precioVenta: Number(producto.precioVentaPro),
    costo: producto.costoPro !== null && producto.costoPro !== undefined ? Number(producto.costoPro) : null,
    existencia: producto.existenciaPro,
    stockMinimo: producto.stockMinimoPro,
    tamano: producto.tamanoPro,
    presentacion: producto.presentacionPro,
    tipo: producto.tipoPro,
    codigoQR: producto.codigoQR,
    sku: producto.skuPro,
    imagen: producto.imagenPro,
    activo: producto.activoPro,
    marca: producto.marca || producto.nombreMarca ? {
      id: encodeId(producto.idMarca || producto.marca?.idMarca) || null,
      nombre: producto.marca?.nombreMarca || producto.nombreMarca || null
    } : null,
    categoria: producto.categoria || producto.nombreCat ? {
      id: encodeId(producto.idCat || producto.categoria?.idCat) || null,
      nombre: producto.categoria?.nombreCat || producto.nombreCat || null
    } : null,
  };
};

export const toProductoListDto = (producto: any) => {
  if (!producto) return null;
  return {
    id: encodeId(producto.idPro),
    nombre: producto.nombrePro,
    precioVenta: Number(producto.precioVentaPro),
    costo: producto.costoPro !== null && producto.costoPro !== undefined ? Number(producto.costoPro) : null,
    existencia: producto.existenciaPro || 0,
    stockMinimo: producto.stockMinimoPro,
    codigoQR: producto.codigoQR,
    sku: producto.skuPro,
    imagen: producto.imagenPro,
    tamano: producto.tamanoPro,
    presentacion: producto.presentacionPro,
    marca: producto.marca || producto.nombreMarca ? {
      id: encodeId(producto.idMarca || producto.marca?.idMarca) || null,
      nombre: producto.marca?.nombreMarca || producto.nombreMarca || null
    } : null,
    categoria: producto.categoria || producto.nombreCat ? {
      id: encodeId(producto.idCat || producto.categoria?.idCat) || null,
      nombre: producto.categoria?.nombreCat || producto.nombreCat || null
    } : null,
  };
};
