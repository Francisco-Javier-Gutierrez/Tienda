import { z } from 'zod';

export const abrirCajaSchema = z.object({
  uuidSesionCaja: z.string().min(10, { message: 'El identificador uuidSesionCaja no es válido' }),
  fondoInicial: z.union([z.number(), z.string()]).refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0;
    },
    { message: 'El fondo inicial debe ser un número mayor o igual a cero' },
  ),
});

export const cerrarCajaSchema = z.object({
  efectivoContado: z.union([z.number(), z.string()]).refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num >= 0;
    },
    { message: 'El efectivo contado debe ser un número mayor o igual a cero' },
  ),
  observaciones: z
    .string()
    .max(1000, { message: 'Las observaciones no pueden superar los 1000 caracteres' })
    .optional()
    .nullable(),
});

export const movimientoCajaSchema = z.object({
  uuidMovimientoCaja: z.string().min(10, { message: 'El identificador uuidMovimientoCaja no es válido' }),
  tipoMovimiento: z.enum(['INGRESO', 'RETIRO'], {
    message: 'El tipo de movimiento debe ser INGRESO o RETIRO',
  }),
  monto: z.union([z.number(), z.string()]).refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    },
    { message: 'El monto debe ser mayor a cero' },
  ),
  concepto: z
    .string()
    .trim()
    .min(1, { message: 'El concepto es obligatorio' })
    .max(255, { message: 'El concepto no puede superar 255 caracteres' }),
});
