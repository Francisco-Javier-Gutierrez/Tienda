import { errorFuncional, idValido } from '../../utils/formatters';
import { fiadoRepository, IFiadoRepository } from '../../db/repositories/fiado.repository';
import { cajaRepository, ICajaRepository } from '../../db/repositories/caja.repository';
import {
  normalizarClienteDeudor,
  normalizarClientesDeudores,
  normalizarMovimientoCuenta,
  normalizarMovimientosCuenta,
} from '../../dtos/fiado.dto';

export interface IFiadosService {
  listarDeudores(idSuc?: number): Promise<any[]>;
  obtenerResumen(idSuc?: number): Promise<any>;
  obtenerEstadoCuenta(idClienteInput: string | number): Promise<any>;
  registrarAbono(
    empleado: { idEmp: number; idSuc: number; nombre: string },
    idClienteInput: string | number,
    data: { uuidAbono?: string | null; monto: number | string; metodoPago: string; concepto?: string | null },
  ): Promise<any>;
  crearClienteRapido(data: {
    nombreCliente: string;
    apellidoPatCliente?: string;
    apellidoMatCliente?: string;
    telefono: string;
    correoCliente?: string;
    limiteCredito?: number | null;
    direccion?: string;
    notas?: string;
  }): Promise<any>;
}

export class FiadosService implements IFiadosService {
  constructor(
    private fiadoRepo: IFiadoRepository = fiadoRepository,
    private cajaRepo: ICajaRepository = cajaRepository,
  ) {}

  async listarDeudores(idSuc = 1): Promise<any[]> {
    const clientes = await this.fiadoRepo.listClientesDeudores(idSuc);
    return normalizarClientesDeudores(clientes);
  }

  async obtenerResumen(idSuc = 1): Promise<any> {
    const clientes = await this.fiadoRepo.listClientesDeudores(idSuc);
    const deudoresConSaldo = clientes.filter((d: any) => Number(d.saldoDeudor || 0) > 0);

    let totalDeuda = 0;
    for (const d of deudoresConSaldo) {
      totalDeuda += Number(d.saldoDeudor || 0);
    }
    totalDeuda = Math.round(totalDeuda * 100) / 100;

    const totalDeudores = deudoresConSaldo.length;
    const promedio = totalDeudores > 0 ? Math.round((totalDeuda / totalDeudores) * 100) / 100 : 0;

    const topDeudores = normalizarClientesDeudores(deudoresConSaldo.slice(0, 5));

    return {
      totalDeuda,
      totalDeudores,
      deudaPromedio: promedio,
      topDeudores,
    };
  }

  async obtenerEstadoCuenta(idClienteInput: string | number): Promise<any> {
    const idCliente = idValido(idClienteInput);
    if (!idCliente) {
      throw errorFuncional('Identificador de cliente no válido', 400);
    }

    const cliente = await this.fiadoRepo.getClienteById(idCliente);
    if (!cliente) {
      throw errorFuncional('Cliente no encontrado', 404);
    }

    const movimientos = await this.fiadoRepo.getHistorialCuenta(idCliente);

    return {
      cliente: normalizarClienteDeudor(cliente),
      movimientos: normalizarMovimientosCuenta(movimientos),
    };
  }

  async registrarAbono(
    empleado: { idEmp: number; idSuc: number; nombre: string },
    idClienteInput: string | number,
    data: {
      uuidAbono?: string | null;
      monto: number | string;
      metodoPago: string;
      concepto?: string | null;
    },
  ): Promise<any> {
    const idCliente = idValido(idClienteInput);
    if (!idCliente) {
      throw errorFuncional('Identificador de cliente no válido', 400);
    }

    const monto = Number(data.monto);
    if (isNaN(monto) || monto <= 0) {
      throw errorFuncional('El monto del abono debe ser mayor a cero', 400);
    }

    const cliente = await this.fiadoRepo.getClienteById(idCliente);
    if (!cliente) {
      throw errorFuncional('Cliente no encontrado', 404);
    }

    const metodoPagoValido = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].includes(data.metodoPago?.toUpperCase())
      ? (data.metodoPago.toUpperCase() as 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA')
      : 'EFECTIVO';

    // Buscar si el cajero tiene sesión de caja activa
    const idSuc = empleado.idSuc || 1;
    const sesionActiva = await this.cajaRepo.getSesionAbierta(idSuc, empleado.idEmp);

    const mov = await this.fiadoRepo.registrarAbono({
      uuidAbono: data.uuidAbono || null,
      idCliente,
      idSuc,
      idEmp: empleado.idEmp,
      empleadoNombre: empleado.nombre || 'Cajero',
      monto,
      metodoPago: metodoPagoValido,
      concepto: data.concepto || null,
      idSesionCaja: sesionActiva?.idSesionCaja || null,
    });

    return {
      abono: normalizarMovimientoCuenta(mov),
      nuevoSaldo: mov.saldoNuevo,
      mensaje: `Abono de $${monto.toFixed(2)} registrado correctamente. Nuevo saldo: $${mov.saldoNuevo.toFixed(2)}`,
    };
  }

  async crearClienteRapido(data: {
    nombreCliente: string;
    apellidoPatCliente?: string;
    apellidoMatCliente?: string;
    telefono: string;
    correoCliente?: string;
    limiteCredito?: number | null;
    direccion?: string;
    notas?: string;
  }): Promise<any> {
    const nuevo = await this.fiadoRepo.crearClienteRapido(data);
    return normalizarClienteDeudor(nuevo);
  }
}

export const fiadosService = new FiadosService();
