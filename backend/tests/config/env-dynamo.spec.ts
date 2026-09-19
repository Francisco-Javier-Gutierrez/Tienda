import { env } from '../../src/config/env';
import { TABLE_NAME, docClient } from '../../src/db/dynamo.client';

describe('Config Environment and DynamoDB Client', () => {
  it('env debe exportar variables de entorno correctamente', () => {
    expect(env.NODE_ENV).toBeDefined();
    expect(env.PORT).toBeDefined();
    expect(env.OPEN_FOOD_FACTS_USER_AGENT).toBeDefined();
  });

  it('dynamo client debe estar inicializado', () => {
    expect(TABLE_NAME).toBeDefined();
    expect(docClient).toBeDefined();
    expect(typeof docClient.send).toBe('function');
  });
});
