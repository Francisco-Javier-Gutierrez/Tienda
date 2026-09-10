import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  HASHIDS_SALT: process.env.HASHIDS_SALT || 'TiendaHashidsSaltSecret2026',
  CLIENT_URL: process.env.CLIENT_URL,

  // AWS S3
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  // Open Food Facts
  OPEN_FOOD_FACTS_USER_AGENT:
    process.env.OPEN_FOOD_FACTS_USER_AGENT || 'TiendaInventario/0.0.1 (contacto: administrador local)',
};

