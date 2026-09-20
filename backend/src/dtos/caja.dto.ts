import { encodeId } from '../utils/formatters';

export function normalizarCaja(caja: any) {
  if (!caja) return null;
  const campos = [
    'fondoInicial',
    'totalVentas',
    'totalEfectivo',
    'totalTarjeta',
    'totalTransferencia',
    'totalIngresos',
    'totalRetiros',
    'efectivoEsperado',
    'efectivoContado',
    'diferencia',
  ];
  const resultado: any = {
    id: encodeId(caja.idSesionCaja),
    uuidSesionCaja: caja.uuidSesionCaja || caja.uuid || null,
    empleadoId: encodeId(caja.idEmp),
    sucursalId: encodeId(caja.idSuc),
    fechaHoraApertura: caja.fechaHoraApertura || caja.fechaApertura || null,
    fechaHoraCierre: caja.fechaHoraCierre || caja.fechaCierre || null,
    ...caja,
    empleado:
      caja.empleadoNombre ||
      (caja.empleado
        ? [caja.empleado.nombreEmp, caja.empleado.apellidoPatEmp, caja.empleado.apellidoMatEmp]
            .filter(Boolean)
            .join(' ')
        : null) ||
      'Cajero',
    nombreSuc: caja.sucursal?.nombreSuc || caja.nombreSuc || 'Doña paty',
  };
  for (const campo of campos) {
    resultado[campo] = resultado[campo] === null || resultado[campo] === undefined ? null : Number(resultado[campo]);
  }
  resultado.numeroVentas = Number(resultado.numeroVentas) || 0;

  delete resultado.idSesionCaja;
  delete resultado.idEmp;
  delete resultado.idSuc;
  return resultado;
}
