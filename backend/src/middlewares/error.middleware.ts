import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function errorServidor(
  res: Response,
  error: any,
  mensajeFallback = 'Ocurrió un error interno en el servidor',
): Response {
  console.error('Error Servidor:', error);

  if (error && (error.name === 'TransactionCanceledException' || error.name === 'ConditionalCheckFailedException')) {
    return res.status(409).json({
      message: error.message && !error.message.includes('Transaction cancelled')
        ? error.message
        : 'Conflicto de concurrencia o elemento duplicado en la base de datos',
    });
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
