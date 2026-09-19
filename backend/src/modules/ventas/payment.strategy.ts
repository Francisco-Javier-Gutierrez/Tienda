import { dineroCentavos, errorFuncional } from '../../utils/formatters';

export interface PaymentResult {
  readonly metodoPago: string;
  readonly pagoCon: number;
  readonly cambio: number;
  readonly montoRecibidoDb: number | null;
}

/**
 * =========================================================================
 * Interface Segregation Principle (ISP) - Pagos
 * =========================================================================
 * Segregación de responsabilidades:
 * - IPaymentInputValidator: Validadores de carga útil previos a verificación de caja/stock
 * - IPaymentCalculator: Motores de cálculo financiero
 */
export interface IPaymentInputValidator {
  validarEntrada(body: any): void;
}

export interface IPaymentCalculator {
  validarYCalcular(totalVenta: number, body: any): PaymentResult;
}

export interface IPaymentStrategy extends IPaymentInputValidator, IPaymentCalculator {
  readonly metodo: string;
}

/**
 * BasePaymentStrategy: Supertipo abstracto para todas las estrategias de pago.
 * Implementa el Principio de Sustitución de Liskov (LSP) y Segregación de Interfaces (ISP):
 * - Garantiza que las precondiciones no se endurezcan arbitrariamente en los subtipos.
 * - Garantiza que las postcondiciones e invariantes financieros (pagoCon >= totalVenta,
 *   cambio >= 0, consistencia matemática) sean preservados por cualquier subtipo.
 * - Permite sustituir cualquier estrategia de pago sin romper la lógica del consumidor.
 */
export abstract class BasePaymentStrategy implements IPaymentStrategy {
  abstract readonly metodo: string;

  validarEntrada(_body: any): void {
    // Por defecto no requiere campos adicionales obligatorios.
    // Subtipos como Efectivo pueden sobrescribir para validar efectivo recibido.
  }

  validarYCalcular(totalVenta: number, body: any): PaymentResult {
    // Precondición general uniforme (LSP)
    if (!Number.isFinite(Number(totalVenta)) || Number(totalVenta) < 0) {
      throw errorFuncional('El total de la venta no es válido', 400);
    }

    // Ejecución polimórfica del cálculo específico del subtipo
    const resultado = this.calcularPago(totalVenta, body);

    // Invariantes financieros inmutables (LSP: ningún subtipo puede violar estas reglas)
    this.verificarInvariantes(totalVenta, resultado);

    return resultado;
  }

  protected abstract calcularPago(totalVenta: number, body: any): PaymentResult;

  protected verificarInvariantes(totalVenta: number, resultado: PaymentResult): void {
    if (resultado.metodoPago !== this.metodo) {
      throw errorFuncional('Inconsistencia en el método de pago devuelto', 500);
    }
    if (resultado.pagoCon < totalVenta) {
      throw errorFuncional('El monto recibido es menor al total de la venta', 400);
    }
    if (resultado.cambio < 0) {
      throw errorFuncional('El efectivo recibido es insuficiente.', 400);
    }
    const diferencia = Number((resultado.pagoCon - resultado.cambio - totalVenta).toFixed(2));
    if (Math.abs(diferencia) > 0.01) {
      throw errorFuncional('Inconsistencia en el cálculo matemático del pago', 500);
    }
  }
}

/**
 * Estrategia de pago para EFECTIVO:
 * Valida que el monto recibido sea válido y mayor o igual al total,
 * calculando el cambio correspondiente.
 */
export class EfectivoPaymentStrategy extends BasePaymentStrategy {
  readonly metodo = 'EFECTIVO';

  override validarEntrada(body: any): void {
    const montoRecibidoCentavos = dineroCentavos(body?.montoRecibido);
    if (montoRecibidoCentavos === null || montoRecibidoCentavos < 0) {
      throw errorFuncional('El monto recibido no es válido', 400);
    }
  }

  protected override calcularPago(totalVenta: number, body: any): PaymentResult {
    this.validarEntrada(body);

    const totalCentavos = dineroCentavos(totalVenta);
    if (totalCentavos === null || totalCentavos < 0) {
      throw errorFuncional('El total de la venta no es válido', 400);
    }

    const montoRecibidoCentavos = dineroCentavos(body?.montoRecibido)!;
    const cambioCentavos = montoRecibidoCentavos - totalCentavos;
    if (cambioCentavos < 0) {
      throw errorFuncional('El efectivo recibido es insuficiente.', 400);
    }

    const pagoCon = Number((montoRecibidoCentavos / 100).toFixed(2));
    const cambio = Number((cambioCentavos / 100).toFixed(2));
    const montoRecibidoDb = pagoCon;

    return {
      metodoPago: this.metodo,
      pagoCon,
      cambio,
      montoRecibidoDb,
    };
  }
}

/**
 * Estrategia de pago para TARJETA:
 * El pago se realiza por el monto exacto, sin cambio.
 */
export class TarjetaPaymentStrategy extends BasePaymentStrategy {
  readonly metodo = 'TARJETA';

  protected override calcularPago(totalVenta: number, _body: any): PaymentResult {
    return {
      metodoPago: this.metodo,
      pagoCon: Number(totalVenta.toFixed(2)),
      cambio: 0,
      montoRecibidoDb: null,
    };
  }
}

/**
 * Estrategia de pago para TRANSFERENCIA:
 * El pago se liquida por el monto exacto, sin cambio.
 */
export class TransferenciaPaymentStrategy extends BasePaymentStrategy {
  readonly metodo = 'TRANSFERENCIA';

  protected override calcularPago(totalVenta: number, _body: any): PaymentResult {
    return {
      metodoPago: this.metodo,
      pagoCon: Number(totalVenta.toFixed(2)),
      cambio: 0,
      montoRecibidoDb: null,
    };
  }
}

/**
 * Registro de estrategias de pago: Cumple OCP y LSP permitiendo registrar nuevos métodos
 * de pago (ej. SPEI, Vales, Stripe, PayPal) que heredan de BasePaymentStrategy
 * garantizando total sustituibilidad.
 */
export class PaymentStrategyRegistry {
  private strategies = new Map<string, IPaymentStrategy>();

  constructor() {
    this.register(new EfectivoPaymentStrategy());
    this.register(new TarjetaPaymentStrategy());
    this.register(new TransferenciaPaymentStrategy());
  }

  register(strategy: IPaymentStrategy): this {
    this.strategies.set(strategy.metodo.toUpperCase(), strategy);
    return this;
  }

  get(metodo: string): IPaymentStrategy {
    const normalizado = String(metodo || '').trim().toUpperCase();
    const strategy = this.strategies.get(normalizado);
    if (!strategy) {
      throw errorFuncional('El método de pago no es válido', 400);
    }
    return strategy;
  }

  has(metodo: string): boolean {
    const normalizado = String(metodo || '').trim().toUpperCase();
    return this.strategies.has(normalizado);
  }

  metodosDisponibles(): string[] {
    return [...this.strategies.keys()];
  }
}

export const defaultPaymentRegistry = new PaymentStrategyRegistry();
