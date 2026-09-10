import { Router } from 'express';
import { pedidosController } from './pedidos.controller';
import { autenticar, autenticarCliente, soloAdministrador } from '../../middlewares/auth.middleware';
import { crearPedidoLimiter } from '../../middlewares/rate-limit.middleware';
import { uploadComprobante } from '../../middlewares/upload.middleware';

const clienteRouter = Router();
const adminRouter = Router();

// Rutas Cliente
clienteRouter.post('/', autenticarCliente, crearPedidoLimiter, pedidosController.crearPedido.bind(pedidosController));
clienteRouter.get('/', autenticarCliente, pedidosController.listarPedidosCliente.bind(pedidosController));
clienteRouter.get('/:id', autenticarCliente, pedidosController.obtenerPedidoCliente.bind(pedidosController));
clienteRouter.post('/:id/cancelar', autenticarCliente, pedidosController.cancelarPedidoCliente.bind(pedidosController));
clienteRouter.post('/:id/comprobante', autenticarCliente, uploadComprobante.single('comprobante'), pedidosController.subirComprobanteLocal.bind(pedidosController));
clienteRouter.post('/:id/presign-comprobante', autenticarCliente, pedidosController.presignComprobante.bind(pedidosController));
clienteRouter.post('/:id/confirmar-comprobante', autenticarCliente, pedidosController.confirmarComprobante.bind(pedidosController));
clienteRouter.get('/:id/comprobante', autenticarCliente, pedidosController.verComprobanteCliente.bind(pedidosController));

// Rutas Admin
adminRouter.get('/', autenticar, soloAdministrador, pedidosController.listarPedidosAdmin.bind(pedidosController));
adminRouter.get('/:id', autenticar, soloAdministrador, pedidosController.obtenerPedidoAdmin.bind(pedidosController));
adminRouter.get('/:id/comprobante', autenticar, soloAdministrador, pedidosController.verComprobanteAdmin.bind(pedidosController));
adminRouter.post('/:id/rechazar', autenticar, soloAdministrador, pedidosController.rechazarPedidoAdmin.bind(pedidosController));
adminRouter.post('/:id/aprobar', autenticar, soloAdministrador, pedidosController.aprobarPedidoAdmin.bind(pedidosController));
adminRouter.post('/:id/listo', autenticar, soloAdministrador, pedidosController.cambiarEstadoListo.bind(pedidosController));
adminRouter.post('/:id/entregar', autenticar, soloAdministrador, pedidosController.cambiarEstadoEntregar.bind(pedidosController));

export const clientePedidosRoutes = clienteRouter;
export const adminPedidosRoutes = adminRouter;
