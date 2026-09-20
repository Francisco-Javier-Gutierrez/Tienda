import { Router } from 'express';
import { authController } from './auth.controller';
import { loginLimiter } from '../../middlewares/rate-limit.middleware';
import { autenticar, autenticarCliente } from '../../middlewares/auth.middleware';
import { validarBody } from '../../middlewares/validate.middleware';
import { loginEmpleadoSchema, googleLoginSchema } from '../../schemas/auth.schema';

const router = Router();

router.post('/login', loginLimiter, validarBody(loginEmpleadoSchema), authController.login.bind(authController));
router.post(
  '/google',
  loginLimiter,
  validarBody(googleLoginSchema),
  authController.googleEmpleado.bind(authController),
);
router.post(
  '/google/cliente',
  loginLimiter,
  validarBody(googleLoginSchema),
  authController.googleCliente.bind(authController),
);

router.get('/me', autenticar, authController.meEmpleado.bind(authController));
router.get('/cliente/me', autenticarCliente, authController.meCliente.bind(authController));

export const authRoutes = router;
