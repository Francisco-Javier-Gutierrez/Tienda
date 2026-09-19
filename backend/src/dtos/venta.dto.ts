import { formatearFechaVenta, formatearHoraVenta, encodeId } from '../utils/formatters';
import { empleadoSeguro } from '../utils/security';

export const normalizarDetalleVenta = (d: any) => {
  const prodId = encodeId(d.idPro || d.productoId || d.id);
  return {
    id: prodId,
    productoId: prodId,
    nombre: d.producto?.nombrePro || d.nombrePro || d.nombre || 'Producto',
    imagen: d.producto?.imagenPro || d.imagenPro || d.imagen || null,
    codigoQR: d.producto?.codigoQR || d.codigoQR || null,
    sku: d.producto?.skuPro || d.skuPro || null,
    cantidad: Number(d.cantidadDetVenta ?? d.cantidad ?? 0),
    precioUnitario: Number(d.precioUnitarioDetVenta ?? d.precioUnitario ?? 0),
    subtotal: Number(d.subtotalDetVenta ?? d.subtotal ?? 0),
  };
};

export const toVentaRegistradaDto = (v: any, empleado?: any) => {
  if (!v) return null;
  const ventaId = encodeId(v.idVenta);
  return {
    id: ventaId,
    uuid: v.uuidVenta,
    sesionCajaId: encodeId(v.idSesionCaja),
    fecha: formatearFechaVenta(v.fechaVenta),
    hora: formatearHoraVenta(v.horaVenta),
    total: Number(v.total ?? v.totalVenta ?? 0),
    metodoPago: v.metodoPago,
    montoRecibido: v.montoRecibido !== null && v.montoRecibido !== undefined ? Number(v.montoRecibido) : (v.pagoCon !== undefined ? Number(v.pagoCon) : null),
    cambio: Number(v.cambio || 0),
    estado: v.estadoVenta || 'COMPLETADA',
    cajero: { 
      id: encodeId(Number(v.idEmp)), 
      nombre: empleado ? empleadoSeguro(empleado).nombre : (v.empleado ? [v.empleado.nombreEmp, v.empleado.apellidoPatEmp, v.empleado.apellidoMatEmp].filter(Boolean).join(' ') : null)
    },
    items: (v.detalles || v.items)?.map(normalizarDetalleVenta) || [],
  };
};

export const toVentaListDto = (v: any) => {
  if (!v) return null;
  const origen = (v.pedidos && v.pedidos.length > 0) || v.origen === 'ONLINE' || v.idPedido ? 'ONLINE' : 'POS';
  const cajeroStr = v.empleado
    ? [v.empleado.nombreEmp, v.empleado.apellidoPatEmp, v.empleado.apellidoMatEmp].filter(Boolean).join(' ')
    : (v.empleadoNombre || (origen === 'ONLINE' ? 'Pedido Online' : null));

  const ventaId = encodeId(v.idVenta);
  return {
    id: ventaId,
    uuid: v.uuidVenta || `venta-${v.idVenta}`,
    sesionCajaId: v.idSesionCaja ? encodeId(v.idSesionCaja) : null,
    fecha: formatearFechaVenta(v.fechaVenta),
    hora: formatearHoraVenta(v.horaVenta || v.fechaVenta),
    total: Number(v.total ?? v.totalVenta ?? 0),
    metodoPago: v.metodoPago || 'EFECTIVO',
    estado: v.estadoVenta || 'COMPLETADA',
    origen,
    cajero: cajeroStr,
  };
};

export const toVentaDetalleDto = (v: any) => {
  if (!v) return null;
  
  const origen = (v.pedidos && v.pedidos.length > 0) || v.origen === 'ONLINE' || v.idPedido ? 'ONLINE' : 'POS';
  const cajeroStr = v.empleado
    ? [v.empleado.nombreEmp, v.empleado.apellidoPatEmp, v.empleado.apellidoMatEmp].filter(Boolean).join(' ')
    : (v.empleadoNombre || (origen === 'ONLINE' ? 'Pedido Online' : null));
  const canceladorStr = v.empleadoCancela
    ? [v.empleadoCancela.nombreEmp, v.empleadoCancela.apellidoPatEmp, v.empleadoCancela.apellidoMatEmp].filter(Boolean).join(' ')
    : null;

  const ventaId = encodeId(v.idVenta);
  return {
    id: ventaId,
    uuid: v.uuidVenta || `venta-${v.idVenta}`,
    sesionCajaId: v.idSesionCaja ? encodeId(v.idSesionCaja) : null,
    fecha: formatearFechaVenta(v.fechaVenta),
    hora: formatearHoraVenta(v.horaVenta || v.fechaVenta),
    total: Number(v.total ?? v.totalVenta ?? 0),
    metodoPago: v.metodoPago || 'EFECTIVO',
    montoRecibido: v.montoRecibido !== null && v.montoRecibido !== undefined ? Number(v.montoRecibido) : (v.pagoCon !== undefined ? Number(v.pagoCon) : null),
    cambio: Number(v.cambio || 0),
    estado: v.estadoVenta || 'COMPLETADA',
    fechaCancelacion: v.fechaCancelacion?.toISOString ? v.fechaCancelacion.toISOString() : (v.fechaCancelacion || null),
    motivoCancelacion: v.motivoCancelacion || null,
    cajeroCancela: canceladorStr,
    sucursal: v.sucursal?.nombreSuc || v.nombreSuc || 'Doña paty',
    origen,
    cajero: { id: encodeId(Number(v.idEmp)), nombre: cajeroStr },
    items: (v.detalles || v.items)?.map(normalizarDetalleVenta) || [],
  };
};
