import { z } from 'zod';

export const registrarAbonoSchema = z.object({
  uuidAbono: z.string().min(10).optional().nullable(),
  monto: z.union([z.number(), z.string()]).refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    },
    { message: 'El monto del abono debe ser mayor a cero' },
  ),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']).default('EFECTIVO'),
  concepto: z.string().max(255).optional().nullable(),
});

export const clienteRapidoSchema = z.object({
  nombreCliente: z
    .string()
    .trim()
    .min(2, { message: 'El nombre es obligatorio (mínimo 2 caracteres)' })
    .max(100, { message: 'El nombre no puede exceder 100 caracteres' }),
  apellidoPatCliente: z.string().trim().max(100).optional().nullable(),
  apellidoMatCliente: z.string().trim().max(100).optional().nullable(),
  correoCliente: z.string().trim().optional().nullable(),
  telefono: z
    .string()
    .trim()
    .min(10, { message: 'El teléfono celular debe tener al menos 10 dígitos' })
    .max(15, { message: 'El teléfono no puede exceder 15 dígitos' }),
  limiteCredito: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (val === undefined || val === null || val === '') return true;
        const num = Number(val);
        return !isNaN(num) && num >= 0;
      },
      { message: 'El límite de crédito debe ser un número mayor o igual a cero' },
    ),
  deudaInicial: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (val === undefined || val === null || val === '') return true;
        const num = Number(val);
        return !isNaN(num) && num >= 0;
      },
      { message: 'La deuda inicial debe ser un número mayor o igual a cero' },
    ),
  direccion: z.string().trim().max(255).optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
});

export const registrarCargoSchema = z.object({
  monto: z.union([z.number(), z.string()]).refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    },
    { message: 'El monto del cargo debe ser mayor a cero' },
  ),
  concepto: z
    .string()
    .trim()
    .min(2, { message: 'El concepto del cargo es obligatorio' })
    .max(255, { message: 'El concepto no puede exceder 255 caracteres' }),
});
