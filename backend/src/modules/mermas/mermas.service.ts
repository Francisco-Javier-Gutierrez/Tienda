import { errorFuncional, idValido } from '../../utils/formatters';
import { mermaRepository, IMermaRepository } from '../../db/repositories/merma.repository';
import { productoRepository, IProductoRepository } from '../../db/repositories/producto.repository';
import { normalizarMerma, normalizarMermas } from '../../dtos/merma.dto';

export interface IMermasService {
  registrarMerma(empleado: { idEmp: number; idSuc: number; nombre: string }, data: any): Promise<any>;
  listarMermas(idSuc: number, query: any): Promise<any[]>;
  obtenerResumen(idSuc: number, query?: any): Promise<any>;
  actualizarEstado(idMermaInput: string | number, estado: string, idSuc: number): Promise<any>;
  obtenerPorId(idMermaInput: string | number, idSuc: number): Promise<any>;
}

export class MermasService implements IMermasService {
  constructor(
    private mermaRepo: IMermaRepository = mermaRepository,
    private productoRepo: IProductoRepository = productoRepository,
  ) {}

  async registrarMerma(
    empleado: { idEmp: number; idSuc: number; nombre: string },
    data: {
      uuidMerma?: string | null;
      idPro: string | number;
      cantidad: number | string;
      tipo: 'CADUCADO' | 'DANADO' | 'DEVOLUCION_PROVEEDOR' | 'CONSUMO_INTERNO' | 'OTRO';
      motivo: string;
      idProv?: string | number | null;
      estado?: 'APLICADO' | 'PENDIENTE_REPOSICION' | 'DEVUELTO_PROVEEDOR';
    },
  ): Promise<any> {
    const idPro = idValido(data.idPro);
    if (!idPro) {
      throw errorFuncional('El producto especificado no es válido', 400);
    }

    const cantidad = Number(data.cantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      throw errorFuncional('La cantidad a mermar debe ser mayor a cero', 400);
    }

    const idSuc = empleado.idSuc || 1;
    const producto = await this.productoRepo.getProductoById(idPro, idSuc);
    if (!producto) {
      throw errorFuncional('El producto no existe en el catálogo', 404);
    }

    if (producto.existenciaPro < cantidad) {
      throw errorFuncional(
        `Existencias insuficientes para merma de "${producto.nombrePro}". Existencia actual: ${producto.existenciaPro}, solicitada: ${cantidad}`,
        400,
      );
    }

    const costoUnitario = Number(producto.costoPro || 0);
    const costoTotal = Math.round(costoUnitario * cantidad * 100) / 100;
    const precioVentaUnitario = Number(producto.precioVentaPro || 0);

    const idProv = data.idProv ? idValido(data.idProv) : null;
    const estado = data.estado || (data.tipo === 'DEVOLUCION_PROVEEDOR' ? 'PENDIENTE_REPOSICION' : 'APLICADO');

    const nuevaMerma = await this.mermaRepo.createMerma({
      uuidMerma: data.uuidMerma || null,
      idSuc,
      idEmp: empleado.idEmp,
      empleadoNombre: empleado.nombre || 'Empleado',
      idPro,
      productoNombre: producto.nombrePro,
      codigoQR: producto.codigoQR || null,
      cantidad,
      tipo: data.tipo,
      motivo: data.motivo.trim(),
      costoUnitario,
      costoTotal,
      precioVentaUnitario,
      idProv: idProv || null,
      proveedorNombre: null,
      estado,
    });

    return normalizarMerma(nuevaMerma);
  }

  async listarMermas(
    idSuc: number,
    query: { tipo?: string; estado?: string; idProv?: string | number; fechaDesde?: string; fechaHasta?: string },
  ): Promise<any[]> {
    const options: any = {};
    if (query.tipo) options.tipo = query.tipo;
    if (query.estado) options.estado = query.estado;
    if (query.idProv) {
      const parsedProv = idValido(query.idProv);
      if (parsedProv) options.idProv = parsedProv;
    }
    if (query.fechaDesde) options.fechaDesde = query.fechaDesde;
    if (query.fechaHasta) options.fechaHasta = query.fechaHasta;

    const items = await this.mermaRepo.listMermas(idSuc, options);
    return normalizarMermas(items);
  }

  async obtenerPorId(idMermaInput: string | number, idSuc: number): Promise<any> {
    const idMerma = idValido(idMermaInput);
    if (!idMerma) {
      throw errorFuncional('Identificador de merma no válido', 400);
    }

    const merma = await this.mermaRepo.getMermaById(idMerma, idSuc);
    if (!merma) {
      throw errorFuncional('Merma no encontrada', 404);
    }

    return normalizarMerma(merma);
  }

  async actualizarEstado(
    idMermaInput: string | number,
    estado: 'APLICADO' | 'PENDIENTE_REPOSICION' | 'DEVUELTO_PROVEEDOR',
    idSuc: number,
  ): Promise<any> {
    const idMerma = idValido(idMermaInput);
    if (!idMerma) {
      throw errorFuncional('Identificador de merma no válido', 400);
    }

    const actualizada = await this.mermaRepo.updateEstadoMerma(idMerma, estado, idSuc);
    if (!actualizada) {
      throw errorFuncional('Merma no encontrada', 404);
    }

    return normalizarMerma(actualizada);
  }

  async obtenerResumen(idSuc: number, query?: { fechaDesde?: string; fechaHasta?: string }): Promise<any> {
    const items = await this.mermaRepo.listMermas(idSuc, query);

    let totalPerdida = 0;
    let totalPiezas = 0;
    let totalDevolucionesPendientes = 0;
    let piezasDevolucionesPendientes = 0;

    const porTipo: Record<string, { conteo: number; piezas: number; costoTotal: number }> = {
      CADUCADO: { conteo: 0, piezas: 0, costoTotal: 0 },
      DANADO: { conteo: 0, piezas: 0, costoTotal: 0 },
      DEVOLUCION_PROVEEDOR: { conteo: 0, piezas: 0, costoTotal: 0 },
      CONSUMO_INTERNO: { conteo: 0, piezas: 0, costoTotal: 0 },
      OTRO: { conteo: 0, piezas: 0, costoTotal: 0 },
    };

    const agrupadoProductos: Record<number, { idPro: number; nombre: string; cantidad: number; costoTotal: number }> =
      {};

    for (const m of items) {
      const cant = Number(m.cantidad || 0);
      const costo = Number(m.costoTotal || 0);

      totalPiezas += cant;

      if (m.tipo === 'DEVOLUCION_PROVEEDOR' && m.estado === 'PENDIENTE_REPOSICION') {
        totalDevolucionesPendientes += costo;
        piezasDevolucionesPendientes += cant;
      } else {
        totalPerdida += costo;
      }

      const tipoKey = porTipo[m.tipo] ? m.tipo : 'OTRO';
      porTipo[tipoKey].conteo += 1;
      porTipo[tipoKey].piezas += cant;
      porTipo[tipoKey].costoTotal = Math.round((porTipo[tipoKey].costoTotal + costo) * 100) / 100;

      if (!agrupadoProductos[m.idPro]) {
        agrupadoProductos[m.idPro] = {
          idPro: m.idPro,
          nombre: m.productoNombre,
          cantidad: 0,
          costoTotal: 0,
        };
      }
      agrupadoProductos[m.idPro].cantidad += cant;
      agrupadoProductos[m.idPro].costoTotal = Math.round((agrupadoProductos[m.idPro].costoTotal + costo) * 100) / 100;
    }

    const topProductos = Object.values(agrupadoProductos)
      .sort((a, b) => b.costoTotal - a.costoTotal)
      .slice(0, 10);

    return {
      totalPerdida: Math.round(totalPerdida * 100) / 100,
      totalPiezas,
      totalDevolucionesPendientes: Math.round(totalDevolucionesPendientes * 100) / 100,
      piezasDevolucionesPendientes,
      porTipo,
      topProductos,
      totalRegistros: items.length,
    };
  }
}

export const mermasService = new MermasService();
