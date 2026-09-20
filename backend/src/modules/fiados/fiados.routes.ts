import { Router } from 'express';
import { fiadosController } from './fiados.controller';
import { autenticar, rolesPos } from '../../middlewares/auth.middleware';
import { validarBody } from '../../middlewares/validate.middleware';
import { registrarAbonoSchema, clienteRapidoSchema } from '../../schemas/fiado.schema';

const router = Router();

router.get('/', autenticar, rolesPos, fiadosController.listarDeudores.bind(fiadosController));
router.get('/resumen', autenticar, rolesPos, fiadosController.resumen.bind(fiadosController));
router.get('/:id/cuenta', autenticar, rolesPos, fiadosController.estadoCuenta.bind(fiadosController));
router.post(
  '/:id/abono',
  autenticar,
  rolesPos,
  validarBody(registrarAbonoSchema),
  fiadosController.registrarAbono.bind(fiadosController),
);
router.post(
  '/clientes/rapido',
  autenticar,
  rolesPos,
  validarBody(clienteRapidoSchema),
  fiadosController.crearClienteRapido.bind(fiadosController),
);

export const fiadosRoutes = router;
