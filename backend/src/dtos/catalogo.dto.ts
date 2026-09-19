import { encodeId } from '../utils/formatters';

export const toMarcaDto = (marca: any) => {
  if (!marca) return null;
  return {
    id: encodeId(marca.idMarca),
    nombre: marca.nombreMarca,
    descripcion: marca.descripMarca,
  };
};

export const toCategoriaDto = (categoria: any) => {
  if (!categoria) return null;
  return {
    id: encodeId(categoria.idCat),
    nombre: categoria.nombreCat,
    descripcion: categoria.descripCat,
  };
};

export const toSucursalDto = (sucursal: any) => {
  if (!sucursal) return null;
  const d = sucursal.direccion;
  const direccionStr = d
    ? typeof d === 'string'
      ? d
      : [d.calle, [d.noExt, d.noInt].filter(Boolean).join(' '), d.colonia, d.municipio, d.estado, d.codPostal, d.pais]
          .filter(Boolean)
          .join(', ') || null
    : null;

  return {
    id: encodeId(sucursal.idSuc),
    nombre: sucursal.nombreSuc,
    descripcion: sucursal.descripcionSuc || null,
    telefono: sucursal.telefonoSuc || null,
    correo: sucursal.correoSuc || null,
    paginaWeb: sucursal.paginaWebSuc || null,
    redSocial: sucursal.redSocialSuc || null,
    logo: sucursal.logoSuc || null,
    direccion: direccionStr,
  };
};

export const toSucursalPublicaDto = (sucursal: any) => {
  if (!sucursal) return null;
  return {
    id: encodeId(sucursal.idSuc),
    nombre: sucursal.nombreSuc,
    descripcion: sucursal.descripcionSuc || null,
    logo: sucursal.logoSuc || null,
  };
};
