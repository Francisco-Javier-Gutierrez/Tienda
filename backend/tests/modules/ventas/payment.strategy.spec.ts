import {
  PaymentStrategyRegistry,
  EfectivoPaymentStrategy,
  TarjetaPaymentStrategy,
  TransferenciaPaymentStrategy,
  IPaymentStrategy,
  PaymentResult,
} from '../../../src/modules/ventas/payment.strategy';

describe('PaymentStrategy (OCP)', () => {
  let registry: PaymentStrategyRegistry;

  beforeEach(() => {
    registry = new PaymentStrategyRegistry();
  });

  describe('EfectivoPaymentStrategy', () => {
    const strategy = new EfectivoPaymentStrategy();

    it('calcula cambio correctamente con efectivo suficiente', () => {
      const res = strategy.validarYCalcular(150.5, { montoRecibido: 200 });
      expect(res.metodoPago).toBe('EFECTIVO');
      expect(res.pagoCon).toBe(200);
      expect(res.cambio).toBe(49.5);
      expect(res.montoRecibidoDb).toBe(200);
    });

    it('rechaza si el monto recibido es menor al total', () => {
      expect(() => strategy.validarYCalcular(100, { montoRecibido: 80 })).toThrow(
        'El efectivo recibido es insuficiente.',
      );
    });

    it('rechaza si el monto recibido no es válido', () => {
      expect(() => strategy.validarEntrada({ montoRecibido: -10 })).toThrow('El monto recibido no es válido');
      expect(() => strategy.validarEntrada({ montoRecibido: 'invalido' })).toThrow('El monto recibido no es válido');
    });
  });

  describe('TarjetaPaymentStrategy y TransferenciaPaymentStrategy', () => {
    it('liquida monto exacto sin cambio', () => {
      const tarjeta = new TarjetaPaymentStrategy();
      const resT = tarjeta.validarYCalcular(250.75, {});
      expect(resT.pagoCon).toBe(250.75);
      expect(resT.cambio).toBe(0);
      expect(resT.montoRecibidoDb).toBeNull();

      const transf = new TransferenciaPaymentStrategy();
      const resTr = transf.validarYCalcular(300, {});
      expect(resTr.pagoCon).toBe(300);
      expect(resTr.cambio).toBe(0);
    });
  });

  describe('Extensibilidad de PaymentStrategyRegistry (Open/Closed Principle)', () => {
    it('permite registrar un nuevo método de pago sin modificar código existente', () => {
      // Estrategia personalizada (ej. Vales de Despensa)
      class ValesPaymentStrategy implements IPaymentStrategy {
        readonly metodo = 'VALES';
        validarEntrada(_body: any) {}
        validarYCalcular(totalVenta: number, body: any): PaymentResult {
          return {
            metodoPago: this.metodo,
            pagoCon: Number(totalVenta.toFixed(2)),
            cambio: 0,
            montoRecibidoDb: Number(totalVenta.toFixed(2)),
          };
        }
      }

      expect(registry.has('VALES')).toBe(false);
      registry.register(new ValesPaymentStrategy());
      expect(registry.has('VALES')).toBe(true);

      const valesStrategy = registry.get('VALES');
      const resultado = valesStrategy.validarYCalcular(500, {});
      expect(resultado.metodoPago).toBe('VALES');
      expect(resultado.pagoCon).toBe(500);
    });

    it('rechaza métodos de pago no registrados', () => {
      expect(() => registry.get('METODO_INEXISTENTE')).toThrow('El método de pago no es válido');
    });
  });
});
