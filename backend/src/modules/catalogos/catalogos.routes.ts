import { Router } from 'express';
import { catalogosController } from './catalogos.controller';
import { autenticar, autorizarRoles } from '../../middlewares/auth.middleware';
import { uploadLogo } from '../../middlewares/upload.middleware';

const router = Router();
const soloAdmin = autorizarRoles('ADMINISTRADOR');

// Tienda Pública
router.get('/public/tienda', catalogosController.listarTiendaPublica.bind(catalogosController));

// Marcas
router.get('/marca', autenticar, soloAdmin, catalogosController.listarMarcas.bind(catalogosController));
router.post('/marca', autenticar, soloAdmin, catalogosController.crearMarca.bind(catalogosController));
router.put('/marca/:id', autenticar, soloAdmin, catalogosController.actualizarMarca.bind(catalogosController));
router.delete('/marca/:id', autenticar, soloAdmin, catalogosController.eliminarMarca.bind(catalogosController));

// Categorías
router.get('/categoria', autenticar, soloAdmin, catalogosController.listarCategorias.bind(catalogosController));
router.post('/categoria', autenticar, soloAdmin, catalogosController.crearCategoria.bind(catalogosController));
router.put('/categoria/:id', autenticar, soloAdmin, catalogosController.actualizarCategoria.bind(catalogosController));
router.delete('/categoria/:id', autenticar, soloAdmin, catalogosController.eliminarCategoria.bind(catalogosController));

// Sucursales
router.get('/sucursal', autenticar, soloAdmin, catalogosController.listarSucursales.bind(catalogosController));
router.get('/sucursal/:id', autenticar, soloAdmin, catalogosController.obtenerSucursal.bind(catalogosController));
router.post('/sucursal', autenticar, soloAdmin, catalogosController.crearSucursal.bind(catalogosController));
router.put('/sucursal/:id', autenticar, soloAdmin, catalogosController.actualizarSucursal.bind(catalogosController));
router.post('/sucursal/:id/logo', autenticar, soloAdmin, uploadLogo.single('logo'), catalogosController.subirLogoLocal.bind(catalogosController));
router.post('/sucursal/:id/presign-logo', autenticar, soloAdmin, catalogosController.presignLogo.bind(catalogosController));
router.post('/sucursal/:id/confirmar-logo', autenticar, soloAdmin, catalogosController.confirmarLogo.bind(catalogosController));
router.delete('/sucursal/:id/logo', autenticar, soloAdmin, catalogosController.eliminarLogo.bind(catalogosController));

// Cargos
router.get('/cargos', autenticar, soloAdmin, catalogosController.listarCargos.bind(catalogosController));

export const catalogosRoutes = router;
