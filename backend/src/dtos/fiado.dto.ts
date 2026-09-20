import { encodeId } from '../utils/formatters';

export function normalizarClienteDeudor(c: any) {
  if (!c) return null;

  return {
    id: encodeId(c.idCliente),
    idCliente: c.idCliente,
    nombreCompleto: [c.nombreCliente, c.apellidoPatCliente, c.apellidoMatCliente].filter(Boolean).join(' '),
    nombre: c.nombreCliente,
    apellidoPat: c.apellidoPatCliente || '',
    apellidoMat: c.apellidoMatCliente || '',
    correo: c.correoCliente || null,
    telefono: c.telefono || null,
    saldoDeudor: Number(c.saldoDeudor || 0),
    limiteCredito: c.limiteCredito !== undefined && c.limiteCredito !== null ? Number(c.limiteCredito) : null,
    ultimoAbono: c.ultimoAbono || null,
    ultimoCargo: c.ultimoCargo || null,
    estadoCliente: c.estadoCliente !== false,
  };
}

export function normalizarClientesDeudores(lista: any[]) {
  return (lista || []).map(normalizarClienteDeudor).filter(Boolean);
}

export function normalizarMovimientoCuenta(m: any) {
  if (!m) return null;

  return {
    id: encodeId(m.idMov),
    idMov: m.idMov,
    uuidMov: m.uuidMov || null,
    clienteId: encodeId(m.idCliente),
    idCliente: m.idCliente,
    clienteNombre: m.clienteNombre || 'Cliente',
    tipo: m.tipo,
    monto: Number(m.monto || 0),
    saldoAnterior: Number(m.saldoAnterior || 0),
    saldoNuevo: Number(m.saldoNuevo || 0),
    idVenta: m.idVenta ? encodeId(m.idVenta) : null,
    folioVenta: m.idVenta || null,
    idSesionCaja: m.idSesionCaja ? encodeId(m.idSesionCaja) : null,
    concepto: m.concepto || '',
    metodoPago: m.metodoPago || null,
    empleadoId: m.idEmp ? encodeId(m.idEmp) : null,
    empleadoNombre: m.empleadoNombre || 'Cajero',
    fechaHora: m.fechaHora || m.createdAt || new Date().toISOString(),
    fecha: m.fecha || (m.fechaHora ? m.fechaHora.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    createdAt: m.createdAt,
  };
}

export function normalizarMovimientosCuenta(lista: any[]) {
  return (lista || []).map(normalizarMovimientoCuenta).filter(Boolean);
}
