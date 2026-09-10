import { Router } from 'express';
import { productosController } from './productos.controller';
import { autenticar, autorizarRoles, rolesPos } from '../../middlewares/auth.middleware';
import { uploadImagen } from '../../middlewares/upload.middleware';

const router = Router();
const soloAdmin = autorizarRoles('ADMINISTRADOR');

// Públicos
router.get('/public/productos', productosController.listarPublico.bind(productosController));

// POS
router.get('/pos/productos', autenticar, rolesPos, productosController.listarPos.bind(productosController));

// Admin
router.get('/productos', autenticar, soloAdmin, productosController.listarAdmin.bind(productosController));
router.get('/productos/qr/:codigo', autenticar, soloAdmin, productosController.buscarPorQR.bind(productosController));
router.get('/productos/externo/:codigo', autenticar, soloAdmin, productosController.consultarExterno.bind(productosController));

router.post('/productos', autenticar, soloAdmin, productosController.crear.bind(productosController));
router.post('/productos/:id/imagen', autenticar, soloAdmin, uploadImagen.single('imagen'), productosController.subirImagenLocal.bind(productosController));
router.post('/productos/:id/presign-imagen', autenticar, soloAdmin, productosController.presignImagen.bind(productosController));
router.post('/productos/:id/confirmar-imagen', autenticar, soloAdmin, productosController.confirmarImagen.bind(productosController));

router.put('/productos/:id', autenticar, soloAdmin, productosController.actualizar.bind(productosController));
router.delete('/productos/:id', autenticar, soloAdmin, productosController.eliminar.bind(productosController));

export const productosRoutes = router;
