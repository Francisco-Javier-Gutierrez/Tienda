import { FcmService } from '../../../src/modules/notificaciones/fcm.service';

describe('FcmService Unit Tests', () => {
  let mockFcmRepo: any;
  let service: FcmService;

  beforeEach(() => {
    mockFcmRepo = {
      guardarToken: jest.fn().mockResolvedValue(undefined),
      eliminarToken: jest.fn().mockResolvedValue(undefined),
      obtenerTokensUsuario: jest.fn().mockResolvedValue([]),
      obtenerTokensEmpleados: jest.fn().mockResolvedValue([]),
      eliminarTokenInvalido: jest.fn().mockResolvedValue(undefined),
    };
    service = new FcmService(mockFcmRepo);
  });

  it('debe registrar un token correctamente', async () => {
    await service.registrarToken({
      usuarioId: 1,
      tipoUsuario: 'CLIENTE',
      token: 'test-fcm-token-123',
      plataforma: 'ANDROID',
      dispositivo: 'Pixel 8',
    });

    expect(mockFcmRepo.guardarToken).toHaveBeenCalledWith({
      usuarioId: 1,
      tipoUsuario: 'CLIENTE',
      token: 'test-fcm-token-123',
      plataforma: 'ANDROID',
      dispositivo: 'Pixel 8',
    });
  });

  it('no debe guardar token si viene vacío', async () => {
    await service.registrarToken({
      usuarioId: 1,
      tipoUsuario: 'CLIENTE',
      token: '',
      plataforma: 'WEB',
    });

    expect(mockFcmRepo.guardarToken).not.toHaveBeenCalled();
  });

  it('debe eliminar token correctamente', async () => {
    await service.eliminarToken(1, 'CLIENTE', 'token-to-delete');
    expect(mockFcmRepo.eliminarToken).toHaveBeenCalledWith(1, 'CLIENTE', 'token-to-delete');
  });

  it('debe enviar notificacion a cliente retornando exitosos/fallidos sin lanzar error', async () => {
    mockFcmRepo.obtenerTokensUsuario.mockResolvedValue([
      { token: 'token-1', plataforma: 'ANDROID' },
    ]);

    const res = await service.enviarACliente(1, {
      titulo: 'Test Push',
      cuerpo: 'Mensaje de prueba',
    });

    expect(res).toBeDefined();
    expect(typeof res.exitosos).toBe('number');
    expect(typeof res.fallidos).toBe('number');
  });

  it('debe enviar notificacion a empleados retornando sin lanzar error', async () => {
    mockFcmRepo.obtenerTokensEmpleados.mockResolvedValue([
      { token: 'token-emp-1', plataforma: 'WEB' },
    ]);

    const res = await service.enviarAEmpleados({
      titulo: 'Nuevo Pedido',
      cuerpo: 'Alerta para administradores',
    });

    expect(res).toBeDefined();
    expect(typeof res.exitosos).toBe('number');
    expect(typeof res.fallidos).toBe('number');
  });
});
