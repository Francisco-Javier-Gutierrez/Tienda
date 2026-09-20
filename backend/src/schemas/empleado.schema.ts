import { z } from 'zod';

export const crearEmpleadoSchema = z.object({
  nombre: z.string().trim().min(1, { message: 'El nombre es obligatorio' }).max(100),
  apellidoPat: z.string().trim().max(100).optional().nullable(),
  apellidoMat: z.string().trim().max(100).optional().nullable(),
  correo: z.string().trim().email({ message: 'El correo electrónico no es válido' }).toLowerCase(),
  password: z
    .string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .optional()
    .nullable()
    .or(z.literal('')),
  telefono: z.string().trim().max(20).optional().nullable(),
  idCargo: z.union([z.string(), z.number()], { message: 'El cargo es obligatorio' }),
});

export const actualizarEmpleadoSchema = z.object({
  nombre: z.string().trim().min(1, { message: 'El nombre es obligatorio' }).max(100),
  apellidoPat: z.string().trim().max(100).optional().nullable(),
  apellidoMat: z.string().trim().max(100).optional().nullable(),
  correo: z.string().trim().email({ message: 'El correo electrónico no es válido' }).toLowerCase(),
  password: z
    .string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
    .optional()
    .nullable()
    .or(z.literal('')),
  telefono: z.string().trim().max(20).optional().nullable(),
  idCargo: z.union([z.string(), z.number()], { message: 'El cargo es obligatorio' }),
});
