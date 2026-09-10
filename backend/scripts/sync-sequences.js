const prisma = require('../prisma/client');

async function syncAllSequences() {
  console.log('🔄 Sincronizando secuencias de PostgreSQL...');

  const tables = [
    { table: 'direccion', col: 'iddir' },
    { table: 'sucursal', col: 'idsuc' },
    { table: 'cargo', col: 'idcargo' },
    { table: 'empleados', col: 'idemp' },
    { table: 'cliente', col: 'idcliente' },
    { table: 'categoria', col: 'idcat' },
    { table: 'marca', col: 'idmarca' },
    { table: 'proveedor', col: 'idprov' },
    { table: 'productos', col: 'idpro' },
    { table: 'compra', col: 'idcompra' },
    { table: 'detcompra', col: 'iddetcompra' },
    { table: 'sesion_caja', col: 'idsesioncaja' },
    { table: 'movimiento_caja', col: 'idmovimientocaja' },
    { table: 'venta', col: 'idventa' },
    { table: 'detventa', col: 'iddetventa' },
    { table: 'configuracion_transferencia', col: 'idconfiguracion' },
    { table: 'pedido_cliente', col: 'idpedido' },
    { table: 'detalle_pedido_cliente', col: 'iddetallepedido' },
  ];

  for (const { table, col } of tables) {
    try {
      const result = await prisma.$queryRawUnsafe(`
        SELECT setval(
          pg_get_serial_sequence('"${table}"', '${col}'),
          COALESCE((SELECT MAX("${col}") FROM "${table}"), 1),
          (SELECT COUNT(*) > 0 FROM "${table}")
        ) AS last_val;
      `);
      console.log(`  ✓ ${table}.${col} -> valor: ${result[0]?.last_val}`);
    } catch (error) {
      console.warn(`  ⚠️ No se pudo sincronizar secuencia para ${table}.${col}:`, error.message);
    }
  }

  console.log('✅ Sincronización de secuencias completada.');
}

if (require.main === module) {
  syncAllSequences()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (e) => {
      console.error('❌ Error al sincronizar secuencias:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}

module.exports = { syncAllSequences };
