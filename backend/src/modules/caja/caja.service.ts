import { errorFuncional, idValido, encodeId, texto, dineroCentavos, uuidValido } from '../../utils/formatters';
import { cajaRepository, ICajaRepository } from '../../db/repositories/caja.repository';
import { ventaRepository, VentaRepository } from '../../db/repositories/venta.repository';
import { normalizarCaja } from '../../dtos/caja.dto';

export { normalizarCaja };

/**
 * =========================================================================
 * Dependency Inversion Principle (DIP) - Caja
 * =========================================================================
 * Abstracción ICajaService para desacoplar CajaController y permitir
 * inyección de dependencias de repositorios.
 */
export interface ICajaService {
  obtenerCajaActual(idEmp: number): Promise<any>;
  calcularResumenCaja(caja: any): Promise<any>;
  abrirCaja(
    idEmp: number,
    idSuc: number,
    uuidInput: string,
    fondoInicialInput: number | string,
    empleadoNombre?: string,
  ): Promise<any>;
  registrarMovimiento(
    idEmp: number,
    uuidInput: string,
    tipoMovimiento: string,
    conceptoInput: string,
    montoInput: number | string,
  ): Promise<any>;
  listarMovimientos(idEmp: number): Promise<any>;
  cerrarCaja(idEmp: number, efectivoContadoInput: number | string, observacionesInput?: string): Promise<any>;
  historial(empleado: { idEmp: number; idSuc: number; cargo: string }, query: any): Promise<any>;
  detalle(idSesionCaja: number, empleado: { idEmp: number; idSuc: number; cargo: string }): Promise<any>;
}

export class CajaService implements ICajaService {
  constructor(
    private cajaRepo: any = cajaRepository,
    private ventaRepo: any = ventaRepository,
  ) {}

  async obtenerCajaActual(idEmp: number) {
    const abierta = await this.cajaRepo.getSesionAbierta(1, idEmp);
    return normalizarCaja(abierta);
  }

  async calcularResumenCaja(caja: any) {
    const idSesionCaja = caja?.idSesionCaja ?? idValido(caja?.id);
    if (!idSesionCaja) {
      throw errorFuncional('Sesión de caja no válida', 400);
    }

    const [ventas, movimientos] = await Promise.all([
      this.ventaRepo.listVentas(caja.idSuc || 1, { idSesionCaja }),
      this.cajaRepo.listMovimientos ? this.cajaRepo.listMovimientos(idSesionCaja) : Promise.resolve([]),
    ]);

    let totalVentas = 0;
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalTransferencia = 0;
    for (const v of ventas) {
      if (v.estadoVenta === 'CANCELADA') continue;
      const tot = Number(v.totalVenta || (v as any).total || 0);
      totalVentas += tot;
      if (v.metodoPago === 'EFECTIVO') totalEfectivo += tot;
      else if (v.metodoPago === 'TARJETA') totalTarjeta += tot;
      else if (v.metodoPago === 'TRANSFERENCIA') totalTransferencia += tot;
    }

    let totalIngresos = 0;
    let totalRetiros = 0;
    for (const m of movimientos) {
      const monto = Number(m.monto || 0);
      if (m.tipoMovimiento === 'INGRESO') totalIngresos += monto;
      else if (m.tipoMovimiento === 'RETIRO') totalRetiros += monto;
    }

    // Reconciliar con acumuladores atómicos de tabla principal para proteger contra lag de GSI1
    const totalVentasFinal = Math.max(Number(caja.totalVentas || 0), totalVentas);
    const totalEfectivoFinal = Math.max(Number(caja.totalEfectivo || 0), totalEfectivo);
    const totalTarjetaFinal = Math.max(Number(caja.totalTarjeta || 0), totalTarjeta);
    const totalTransferenciaFinal = Math.max(Number(caja.totalTransferencia || 0), totalTransferencia);
    const totalIngresosFinal = Math.max(Number(caja.totalIngresos || 0), totalIngresos);
    const totalRetirosFinal = Math.max(Number(caja.totalRetiros || 0), totalRetiros);
    const numeroVentasFinal = Math.max(
      Number(caja.numeroVentas || 0),
      ventas.filter((v: any) => v.estadoVenta !== 'CANCELADA').length,
    );

    const fondoInicial = Number(caja.fondoInicial) || 0;
    const efectivoEsperado = fondoInicial + totalEfectivoFinal + totalIngresosFinal - totalRetirosFinal;

    return {
      ...caja,
      totalVentas: Number(totalVentasFinal.toFixed(2)),
      totalEfectivo: Number(totalEfectivoFinal.toFixed(2)),
      totalTarjeta: Number(totalTarjetaFinal.toFixed(2)),
      totalTransferencia: Number(totalTransferenciaFinal.toFixed(2)),
      numeroVentas: numeroVentasFinal,
      totalIngresos: Number(totalIngresosFinal.toFixed(2)),
      totalRetiros: Number(totalRetirosFinal.toFixed(2)),
      efectivoEsperado: Number(efectivoEsperado.toFixed(2)),
    };
  }

  async abrirCaja(
    idEmp: number,
    idSuc: number,
    uuidInput: string,
    fondoInicialInput: number | string,
    empleadoNombre?: string,
  ) {
    const uuid = uuidValido(uuidInput);
    const fondo = dineroCentavos(fondoInicialInput);
    if (!uuid) throw errorFuncional('uuidSesionCaja no es válido', 400);
    if (fondo === null || fondo < 0) throw errorFuncional('El fondo inicial no es válido', 400);

    // Idempotencia rápida: Si la sesión ya fue abierta con este UUID, retornarla directamente
    if (this.cajaRepo.getSesionByUuid) {
      const existente = await this.cajaRepo.getSesionByUuid(uuid, idSuc);
      if (existente) {
        return normalizarCaja(existente);
      }
    }

    const activa = await this.cajaRepo.getSesionAbierta(idSuc, idEmp);
    if (activa) {
      throw errorFuncional('Ya tienes una caja abierta.', 409);
    }
    const nueva = await this.cajaRepo.abrirSesion({
      idSuc,
      idEmp,
      fondoInicial: fondo / 100,
      uuidSesionCaja: uuid,
      empleadoNombre,
    });
    return normalizarCaja(nueva);
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

    // Idempotencia rápida: Si el movimiento ya fue registrado previamente con este UUID
    if (this.cajaRepo.getMovimientoByUuid) {
      const existente = await this.cajaRepo.getMovimientoByUuid(uuid, 1);
      if (existente) {
        return {
          ...existente,
          idMovimientoCaja: existente.idMovimientoCaja,
          uuidMovimientoCaja: uuid,
          idSesionCaja: existente.idSesionCaja,
          idEmp: existente.idEmp,
          tipoMovimiento: existente.tipoMovimiento,
          monto: Number(existente.monto),
          concepto: existente.concepto,
          fechaHora: existente.fechaHora,
        };
      }
    }

    const caja = await this.cajaRepo.getSesionAbierta(1, idEmp);
    if (!caja) throw errorFuncional('No tienes una caja abierta.', 409);

    const movimiento = await this.cajaRepo.registrarMovimiento({
      idSuc: caja.idSuc || 1,
      idEmp,
      idSesionCaja: caja.idSesionCaja,
      uuidMovimientoCaja: uuid,
      tipoMovimiento: tipo as 'INGRESO' | 'RETIRO',
      monto: monto / 100,
      concepto,
    });

    return {
      ...movimiento,
      idMovimientoCaja: movimiento.idMovimientoCaja,
      uuidMovimientoCaja: uuid,
      idSesionCaja: caja.idSesionCaja,
      idEmp,
      tipoMovimiento: tipo,
      monto: monto / 100,
      concepto,
      fechaHora: movimiento.fechaHora,
    };
  }

  async listarMovimientos(idEmp: number) {
    const caja = await this.cajaRepo.getSesionAbierta(1, idEmp);
    if (!caja) throw errorFuncional('No tienes una caja abierta.', 404);

    const idSesionCaja = caja.idSesionCaja ?? idValido(caja.id);
    if (!idSesionCaja) throw errorFuncional('Sesión de caja no válida', 400);

    const rows = await this.cajaRepo.listMovimientos(idSesionCaja);
    return rows.map((r: any) => ({ ...r, monto: Number(r.monto) }));
  }

  async cerrarCaja(idEmp: number, efectivoContadoInput: number | string, observacionesInput?: string) {
    const contado = dineroCentavos(efectivoContadoInput);
    const observaciones = texto(observacionesInput);
    if (contado === null || contado < 0) throw errorFuncional('El efectivo contado no es válido', 400);
    if (observaciones.length > 1000) throw errorFuncional('Las observaciones son demasiado largas', 400);

    const abierta = await this.cajaRepo.getSesionAbierta(1, idEmp);
    if (!abierta) throw errorFuncional('No tienes una caja abierta.', 409);

    const resumen = await this.calcularResumenCaja(abierta);
    const diferencia = contado / 100 - resumen.efectivoEsperado;

    const cerrada = await this.cajaRepo.cerrarSesion(
      abierta.idSesionCaja,
      {
        montoReal: contado / 100,
        diferencia,
        observaciones: observaciones || undefined,
      },
      abierta.idSuc,
    );

    return normalizarCaja({
      ...resumen,
      ...cerrada,
      efectivoContado: contado / 100,
      diferencia,
    });
  }

  async historial(empleado: { idEmp: number; idSuc: number; cargo: string }, query: any) {
    let sesiones = await this.cajaRepo.listSesiones(empleado.idSuc || 1);
    if (empleado.cargo === 'CAJERO') {
      sesiones = sesiones.filter((s: any) => s.idEmp === empleado.idEmp);
    }
    const estado = texto(query?.estado).toUpperCase();
    if (['ABIERTA', 'CERRADA'].includes(estado)) {
      sesiones = sesiones.filter((s: any) => s.estado === estado);
    }
    return sesiones.map(normalizarCaja);
  }

  async detalle(idSesionCaja: number, empleado: { idEmp: number; idSuc: number; cargo: string }) {
    const caja = await this.cajaRepo.getSesionById(idSesionCaja, empleado.idSuc || 1);
    if (!caja) return null;

    if (empleado.cargo === 'CAJERO' && caja.idEmp !== empleado.idEmp) {
      return null;
    }

    const normalizada = normalizarCaja(caja);
    const movimientos = await this.cajaRepo.listMovimientos(idSesionCaja);

    return {
      ...normalizada,
      movimientos: movimientos.map((m: any) => ({
        ...m,
        id: encodeId(m.idMovimientoCaja),
        monto: Number(m.monto),
      })),
    };
  }
}

export const cajaService = new CajaService();
