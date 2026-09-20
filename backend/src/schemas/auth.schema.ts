import { z } from 'zod';

export const loginEmpleadoSchema = z.object({
  correo: z.string().trim().email({ message: 'El correo electrónico no es válido' }),
  password: z.string().min(1, { message: 'La contraseña es requerida' }),
});

export const googleLoginSchema = z
  .object({
    idToken: z.string().min(10, { message: 'Token de Google no válido' }).optional(),
    credential: z.string().min(10, { message: 'Credencial de Google no válida' }).optional(),
  })
  .refine((data) => data.idToken || data.credential, {
    message: 'Debes proporcionar idToken o credential de Google',
  });
