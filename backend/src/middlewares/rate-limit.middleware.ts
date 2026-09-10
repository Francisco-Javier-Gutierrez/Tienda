import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { message: 'Demasiados intentos de inicio de sesión. Por favor intenta más tarde.' },
});

export const crearPedidoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { message: 'Demasiadas solicitudes de creación de pedidos. Por favor espera un momento.' },
});

