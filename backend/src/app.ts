import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { productosUploadDir, tiendaUploadDir } from './middlewares/upload.middleware';
import { globalErrorHandler, notFoundHandler } from './middlewares/error.middleware';

// Routes
import { authRoutes } from './modules/auth/auth.routes';
import { productosRoutes } from './modules/productos/productos.routes';
import { catalogosRoutes } from './modules/catalogos/catalogos.routes';
import { empleadosRoutes } from './modules/empleados/empleados.routes';
import { cajaRoutes } from './modules/caja/caja.routes';
import { ventasRoutes } from './modules/ventas/ventas.routes';
import { adminPedidosRoutes, clientePedidosRoutes } from './modules/pedidos/pedidos.routes';
import { adminConfiguracionRoutes, clienteConfiguracionRoutes } from './modules/configuracion/configuracion.routes';
import { uploadsRoutes } from './modules/uploads/uploads.routes';

const app = express();
app.set('trust proxy', 1);

const clientUrls = env.CLIENT_URL
  ? env.CLIENT_URL.split(',').map((u) => u.trim()).filter(Boolean)
  : [];

const allowedOrigins = new Set([
  'http://localhost',
  'https://localhost',
  'http://localhost:8100',
  'http://localhost:8101',
  'http://localhost:4200',
  'capacitor://localhost',
  ...clientUrls,
]);

function validarOrigen(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin) return callback(null, true);
  if (allowedOrigins.has(origin)) return callback(null, true);
  if (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
    return callback(null, true);
  }
  if (/^https:\/\/[a-z0-9-]+\.cloudfront\.net$/.test(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`Origen no permitido por CORS: ${origin}`));
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: validarOrigen, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir únicamente archivos estáticos públicos (productos y tienda)
// Los comprobantes bancarios quedan excluidos de express.static
app.use('/uploads/productos', express.static(productosUploadDir));
app.use('/uploads/tienda', express.static(tiendaUploadDir));

// Rutas de la API
app.use('/auth', authRoutes);
app.use('/', productosRoutes);
app.use('/', catalogosRoutes);
app.use('/empleados', empleadosRoutes);
app.use('/caja', cajaRoutes);
app.use('/ventas', ventasRoutes);
app.use('/cliente/pedidos', clientePedidosRoutes);
app.use('/admin/pedidos', adminPedidosRoutes);
app.use('/configuracion', adminConfiguracionRoutes);
app.use('/cliente', clienteConfiguracionRoutes);
app.use('/uploads', uploadsRoutes);

// Manejadores de 404 y errores globales
app.use(notFoundHandler);
app.use(globalErrorHandler);

export { app };
