import { Router } from 'express';
import { configuracionController } from './configuracion.controller';
import { autenticar, autenticarCliente, soloAdministrador } from '../../middlewares/auth.middleware';

const adminRouter = Router();
const clienteRouter = Router();

adminRouter.get('/transferencia', autenticar, soloAdministrador, configuracionController.obtenerAdmin.bind(configuracionController));
adminRouter.put('/transferencia', autenticar, soloAdministrador, configuracionController.actualizarAdmin.bind(configuracionController));

clienteRouter.get('/configuracion-transferencia', autenticarCliente, configuracionController.obtenerCliente.bind(configuracionController));

export const adminConfiguracionRoutes = adminRouter;
export const clienteConfiguracionRoutes = clienteRouter;
