import { formatearFechaVenta, formatearHoraVenta, encodeId } from '../utils/formatters';
import { empleadoSeguro } from '../utils/security';

export const toVentaRegistradaDto = (v: any, empleado?: any) => {
  if (!v) return null;
  return {
    id: encodeId(v.idVenta),
    uuid: v.uuidVenta,
    sesionCajaId: encodeId(v.idSesionCaja),
    fecha: formatearFechaVenta(v.fechaVenta),
    hora: formatearHoraVenta(v.horaVenta),
    total: Number(v.total),
    metodoPago: v.metodoPago,
    montoRecibido: v.montoRecibido !== null && v.montoRecibido !== undefined ? Number(v.montoRecibido) : null,
    cambio: Number(v.cambio),
    estado: v.estadoVenta,
    cajero: { 
      id: encodeId(Number(v.idEmp)), 
      nombre: empleado ? empleadoSeguro(empleado).nombre : (v.empleado ? [v.empleado.nombreEmp, v.empleado.apellidoPatEmp, v.empleado.apellidoMatEmp].filter(Boolean).join(' ') : null)
    },
    items: v.detalles?.map((d: any) => ({
      id: encodeId(d.idPro),
      nombre: d.producto?.nombrePro || 'Producto',
      cantidad: d.cantidadDetVenta,
      precioUnitario: Number(d.precioUnitarioDetVenta),
      subtotal: Number(d.subtotalDetVenta),
    })) || [],
  };
};

export const toVentaListDto = (v: any) => {
  if (!v) return null;
  const cajeroStr = v.empleado
    ? [v.empleado.nombreEmp, v.empleado.apellidoPatEmp, v.empleado.apellidoMatEmp].filter(Boolean).join(' ')
    : null;
  const origen = v.pedidos && v.pedidos.length > 0 ? 'ONLINE' : 'POS';

  return {
    id: encodeId(v.idVenta),
    uuid: v.uuidVenta,
    sesionCajaId: encodeId(v.idSesionCaja),
    fecha: formatearFechaVenta(v.fechaVenta),
    hora: formatearHoraVenta(v.horaVenta),
    total: Number(v.total),
    metodoPago: v.metodoPago,
    estado: v.estadoVenta,
    origen,
    cajero: cajeroStr,
  };
};

export const toVentaDetalleDto = (v: any) => {
  if (!v) return null;
  
  const cajeroStr = v.empleado
    ? [v.empleado.nombreEmp, v.empleado.apellidoPatEmp, v.empleado.apellidoMatEmp].filter(Boolean).join(' ')
    : null;
  const canceladorStr = v.empleadoCancela
    ? [v.empleadoCancela.nombreEmp, v.empleadoCancela.apellidoPatEmp, v.empleadoCancela.apellidoMatEmp].filter(Boolean).join(' ')
    : null;
  const origen = v.pedidos && v.pedidos.length > 0 ? 'ONLINE' : 'POS';

  return {
    id: encodeId(v.idVenta),
    uuid: v.uuidVenta,
    sesionCajaId: encodeId(v.idSesionCaja),
    fecha: formatearFechaVenta(v.fechaVenta),
    hora: formatearHoraVenta(v.horaVenta),
    total: Number(v.total),
    metodoPago: v.metodoPago,
    montoRecibido: v.montoRecibido !== null && v.montoRecibido !== undefined ? Number(v.montoRecibido) : null,
    cambio: Number(v.cambio),
    estado: v.estadoVenta,
    fechaCancelacion: v.fechaCancelacion?.toISOString() || null,
    motivoCancelacion: v.motivoCancelacion,
    cajeroCancela: canceladorStr,
    sucursal: v.sucursal?.nombreSuc || null,
    origen,
    cajero: { id: encodeId(Number(v.idEmp)), nombre: cajeroStr },
    items: v.detalles?.map((d: any) => ({
      idDetalle: encodeId(d.idDetVenta),
      productoId: encodeId(d.idPro),
      nombre: d.producto?.nombrePro || 'Producto',
      codigoQR: d.producto?.codigoQR || null,
      sku: d.producto?.skuPro || null,
      cantidad: d.cantidadDetVenta,
      precioUnitario: Number(d.precioUnitarioDetVenta),
      subtotal: Number(d.subtotalDetVenta),
    })) || [],
  };
};
