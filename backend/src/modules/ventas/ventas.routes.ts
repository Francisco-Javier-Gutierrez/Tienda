import { Router } from 'express';
import { ventasController } from './ventas.controller';
import { autenticar, autorizarRoles, rolesPos } from '../../middlewares/auth.middleware';

const router = Router();
const soloAdmin = autorizarRoles('ADMINISTRADOR');

router.post('/', autenticar, rolesPos, ventasController.crear.bind(ventasController));
router.get('/', autenticar, rolesPos, ventasController.listar.bind(ventasController));
router.get('/:id', autenticar, rolesPos, ventasController.detalle.bind(ventasController));
router.post('/:id/cancelar', autenticar, soloAdmin, ventasController.cancelar.bind(ventasController));

export const ventasRoutes = router;
