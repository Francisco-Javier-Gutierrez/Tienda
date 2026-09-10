import { Prisma, PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prismaClient: PrismaClient | undefined;
}

let dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';

// Si la URL se truncó en el wrap de terminal (.c- sin .neon.tech)
if (dbUrl.includes('ep-long-sea-ausqd8mj-pooler.c-') && !dbUrl.includes('.neon.tech')) {
  dbUrl = dbUrl.replace(
    'ep-long-sea-ausqd8mj-pooler.c-',
    'ep-long-sea-ausqd8mj-pooler.c-10.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require&connection_limit=1&pgbouncer=true'
  );
}

// Asegurar connection_limit=1 para entornos serverless con PgBouncer
if (dbUrl && dbUrl.includes('pooler') && !dbUrl.includes('connection_limit')) {
  const separator = dbUrl.includes('?') ? '&' : '?';
  dbUrl = `${dbUrl}${separator}connection_limit=1&pgbouncer=true`;
}

export const prisma: PrismaClient =
  global.__prismaClient ||
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });


// En entornos Serverless (Vercel/Lambda), reutilizar el cliente en contenedores activos (warm)
global.__prismaClient = prisma;

export type TransactionClient = Prisma.TransactionClient;
export type DbClient = PrismaClient | TransactionClient;
