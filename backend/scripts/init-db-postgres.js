const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initPostgres() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRESQL_URL;

  const config = connectionString
    ? {
        connectionString,
        ssl:
          process.env.PGSSLMODE === 'disable' || connectionString.includes('localhost')
            ? false
            : { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
        user: process.env.DB_USER || process.env.PGUSER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'postgres',
        database: process.env.DB_NAME || process.env.PGDATABASE || 'tienda',
        port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      };

  console.log('🔌 Conectando a PostgreSQL...');
  const pool = new Pool(config);

  try {
    const client = await pool.connect();
    console.log('✅ Conexión establecida con PostgreSQL.');

    const sqlPath = path.join(__dirname, '../../database/tienda_postgresql.sql');
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`No se encontró el archivo SQL en: ${sqlPath}`);
    }

    console.log('📜 Ejecutando script de esquema y seeders...');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);

    console.log('🎉 ¡Base de datos PostgreSQL inicializada con éxito con todos los seeders y relaciones!');
    client.release();
  } catch (error) {
    console.error('❌ Error al inicializar PostgreSQL:', error.message || error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initPostgres();
