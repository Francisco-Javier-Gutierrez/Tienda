import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validarBody(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const issues = (err as any).issues || [];
        const primerError = issues[0]?.message || 'Datos de entrada no válidos';
        const detalles = issues.map((e: any) => ({
          campo: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
          mensaje: e.message,
        }));
        res.status(400).json({
          message: primerError,
          errores: detalles,
        });
        return;
      }
      next(err);
    }
  };
}

export function validarQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.query = (await schema.parseAsync(req.query)) as any;
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        const issues = (err as any).issues || [];
        const primerError = issues[0]?.message || 'Parámetros de consulta no válidos';
        res.status(400).json({
          message: primerError,
          errores: issues.map((e: any) => ({
            campo: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
            mensaje: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
