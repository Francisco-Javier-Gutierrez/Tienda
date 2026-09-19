import { encodeId } from '../utils/formatters';

export function folioPedido(idPedido: number): string {
  return `PED-${String(idPedido).padStart(6, '0')}`;
}

export function normalizarConfiguracionTransferencia(row: any, incluirAdministrativo = false) {
  if (!row) return null;
  const configuracion = {
    banco: row.banco,
    titular: row.titular,
    clabe: row.clabe,
    numeroCuenta: row.numeroCuenta,
    instrucciones: row.instrucciones,
  };
  return incluirAdministrativo
    ? {
        idConfiguracion: Number(row.idConfiguracion),
        idSuc: Number(row.idSuc),
        ...configuracion,
        activo: Boolean(row.activo),
        fechaActualizacion: row.fechaActualizacion,
      }
    : configuracion;
}

export function normalizarDetallePedido(d: any) {
  const prodId = encodeId(d.idPro || d.id || d.productoId);
  return {
    id: prodId,
    productoId: prodId,
    nombre: d.producto?.nombrePro || d.nombrePro || d.nombre || 'Producto',
    imagen: d.producto?.imagenPro || d.imagenPro || d.imagen || null,
    presentacion: d.presentacion ?? ([d.producto?.tamanoPro, d.producto?.presentacionPro].filter(Boolean).join(' · ') || null),
    cantidad: Number(d.cantidad || 0),
    precioUnitario: Number(d.precioUnitario || 0),
    subtotal: Number(d.subtotal || 0),
  };
}

export function normalizarPedido(row: any) {
  const encodedId = encodeId(Number(row.idPedido));
  return {
    id: encodedId,
    folio: folioPedido(row.idPedido),
    uuidPedido: row.uuidPedido,
    fechaPedido: row.fechaPedido,
    fechaLimitePago: row.fechaLimitePago,
    estado: row.estado,
    total: Number(row.total),
    tieneComprobante: Boolean(row.comprobanteRuta),
    fechaComprobante: row.fechaComprobante || null,
    motivoRechazo: row.motivoRechazo || null,
    ventaId: row.idVenta === null || row.idVenta === undefined ? null : encodeId(Number(row.idVenta)),
    fechaRevision: row.fechaRevision || null,
  };
}

export function normalizarPedidoAdmin(row: any) {
  const clienteId = encodeId(Number(row.cliente?.idCliente || row.idCliente));
  return {
    ...normalizarPedido(row),
    cliente: {
      id: clienteId,
      nombre: [row.cliente?.nombreCliente, row.cliente?.apellidoPatCliente, row.cliente?.apellidoMatCliente]
        .filter(Boolean)
        .join(' '),
      correo: row.cliente?.correoCliente || '',
      foto: row.cliente?.fotoPerfil || null,
    },
  };
}

export function configuracionTransferenciaPedido(pedido: any) {
  const tieneSnapshot = [
    pedido.bancoSnapshot,
    pedido.titularSnapshot,
    pedido.clabeSnapshot,
    pedido.numeroCuentaSnapshot,
    pedido.instruccionesSnapshot,
  ].some((valor) => valor !== null && valor !== undefined);
  if (!tieneSnapshot) return null;
  return {
    banco: pedido.bancoSnapshot,
    titular: pedido.titularSnapshot,
    clabe: pedido.clabeSnapshot,
    numeroCuenta: pedido.numeroCuentaSnapshot,
    instrucciones: pedido.instruccionesSnapshot,
  };
}
