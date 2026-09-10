import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function errorServidor(
  res: Response,
  error: any,
  mensajeFallback = 'Ocurrió un error interno en el servidor',
): Response {
  console.error('Error Servidor:', error);

  if (error && (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === '23503')) {
    return res.status(409).json({
      message: 'No se puede eliminar porque el registro está en uso o tiene dependencias relacionadas',
    });
  }

  if (error && error.code === 'P2025') {
    return res.status(404).json({ message: 'El registro solicitado no fue encontrado' });
  }

  const status = typeof error?.status === 'number' ? error.status : 500;
  const message =
    status >= 500 && env.NODE_ENV === 'production'
      ? mensajeFallback
      : typeof error?.message === 'string'
        ? error.message
        : mensajeFallback;
  const payload = error?.payload;

  return res.status(status).json({ message, ...(payload && { payload }) });
}

export function notFoundHandler(req: Request, res: Response): Response {
  return res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

export function globalErrorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  errorServidor(res, err);
}
