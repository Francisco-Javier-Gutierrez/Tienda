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
});
