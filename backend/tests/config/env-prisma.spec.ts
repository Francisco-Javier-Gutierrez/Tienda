import { env } from '../../src/config/env';
import { prisma } from '../../src/config/prisma';

describe('Config Environment and Prisma', () => {
  it('env debe exportar variables de entorno correctamente', () => {
    expect(env.NODE_ENV).toBeDefined();
    expect(env.PORT).toBeDefined();
    expect(env.OPEN_FOOD_FACTS_USER_AGENT).toBeDefined();
  });

  it('prisma client debe estar inicializado', () => {
    expect(prisma).toBeDefined();
    expect(prisma.$transaction).toBeDefined();
  });
});
