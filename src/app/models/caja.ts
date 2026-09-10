export type EstadoCaja = 'ABIERTA' | 'CERRADA';
export type TipoMovimiento = 'INGRESO' | 'RETIRO';
export interface Caja {
  id: string;
  uuidSesionCaja: string;
  empleadoId: string;
  sucursalId: string;
  fechaHoraApertura: string;
  fondoInicial: number;
  fechaHoraCierre: string | null;
  totalVentas: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
  totalIngresos: number;
  totalRetiros: number;
  efectivoEsperado: number;
  efectivoContado: number | null;
  diferencia: number;
  numeroVentas: number;
  estado: EstadoCaja;
  observaciones: string | null;
  empleado: string;
  nombreSuc: string;
}
export interface MovimientoCaja {
  id: string;
  uuidMovimientoCaja: string;
  idSesionCaja: string;
  idEmp: string;
  tipoMovimiento: TipoMovimiento;
  monto: number;
  concepto: string;
  fechaHora: string;
}
