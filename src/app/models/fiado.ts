export interface ClienteDeudor {
  id: string;
  idCliente: number;
  nombreCompleto: string;
  nombre: string;
  apellidoPat?: string;
  apellidoMat?: string;
  telefono?: string | null;
  correo?: string | null;
  saldoDeudor: number;
  limiteCredito?: number | null;
  ultimoAbono?: string | null;
  ultimoCargo?: string | null;
}

export interface MovimientoCuenta {
  id: string;
  idMov: number;
  uuidMov?: string | null;
  clienteId: string;
  idCliente: number;
  clienteNombre: string;
  tipo: 'CARGO' | 'ABONO';
  monto: number;
  saldoAnterior: number;
  saldoNuevo: number;
  idVenta?: string | null;
  folioVenta?: number | null;
  idSesionCaja?: string | null;
  concepto: string;
  metodoPago?: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | null;
  empleadoNombre: string;
  fechaHora: string;
  fecha: string;
  createdAt?: string;
}

export interface FiadoResumen {
  totalDeuda: number;
  totalDeudores: number;
  deudaPromedio: number;
  topDeudores: ClienteDeudor[];
}

export interface RegistrarAbonoDto {
  uuidAbono?: string;
  monto: number;
  metodoPago: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
  concepto?: string;
}

export interface CrearClienteRapidoDto {
  nombreCliente: string;
  apellidoPatCliente?: string;
  telefono: string;
  limiteCredito?: number | null;
}
