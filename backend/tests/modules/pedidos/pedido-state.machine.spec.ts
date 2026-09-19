import {
  OrderStateMachine,
  defaultOrderStateMachine,
} from '../../../src/modules/pedidos/pedido-state.machine';

describe('OrderStateMachine (Principio Open/Closed - OCP)', () => {
  let stateMachine: OrderStateMachine;

  beforeEach(() => {
    stateMachine = new OrderStateMachine();
  });

  describe('Transiciones estándar', () => {
    it('debe permitir SUBIR_COMPROBANTE desde PENDIENTE_PAGO, EN_REVISION y RECHAZADO', () => {
      expect(stateMachine.validarTransicion('SUBIR_COMPROBANTE', 'PENDIENTE_PAGO')).toBe('EN_REVISION');
      expect(stateMachine.validarTransicion('SUBIR_COMPROBANTE', 'EN_REVISION')).toBe('EN_REVISION');
      expect(stateMachine.validarTransicion('SUBIR_COMPROBANTE', 'RECHAZADO')).toBe('EN_REVISION');
    });

    it('debe rechazar SUBIR_COMPROBANTE desde ENTREGADO', () => {
      expect(() => stateMachine.validarTransicion('SUBIR_COMPROBANTE', 'ENTREGADO')).toThrow(
        'No se puede adjuntar comprobante a un pedido en estado ENTREGADO.'
      );
    });

    it('debe permitir APROBAR_PAGO sólo desde EN_REVISION', () => {
      expect(stateMachine.validarTransicion('APROBAR_PAGO', 'EN_REVISION')).toBe('PAGADO');
      expect(() => stateMachine.validarTransicion('APROBAR_PAGO', 'PENDIENTE_PAGO')).toThrow(
        'Sólo pueden aprobarse pedidos con pago en revisión.'
      );
    });

    it('debe permitir RECHAZAR_PAGO sólo desde EN_REVISION', () => {
      expect(stateMachine.validarTransicion('RECHAZAR_PAGO', 'EN_REVISION')).toBe('RECHAZADO');
      expect(() => stateMachine.validarTransicion('RECHAZAR_PAGO', 'PAGADO')).toThrow(
        'Sólo pueden rechazarse pedidos con pago en revisión.'
      );
    });

    it('debe permitir ENTREGAR sólo desde PAGADO', () => {
      expect(stateMachine.validarTransicion('ENTREGAR', 'PAGADO')).toBe('ENTREGADO');
      expect(() => stateMachine.validarTransicion('ENTREGAR', 'PENDIENTE_PAGO')).toThrow(
        'El pedido debe estar en estado PAGADO para continuar (actual: PENDIENTE_PAGO).'
      );
    });

    it('debe permitir CANCELAR desde estados previos a entrega', () => {
      expect(stateMachine.validarTransicion('CANCELAR', 'PENDIENTE_PAGO')).toBe('CANCELADO');
      expect(stateMachine.validarTransicion('CANCELAR', 'EN_REVISION')).toBe('CANCELADO');
      expect(stateMachine.validarTransicion('CANCELAR', 'PAGADO')).toBe('CANCELADO');
      expect(stateMachine.validarTransicion('CANCELAR', 'RECHAZADO')).toBe('CANCELADO');
      expect(() => stateMachine.validarTransicion('CANCELAR', 'ENTREGADO')).toThrow(
        'No se puede cancelar un pedido en estado ENTREGADO.'
      );
    });

    it('debe lanzar error 400 con acción no registrada', () => {
      expect(() => stateMachine.validarTransicion('ACCION_INVENTADA', 'PAGADO')).toThrow(
        'Acción de transición desconocida: ACCION_INVENTADA'
      );
    });

    it('debe responder booleano en puedeTransicionar', () => {
      expect(stateMachine.puedeTransicionar('ENTREGAR', 'PAGADO')).toBe(true);
      expect(stateMachine.puedeTransicionar('ENTREGAR', 'EN_REVISION')).toBe(false);
      expect(stateMachine.puedeTransicionar('ACCION_INEXISTENTE', 'PAGADO')).toBe(false);
    });
  });

  describe('Extensibilidad OCP (Open/Closed)', () => {
    it('permite registrar una nueva transición sin modificar el código de la clase', () => {
      // Registrar transición DEVOLUCION: ENTREGADO -> REEMBOLSADO
      stateMachine.registrarTransicion({
        accion: 'SOLICITAR_DEVOLUCION',
        origenesPermitidos: new Set(['ENTREGADO']),
        destino: 'CANCELADO',
        mensajeError: (actual) => `Sólo se pueden solicitar devoluciones de pedidos entregados (actual: ${actual})`,
      });

      expect(stateMachine.puedeTransicionar('SOLICITAR_DEVOLUCION', 'ENTREGADO')).toBe(true);
      expect(stateMachine.validarTransicion('SOLICITAR_DEVOLUCION', 'ENTREGADO')).toBe('CANCELADO');

      expect(() => stateMachine.validarTransicion('SOLICITAR_DEVOLUCION', 'PAGADO')).toThrow(
        'Sólo se pueden solicitar devoluciones de pedidos entregados (actual: PAGADO)'
      );
    });

    it('la instancia por defecto (defaultOrderStateMachine) está inicializada correctamente', () => {
      expect(defaultOrderStateMachine).toBeInstanceOf(OrderStateMachine);
      expect(defaultOrderStateMachine.puedeTransicionar('APROBAR_PAGO', 'EN_REVISION')).toBe(true);
    });
  });
});
