import { Router } from 'express';
import { NotificacionesController } from './notificaciones.controller';
import { autenticarCualquiera } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new NotificacionesController();

router.post('/token', autenticarCualquiera, controller.registrarToken);
router.delete('/token/:token', autenticarCualquiera, controller.eliminarToken);
router.post('/test', autenticarCualquiera, controller.enviarPrueba);

export default router;
