import { Router } from 'express';
import { mermasController } from './mermas.controller';
import { autenticar, rolesPos } from '../../middlewares/auth.middleware';
import { validarBody } from '../../middlewares/validate.middleware';
import { registrarMermaSchema, actualizarEstadoMermaSchema } from '../../schemas/merma.schema';

const router = Router();

router.post(
  '/',
  autenticar,
  rolesPos,
  validarBody(registrarMermaSchema),
  mermasController.registrar.bind(mermasController),
);
router.get('/', autenticar, rolesPos, mermasController.listar.bind(mermasController));
router.get('/resumen', autenticar, rolesPos, mermasController.resumen.bind(mermasController));
router.get('/:id', autenticar, rolesPos, mermasController.detalle.bind(mermasController));
router.patch(
  '/:id/estado',
  autenticar,
  rolesPos,
  validarBody(actualizarEstadoMermaSchema),
  mermasController.actualizarEstado.bind(mermasController),
);

export const mermasRoutes = router;
