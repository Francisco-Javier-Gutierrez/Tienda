import { errorFuncional } from '../../utils/formatters';

export type EstadoPedido =
  'PENDIENTE_PAGO' | 'PENDIENTE' | 'EN_REVISION' | 'PAGADO' | 'RECHAZADO' | 'ENTREGADO' | 'CANCELADO';

export interface TransitionRule {
  readonly accion: string;
  readonly origenesPermitidos: ReadonlySet<EstadoPedido>;
  readonly destino: EstadoPedido;
  readonly mensajeError?: (actual: string) => string;
}

/**
 * OrderStateMachine: Máquina de estados extensible para pedidos.
 * Implementa el principio Open/Closed (OCP) permitiendo registrar nuevos estados
 * y transiciones sin alterar la lógica de negocio central de PedidosService.
 */
export class OrderStateMachine {
  private transiciones = new Map<string, TransitionRule>();

  constructor() {
    this.registrarTransicion({
      accion: 'SUBIR_COMPROBANTE',
      origenesPermitidos: new Set(['PENDIENTE_PAGO', 'PENDIENTE', 'EN_REVISION', 'RECHAZADO']),
      destino: 'EN_REVISION',
      mensajeError: (actual) => `No se puede adjuntar comprobante a un pedido en estado ${actual}.`,
    });

    this.registrarTransicion({
      accion: 'APROBAR_PAGO',
      origenesPermitidos: new Set(['EN_REVISION']),
      destino: 'PAGADO',
      mensajeError: () => 'Sólo pueden aprobarse pedidos con pago en revisión.',
    });

    this.registrarTransicion({
      accion: 'RECHAZAR_PAGO',
      origenesPermitidos: new Set(['EN_REVISION']),
      destino: 'RECHAZADO',
      mensajeError: () => 'Sólo pueden rechazarse pedidos con pago en revisión.',
    });

    this.registrarTransicion({
      accion: 'ENTREGAR',
      origenesPermitidos: new Set(['PAGADO']),
      destino: 'ENTREGADO',
      mensajeError: (actual) => `El pedido debe estar en estado PAGADO para continuar (actual: ${actual}).`,
    });

    this.registrarTransicion({
      accion: 'CANCELAR',
      origenesPermitidos: new Set(['PENDIENTE_PAGO', 'PENDIENTE', 'EN_REVISION', 'RECHAZADO', 'PAGADO']),
      destino: 'CANCELADO',
      mensajeError: (actual) => `No se puede cancelar un pedido en estado ${actual}.`,
    });
  }

  registrarTransicion(regla: TransitionRule): this {
    this.transiciones.set(regla.accion.toUpperCase(), regla);
    return this;
  }

  validarTransicion(accion: string, estadoActual: string): EstadoPedido {
    const regla = this.transiciones.get(accion.toUpperCase());
    if (!regla) {
      throw errorFuncional(`Acción de transición desconocida: ${accion}`, 400);
    }

    const actualTipado = estadoActual as EstadoPedido;
    if (!regla.origenesPermitidos.has(actualTipado)) {
      const msg = regla.mensajeError
        ? regla.mensajeError(estadoActual)
        : `Transición no permitida desde ${estadoActual}.`;
      throw errorFuncional(msg, 409);
    }

    return regla.destino;
  }

  puedeTransicionar(accion: string, estadoActual: string): boolean {
    const regla = this.transiciones.get(accion.toUpperCase());
    if (!regla) return false;
    return regla.origenesPermitidos.has(estadoActual as EstadoPedido);
  }
}

export const defaultOrderStateMachine = new OrderStateMachine();
