import { Prisma, PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prismaClient ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// En entornos Serverless (Vercel/Lambda), reutilizar el cliente en contenedores activos (warm)
global.__prismaClient = prisma;

export type TransactionClient = Prisma.TransactionClient;
export type DbClient = PrismaClient | TransactionClient;
