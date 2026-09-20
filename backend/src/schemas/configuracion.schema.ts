import { z } from 'zod';

export const actualizarConfiguracionSchema = z
  .object({
    banco: z.string().trim().max(100),
    titular: z.string().trim().max(150),
    clabe: z
      .string()
      .trim()
      .regex(/^\d{18}$/, { message: 'La CLABE debe contener exactamente 18 dígitos' })
      .optional()
      .nullable()
      .or(z.literal('')),
    numeroCuenta: z.string().trim().max(50).optional().nullable(),
    instrucciones: z.string().trim().max(1000).optional().nullable(),
    activo: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.activo) {
        return Boolean(data.banco && data.titular);
      }
      return true;
    },
    {
      message: 'Banco y titular son obligatorios al habilitar transferencias',
    },
  );
