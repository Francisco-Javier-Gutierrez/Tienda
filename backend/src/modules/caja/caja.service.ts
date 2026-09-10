import { prisma, DbClient } from '../../config/prisma';
import { errorFuncional, idValido,
  encodeId, texto, dineroCentavos, uuidValido } from '../../utils/formatters';

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
    empleadoId: encodeId(caja.idEmp),
    sucursalId: encodeId(caja.idSuc),
    ...caja,
    empleado: caja.empleado
      ? [caja.empleado.nombreEmp, caja.empleado.apellidoPatEmp, caja.empleado.apellidoMatEmp].filter(Boolean).join(' ')
      : null,
    nombreSuc: caja.sucursal?.nombreSuc || null,
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

export class CajaService {
  async obtenerCajaActual(idEmp: number, client: DbClient = prisma) {
    const row = await client.sesionCaja.findFirst({
      where: {
        idEmp: Number(idEmp),
        estado: 'ABIERTA',
      },
      orderBy: { idSesionCaja: 'desc' },
      include: {
        empleado: true,
        sucursal: true,
      },
    });
    return normalizarCaja(row);
  }

  async calcularResumenCaja(caja: any, client: DbClient = prisma) {
    const idSesionCaja = caja?.idSesionCaja ?? idValido(caja?.id);
    if (!idSesionCaja) {
      throw errorFuncional('Sesión de caja no válida', 400);
    }

    const [ventas, movimientos] = await Promise.all([
      client.venta.findMany({
        where: {
          idSesionCaja,
          estadoVenta: 'COMPLETADA',
        },
        select: {
          total: true,
          metodoPago: true,
        },
      }),
      client.movimientoCaja.findMany({
        where: {
          idSesionCaja,
        },
        select: {
          tipoMovimiento: true,
          monto: true,
        },
      }),
    ]);

    let totalVentas = 0;
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    const numeroVentas = ventas.length;

    for (const v of ventas) {
      const tot = Number(v.total);
      totalVentas += tot;
      if (v.metodoPago === 'EFECTIVO') totalEfectivo += tot;
      else if (v.metodoPago === 'TARJETA') totalTarjeta += tot;
      else if (v.metodoPago === 'TRANSFERENCIA') totalTransferencia += tot;
    }

    let totalIngresos = 0;
    let totalRetiros = 0;

    for (const m of movimientos) {
      const monto = Number(m.monto);
      if (m.tipoMovimiento === 'INGRESO') totalIngresos += monto;
      else if (m.tipoMovimiento === 'RETIRO') totalRetiros += monto;
    }

    const fondoInicial = Number(caja.fondoInicial) || 0;
    const efectivoEsperado = fondoInicial + totalEfectivo + totalIngresos - totalRetiros;

    return {
      ...caja,
      totalVentas,
      totalEfectivo,
      totalTarjeta,
      totalTransferencia,
      numeroVentas,
      totalIngresos,
      totalRetiros,
      efectivoEsperado,
    };
  }

  async abrirCaja(idEmp: number, idSuc: number, uuidInput: string, fondoInicialInput: number | string) {
    const uuid = uuidValido(uuidInput);
    const fondo = dineroCentavos(fondoInicialInput);
    if (!uuid) throw errorFuncional('uuidSesionCaja no es válido', 400);
    if (fondo === null || fondo < 0) throw errorFuncional('El fondo inicial no es válido', 400);

    return await prisma.$transaction(async (tx) => {
      const repetida = await tx.sesionCaja.findUnique({
        where: { uuidSesionCaja: uuid },
        include: { empleado: true, sucursal: true },
      });
      if (repetida) {
        if (Number(repetida.idEmp) !== Number(idEmp) || Number(repetida.idSuc) !== Number(idSuc)) {
          throw errorFuncional('El identificador de caja ya está en uso.', 409);
        }
        return normalizarCaja(repetida);
      }

      const activa = await tx.sesionCaja.findFirst({
        where: {
          idEmp: Number(idEmp),
          estado: 'ABIERTA',
        },
      });
      if (activa) {
        throw errorFuncional('Ya tienes una caja abierta.', 409);
      }

      const nueva = await tx.sesionCaja.create({
        data: {
          uuidSesionCaja: uuid,
          idEmp,
          idSuc,
          fondoInicial: fondo / 100,
          estado: 'ABIERTA',
        },
        include: { empleado: true, sucursal: true },
      });

      return normalizarCaja(nueva);
    });
  }

  async registrarMovimiento(
    idEmp: number,
    uuidInput: string,
    tipoMovimiento: string,
    conceptoInput: string,
    montoInput: number | string,
  ) {
    const uuid = uuidValido(uuidInput);
    const tipo = texto(tipoMovimiento).toUpperCase();
    const concepto = texto(conceptoInput);
    const monto = dineroCentavos(montoInput);

    if (!uuid) throw errorFuncional('uuidMovimientoCaja no es válido', 400);
    if (!['INGRESO', 'RETIRO'].includes(tipo)) throw errorFuncional('El tipo de movimiento no es válido', 400);
    if (monto === null || monto <= 0) throw errorFuncional('El monto debe ser mayor que cero', 400);
    if (!concepto || concepto.length > 255)
      throw errorFuncional('El concepto es obligatorio y admite hasta 255 caracteres', 400);

    return await prisma.$transaction(async (tx) => {
      const caja = await tx.sesionCaja.findFirst({
        where: { idEmp, estado: 'ABIERTA' },
      });
      if (!caja) throw errorFuncional('No tienes una caja abierta.', 409);

      const existente = await tx.movimientoCaja.findUnique({
        where: { uuidMovimientoCaja: uuid },
      });
      if (existente) {
        if (Number(existente.idSesionCaja) !== Number(caja.idSesionCaja) || Number(existente.idEmp) !== Number(idEmp)) {
          throw errorFuncional('El identificador del movimiento ya está en uso.', 409);
        }
        return { ...existente, monto: Number(existente.monto) };
      }

      const nuevo = await tx.movimientoCaja.create({
        data: {
          uuidMovimientoCaja: uuid,
          idSesionCaja: caja.idSesionCaja,
          idEmp,
          tipoMovimiento: tipo,
          monto: monto / 100,
          concepto,
        },
      });

      return { ...nuevo, monto: Number(nuevo.monto) };
    });
  }

  async listarMovimientos(idEmp: number) {
    const caja = await this.obtenerCajaActual(idEmp);
    if (!caja) throw errorFuncional('No tienes una caja abierta.', 404);

    const idSesionCaja = caja.idSesionCaja ?? idValido(caja.id);
    if (!idSesionCaja) throw errorFuncional('Sesión de caja no válida', 400);

    const rows = await prisma.movimientoCaja.findMany({
      where: { idSesionCaja },
      orderBy: [{ fechaHora: 'desc' }, { idMovimientoCaja: 'desc' }],
    });
    return rows.map((r) => ({ ...r, monto: Number(r.monto) }));
  }

  async cerrarCaja(idEmp: number, efectivoContadoInput: number | string, observacionesInput?: string) {
    const contado = dineroCentavos(efectivoContadoInput);
    const observaciones = texto(observacionesInput);
    if (contado === null || contado < 0) throw errorFuncional('El efectivo contado no es válido', 400);
    if (observaciones.length > 1000) throw errorFuncional('Las observaciones son demasiado largas', 400);

    return await prisma.$transaction(async (tx) => {
      const cajaRow = await tx.sesionCaja.findFirst({
        where: { idEmp, estado: 'ABIERTA' },
        include: { empleado: true, sucursal: true },
      });
      if (!cajaRow) throw errorFuncional('No tienes una caja abierta.', 409);

      const resumen = await this.calcularResumenCaja(cajaRow, tx);
      const diferencia = contado / 100 - resumen.efectivoEsperado;

      const actualizada = await tx.sesionCaja.update({
        where: { idSesionCaja: cajaRow.idSesionCaja },
        data: {
          fechaHoraCierre: new Date(),
          totalVentas: resumen.totalVentas,
          totalEfectivo: resumen.totalEfectivo,
          totalTarjeta: resumen.totalTarjeta,
          totalTransferencia: resumen.totalTransferencia,
          totalIngresos: resumen.totalIngresos,
          totalRetiros: resumen.totalRetiros,
          efectivoEsperado: resumen.efectivoEsperado,
          efectivoContado: contado / 100,
          diferencia,
          numeroVentas: resumen.numeroVentas,
          estado: 'CERRADA',
          observaciones: observaciones || null,
        },
        include: { empleado: true, sucursal: true },
      });

      return normalizarCaja(actualizada);
    });
  }

  async historial(empleado: { idEmp: number; idSuc: number; cargo: string }, query: any) {
    const where: any = {};
    if (empleado.cargo === 'CAJERO') {
      where.idEmp = empleado.idEmp;
    } else {
      where.idSuc = empleado.idSuc;
      if (idValido(query.idEmp)) {
        where.idEmp = idValido(query.idEmp);
      }
    }
    if (['ABIERTA', 'CERRADA'].includes(texto(query.estado).toUpperCase())) {
      where.estado = texto(query.estado).toUpperCase();
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto(query.fecha))) {
      const fechaInicio = new Date(`${query.fecha}T00:00:00.000Z`);
      const fechaFin = new Date(`${query.fecha}T23:59:59.999Z`);
      where.fechaHoraApertura = { gte: fechaInicio, lte: fechaFin };
    }

    const rows = await prisma.sesionCaja.findMany({
      where,
      orderBy: { fechaHoraApertura: 'desc' },
      include: { empleado: true, sucursal: true },
    });
    return rows.map(normalizarCaja);
  }

  async detalle(idSesionCaja: number, empleado: { idEmp: number; idSuc: number; cargo: string }) {
    const where: any = { idSesionCaja };
    if (empleado.cargo === 'CAJERO') {
      where.idEmp = empleado.idEmp;
    } else {
      where.idSuc = empleado.idSuc;
    }

    const caja = await prisma.sesionCaja.findFirst({
      where,
      include: {
        empleado: true,
        sucursal: true,
        movimientos: {
          orderBy: [{ fechaHora: 'desc' }, { idMovimientoCaja: 'desc' }],
        },
      },
    });

    if (!caja) return null;

    const normalizada = normalizarCaja(caja);
    return {
      ...normalizada,
      movimientos: caja.movimientos.map((m) => ({
        ...m,
        id: encodeId(m.idMovimientoCaja),
        monto: Number(m.monto),
      })),
    };
  }
}

export const cajaService = new CajaService();
