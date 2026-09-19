import { z } from 'zod';

export const itemPedidoSchema = z.preprocess(
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

export const crearPedidoSchema = z.object({
  uuidPedido: z.string().min(10, { message: 'El identificador uuidPedido no es válido' }),
  idSuc: z.union([z.string(), z.number()]).optional().nullable(),
  items: z.array(itemPedidoSchema).min(1, { message: 'El pedido debe incluir al menos un producto' }),
});

export const rechazarPedidoSchema = z.object({
  motivo: z.string().trim().min(3, { message: 'El motivo debe tener entre 3 y 255 caracteres' }).max(255),
});

export const cambiarEstadoOperativoSchema = z.object({
  estadoActual: z.string().trim().min(1),
  estadoNuevo: z.string().trim().min(1),
});
