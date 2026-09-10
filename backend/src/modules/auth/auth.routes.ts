import { Router } from 'express';
import { authController } from './auth.controller';
import { loginLimiter } from '../../middlewares/rate-limit.middleware';
import { autenticar, autenticarCliente } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/login', loginLimiter, authController.login.bind(authController));
router.post('/google', loginLimiter, authController.googleEmpleado.bind(authController));
router.post('/google/cliente', loginLimiter, authController.googleCliente.bind(authController));

router.get('/me', autenticar, authController.meEmpleado.bind(authController));
router.get('/cliente/me', autenticarCliente, authController.meCliente.bind(authController));

export const authRoutes = router;
