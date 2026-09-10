import { Request, Response } from 'express';
import {
  errorServidor,
  globalErrorHandler,
  notFoundHandler,
} from '../../src/middlewares/error.middleware';

describe('Error Handling Middlewares', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      originalUrl: '/ruta/inexistente',
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('errorServidor', () => {
    it('debe manejar restricciones de clave foránea con 409', () => {
      errorServidor(mockRes as Response, { code: '23503' });
      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('No se puede eliminar'),
        }),
      );
    });

    it('debe manejar errores P2025 de Prisma con 404', () => {
      errorServidor(mockRes as Response, { code: 'P2025' });
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('no fue encontrado'),
        }),
      );
    });

    it('debe respetar el status y mensaje de un error personalizado', () => {
      errorServidor(mockRes as Response, { status: 400, message: 'Parámetro faltante' });
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Parámetro faltante' });
    });

    it('debe responder con 500 para errores genéricos no controlados', () => {
      errorServidor(mockRes as Response, new Error('Fallo crítico'));
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Fallo crítico' });
    });
  });

  describe('notFoundHandler', () => {
    it('debe responder con 404 y mensaje descriptivo', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Ruta no encontrada: GET /ruta/inexistente',
      });
    });
  });

  describe('globalErrorHandler', () => {
    it('debe invocar errorServidor', () => {
      globalErrorHandler(new Error('Test error'), mockReq as Request, mockRes as Response, jest.fn());
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
