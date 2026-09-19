import { z } from 'zod';

export const itemVentaSchema = z.preprocess(
  (data: any) => {
    if (data && typeof data === 'object') {
      const idPro = data.idPro ?? data.id ?? data.productoId;
      return {
        ...data,
        idPro,
      };
    }
    return data;
  },
  z.object({
    idPro: z.union([z.string(), z.number()], {
      message: 'El identificador del producto es requerido',
    }),
    id: z.union([z.string(), z.number()]).optional(),
    productoId: z.union([z.string(), z.number()]).optional(),
    cantidad: z.number().int({ message: 'La cantidad debe ser un entero' }).positive({ message: 'La cantidad debe ser mayor a cero' }),
  })
);

export const crearVentaSchema = z.object({
  uuidVenta: z.string().min(10, { message: 'El identificador uuidVenta no es válido' }),
  metodoPago: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'], {
    message: 'Método de pago debe ser EFECTIVO, TARJETA o TRANSFERENCIA',
  }),
  montoRecibido: z.union([z.number(), z.string()]).optional().nullable(),
  items: z.array(itemVentaSchema).min(1, { message: 'La venta debe contener al menos un producto' }),
});
