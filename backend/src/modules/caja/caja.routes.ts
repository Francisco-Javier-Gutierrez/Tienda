import { Router } from 'express';
import { cajaController } from './caja.controller';
import { autenticar, rolesPos } from '../../middlewares/auth.middleware';
import { validarBody } from '../../middlewares/validate.middleware';
import { abrirCajaSchema, cerrarCajaSchema, movimientoCajaSchema } from '../../schemas/caja.schema';

const router = Router();

router.post('/abrir', autenticar, rolesPos, validarBody(abrirCajaSchema), cajaController.abrir.bind(cajaController));
router.get('/actual', autenticar, rolesPos, cajaController.actual.bind(cajaController));
router.get('/actual/resumen', autenticar, rolesPos, cajaController.actualResumen.bind(cajaController));
router.post(
  '/movimientos',
  autenticar,
  rolesPos,
  validarBody(movimientoCajaSchema),
  cajaController.registrarMovimiento.bind(cajaController),
);
router.get('/movimientos', autenticar, rolesPos, cajaController.listarMovimientos.bind(cajaController));
router.post('/cerrar', autenticar, rolesPos, validarBody(cerrarCajaSchema), cajaController.cerrar.bind(cajaController));
router.get('/historial', autenticar, rolesPos, cajaController.historial.bind(cajaController));
router.get('/:id', autenticar, rolesPos, cajaController.detalle.bind(cajaController));

export const cajaRoutes = router;
