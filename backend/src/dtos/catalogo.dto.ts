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
    ? [d.calle, [d.noExt, d.noInt].filter(Boolean).join(' '), d.colonia, d.municipio, d.estado, d.codPostal, d.pais]
        .filter(Boolean)
        .join(', ') || null
    : null;

  return {
    id: encodeId(sucursal.idSuc),
    nombre: sucursal.nombreSuc,
    descripcion: sucursal.descripcionSuc,
    telefono: sucursal.telefonoSuc,
    correo: sucursal.correoSuc,
    paginaWeb: sucursal.paginaWebSuc,
    redSocial: sucursal.redSocialSuc,
    logo: sucursal.logoSuc,
    direccion: direccionStr,
  };
};

export const toSucursalPublicaDto = (sucursal: any) => {
  if (!sucursal) return null;
  return {
    id: encodeId(sucursal.idSuc),
    nombre: sucursal.nombreSuc,
    descripcion: sucursal.descripcionSuc,
    logo: sucursal.logoSuc,
  };
};
