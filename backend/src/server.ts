import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

prisma
  .$connect()
  .then(() => {
    console.log('Conectado a PostgreSQL mediante Prisma Client');
  })
  .catch((error: any) => {
    console.error('No se pudo conectar a PostgreSQL mediante Prisma:', error?.message || error);
  });

const port = env.PORT;
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor disponible en el puerto ${port}`);
});
