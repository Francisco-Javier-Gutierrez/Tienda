import { Router } from 'express';
import { empleadosController } from './empleados.controller';
import { autenticar, autorizarRoles } from '../../middlewares/auth.middleware';

const router = Router();
const soloAdmin = autorizarRoles('ADMINISTRADOR');

router.get('/', autenticar, soloAdmin, empleadosController.listar.bind(empleadosController));
router.post('/', autenticar, soloAdmin, empleadosController.crear.bind(empleadosController));
router.put('/:id', autenticar, soloAdmin, empleadosController.actualizar.bind(empleadosController));
router.patch('/:id/estado', autenticar, soloAdmin, empleadosController.cambiarEstado.bind(empleadosController));

export const empleadosRoutes = router;
