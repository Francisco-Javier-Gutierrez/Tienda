import { z } from 'zod';

export const registrarMermaSchema = z.object({
  uuidMerma: z.string().min(10).optional().nullable(),
  idPro: z.union([z.number(), z.string()], { message: 'El producto es obligatorio' }),
  cantidad: z.union([z.number(), z.string()]).refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    },
    { message: 'La cantidad debe ser mayor a cero' },
  ),
  tipo: z.enum(['CADUCADO', 'DANADO', 'DEVOLUCION_PROVEEDOR', 'CONSUMO_INTERNO', 'OTRO'], {
    message: 'El tipo de merma no es válido',
  }),
  motivo: z
    .string()
    .trim()
    .min(1, { message: 'El motivo es obligatorio' })
    .max(500, { message: 'El motivo no puede superar 500 caracteres' }),
  idProv: z.union([z.number(), z.string()]).optional().nullable(),
  estado: z.enum(['APLICADO', 'PENDIENTE_REPOSICION', 'DEVUELTO_PROVEEDOR']).optional(),
});

export const actualizarEstadoMermaSchema = z.object({
  estado: z.enum(['APLICADO', 'PENDIENTE_REPOSICION', 'DEVUELTO_PROVEEDOR'], {
    message: 'Estado no válido',
  }),
  notas: z.string().max(500).optional().nullable(),
});
