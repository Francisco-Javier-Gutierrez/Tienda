import { encodeId } from '../utils/formatters';

export function normalizarMerma(m: any) {
  if (!m) return null;

  return {
    id: encodeId(m.idMerma),
    uuidMerma: m.uuidMerma || null,
    idMerma: m.idMerma,
    sucursalId: encodeId(m.idSuc),
    idSuc: m.idSuc,
    empleadoId: encodeId(m.idEmp),
    empleadoNombre: m.empleadoNombre || 'Empleado',
    productoId: encodeId(m.idPro),
    idPro: m.idPro,
    productoNombre: m.productoNombre || 'Producto',
    codigoQR: m.codigoQR || null,
    cantidad: Number(m.cantidad || 0),
    tipo: m.tipo || 'OTRO',
    motivo: m.motivo || '',
    costoUnitario: Number(m.costoUnitario || 0),
    costoTotal: Number(m.costoTotal || 0),
    precioVentaUnitario: Number(m.precioVentaUnitario || 0),
    proveedorId: m.idProv ? encodeId(m.idProv) : null,
    proveedorNombre: m.proveedorNombre || null,
    estado: m.estado || 'APLICADO',
    fecha: m.fecha || (m.createdAt ? m.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    fechaHora: m.fechaHora || m.createdAt || new Date().toISOString(),
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export function normalizarMermas(lista: any[]) {
  return (lista || []).map(normalizarMerma).filter(Boolean);
}
