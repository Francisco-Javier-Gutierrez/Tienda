import {
  BasePaymentStrategy,
  PaymentResult,
  EfectivoPaymentStrategy,
  TarjetaPaymentStrategy,
  TransferenciaPaymentStrategy,
  PaymentStrategyRegistry,
} from '../../../src/modules/ventas/payment.strategy';

// Subtipo personalizado para validar LSP
class ValesDespensaPaymentStrategy extends BasePaymentStrategy {
  readonly metodo = 'VALES';

  validarEntrada(body: any): void {
    if (!body?.numeroVale) {
      throw new Error('El número de vale es obligatorio');
    }
  }

  protected calcularPago(totalVenta: number, _body: any): PaymentResult {
    return {
      metodoPago: this.metodo,
      pagoCon: Number(totalVenta.toFixed(2)),
      cambio: 0,
      montoRecibidoDb: null,
    };
  }
}

// Subtipo que intenta violar invariantes de postcondición
class CorruptPaymentStrategy extends BasePaymentStrategy {
  readonly metodo = 'CORRUPT';

  validarEntrada(_body: any): void {}

  protected calcularPago(totalVenta: number, _body: any): PaymentResult {
    // Retorna cambio negativo y pago menor al total, violando invariantes
    return {
      metodoPago: this.metodo,
      pagoCon: totalVenta - 10,
      cambio: -5,
      montoRecibidoDb: null,
    };
  }
}

describe('Liskov Substitution Principle (LSP) - Payment Strategies', () => {
  describe('Invariantes y Precondiciones de BasePaymentStrategy', () => {
    it('debe rechazar totales de venta inválidos en cualquier subtipo (Precondición)', () => {
      const efectivo = new EfectivoPaymentStrategy();
      const tarjeta = new TarjetaPaymentStrategy();
      const vales = new ValesDespensaPaymentStrategy();

      expect(() => efectivo.validarYCalcular(-10, { montoRecibido: 50 })).toThrow('El total de la venta no es válido');
      expect(() => tarjeta.validarYCalcular(NaN, {})).toThrow('El total de la venta no es válido');
      expect(() => vales.validarYCalcular(-1, { numeroVale: '123' })).toThrow('El total de la venta no es válido');
    });

    it('debe impedir que un subtipo viole las postcondiciones e invariantes matemáticos', () => {
      const corrupt = new CorruptPaymentStrategy();
      expect(() => corrupt.validarYCalcular(100, {})).toThrow('El monto recibido es menor al total de la venta');
    });
  });

  describe('Sustituibilidad de Subtipos (LSP)', () => {
    it('todos los subtipos deben ser sustituibles dentro de PaymentStrategyRegistry', () => {
      const registry = new PaymentStrategyRegistry();
      const vales = new ValesDespensaPaymentStrategy();

      registry.register(vales);

      expect(registry.has('VALES')).toBe(true);
      const strategy = registry.get('VALES');

      expect(() => strategy.validarEntrada({})).toThrow('El número de vale es obligatorio');

      const result = strategy.validarYCalcular(250.5, { numeroVale: 'V-9999' });
      expect(result).toEqual({
        metodoPago: 'VALES',
        pagoCon: 250.5,
        cambio: 0,
        montoRecibidoDb: null,
      });
    });

    it('Efectivo, Tarjeta y Transferencia son sustituibles garantizando contratos idénticos', () => {
      const estrategias = [
        { strategy: new EfectivoPaymentStrategy(), body: { montoRecibido: 100 }, total: 80, esperadoCambio: 20 },
        { strategy: new TarjetaPaymentStrategy(), body: {}, total: 80, esperadoCambio: 0 },
        { strategy: new TransferenciaPaymentStrategy(), body: {}, total: 80, esperadoCambio: 0 },
      ];

      for (const { strategy, body, total, esperadoCambio } of estrategias) {
        expect(() => strategy.validarEntrada(body)).not.toThrow();
        const res = strategy.validarYCalcular(total, body);

        // Invariantes LSP verificables en cualquier subtipo
        expect(res.pagoCon).toBeGreaterThanOrEqual(total);
        expect(res.cambio).toBe(esperadoCambio);
        expect(Number((res.pagoCon - res.cambio).toFixed(2))).toBe(total);
      }
    });
  });
});
