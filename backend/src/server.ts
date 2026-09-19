import { app } from './app';
import { env } from './config/env';
import { TABLE_NAME } from './db/dynamo.client';

console.log(`Backend inicializado con DynamoDB (Tabla: ${TABLE_NAME})`);

const port = env.PORT;
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor disponible en el puerto ${port}`);
});
