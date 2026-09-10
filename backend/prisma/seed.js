const prisma = require('./client');

async function main() {
  console.log('🌱 Iniciando seeder con Prisma ORM...');

  // 1. Direcciones
  console.log('📍 Sembrando direcciones...');
  await prisma.direccion.upsert({
    where: { idDir: 1 },
    update: {},
    create: {
      idDir: 1,
      pais: 'México',
      estado: 'México',
      municipio: 'Toluca',
      colonia: 'Centro',
      calle: 'Av. Hidalgo',
      noExt: '101',
      noInt: 'A',
      codPostal: '50000',
    },
  });

  await prisma.direccion.upsert({
    where: { idDir: 2 },
    update: {},
    create: {
      idDir: 2,
      pais: 'México',
      estado: 'México',
      municipio: 'Metepec',
      colonia: 'Providencia',
      calle: 'Calle Benito Juárez',
      noExt: '204',
      codPostal: '52140',
    },
  });

  // 2. Sucursal
  console.log('🏬 Sembrando sucursal...');
  await prisma.sucursal.upsert({
    where: { idSuc: 1 },
    update: {},
    create: {
      idSuc: 1,
      nombreSuc: 'Doña paty',
      descripcionSuc: 'Tu mejor opción en abarrotes y productos de calidad',
      telefonoSuc: '7298456512',
      correoSuc: 'paty@gmail.com',
      paginaWebSuc: 'https://tienda-donapaty.com',
      redSocialSuc: '@tiendadonapaty',
      logoSuc: 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com/tienda/logo-principal.png',
      idDir: 1,
    },
  });

  // 3. Cargos
  console.log('💼 Sembrando cargos...');
  await prisma.cargo.upsert({
    where: { idCargo: 1 },
    update: {},
    create: {
      idCargo: 1,
      nombreCargo: 'ADMINISTRADOR',
      descripcionCargo: 'Acceso completo a la administración de la tienda',
      idSuc: 1,
    },
  });

  await prisma.cargo.upsert({
    where: { idCargo: 2 },
    update: {},
    create: {
      idCargo: 2,
      nombreCargo: 'CAJERO',
      descripcionCargo: 'Acceso al punto de venta y cobro de productos',
      idSuc: 1,
    },
  });

  // 4. Empleados
  console.log('👥 Sembrando empleados...');
  await prisma.empleado.upsert({
    where: { correoEmp: 'admin@gmail.com' },
    update: {},
    create: {
      idEmp: 1,
      nombreEmp: 'Administrador',
      apellidoPatEmp: 'Tienda',
      apellidoMatEmp: 'Principal',
      edadPer: 35,
      generoPer: 'Masculino',
      correoEmp: 'admin@gmail.com',
      contrasenaHash: '$2b$12$LrHug.oGSGD1HyV/DjAmweZMkuOpyaGAmLf7LVBvSBcSO7Gg.j4xu',
      estadoEmp: true,
      telefono: '7221234567',
      idDir: 1,
      idCargo: 1,
    },
  });

  await prisma.empleado.upsert({
    where: { correoEmp: 'diana@gmail.com' },
    update: {},
    create: {
      idEmp: 2,
      nombreEmp: 'Diana Elena',
      apellidoPatEmp: 'Sanchez',
      apellidoMatEmp: 'Garcia',
      edadPer: 28,
      generoPer: 'Femenino',
      correoEmp: 'diana@gmail.com',
      contrasenaHash: '$2b$12$bxT2KK0A1pXZeMNdSlv6jeCAqy9cjqgGpPYCsWbnvWeZDcSQQ4KHa',
      estadoEmp: true,
      telefono: '7298456578',
      idDir: 2,
      idCargo: 2,
    },
  });

  await prisma.empleado.upsert({
    where: { correoEmp: 'dumb@user.com' },
    update: {
      contrasenaHash: '$2b$12$mcSBVhI4MURCB3ZqM.9tQuD9C7w3CZoMFDK01IM0.2TMqUAzkYlOK',
      estadoEmp: true,
    },
    create: {
      idEmp: 3,
      nombreEmp: 'Dumb',
      apellidoPatEmp: 'User',
      apellidoMatEmp: 'Test',
      edadPer: 25,
      generoPer: 'Otro',
      correoEmp: 'dumb@user.com',
      contrasenaHash: '$2b$12$mcSBVhI4MURCB3ZqM.9tQuD9C7w3CZoMFDK01IM0.2TMqUAzkYlOK',
      estadoEmp: true,
      telefono: '7220000000',
      idDir: 1,
      idCargo: 2,
    },
  });

  // 5. Clientes
  console.log('🛍️ Sembrando clientes...');
  await prisma.cliente.upsert({
    where: { correoCliente: 'sandisg321@gmail.com' },
    update: {},
    create: {
      idCliente: 1,
      nombreCliente: 'Sandra',
      apellidoPatCliente: 'Sanchez Garcia',
      correoCliente: 'sandisg321@gmail.com',
      googleSub: '112850685949394108985',
      fotoPerfil:
        'https://lh3.googleusercontent.com/a/ACg8ocIJMPP9WjSS1Q24EvkIWBfw2WViU4TmsTmYSiDX6fsI3iew7lhadA=s96-c',
      estadoCliente: true,
    },
  });

  await prisma.cliente.upsert({
    where: { correoCliente: 'sanchezsandibell0@gmail.com' },
    update: {},
    create: {
      idCliente: 2,
      nombreCliente: 'Sandibell',
      apellidoPatCliente: 'Sánchez',
      correoCliente: 'sanchezsandibell0@gmail.com',
      googleSub: '113116239049522862563',
      fotoPerfil: 'https://lh3.googleusercontent.com/a/ACg8ocJibMkXat3_rQQN_O4QFu0m5BgRVZ34steAf1Y7l93XZlaCOw=s96-c',
      estadoCliente: true,
    },
  });

  await prisma.cliente.upsert({
    where: { correoCliente: 'consultorios452@gmail.com' },
    update: {},
    create: {
      idCliente: 3,
      nombreCliente: 'Consultorios',
      apellidoPatCliente: 'Médicos',
      correoCliente: 'consultorios452@gmail.com',
      googleSub: '105142001509885596007',
      fotoPerfil: 'https://lh3.googleusercontent.com/a/ACg8ocKkjRmRyBvGMUa8gupz-o0JYVKFLXqw0LjpH50A-MwA_dUT-w=s96-c',
      estadoCliente: true,
    },
  });

  // 6. Categorías
  console.log('🏷️ Sembrando categorías...');
  const categorias = [
    { idCat: 1, nombreCat: 'Bebidas y Refrescos', descripCat: 'Refrescos carbonatados, jugos, aguas y energéticas' },
    { idCat: 2, nombreCat: 'Abarrotes y Alimentos', descripCat: 'Despensa, latería, pastas, arroz y frijol' },
    { idCat: 3, nombreCat: 'Cuidado Personal', descripCat: 'Desodorantes, jabones y cuidado corporal' },
    { idCat: 4, nombreCat: 'Botanas y Snacks', descripCat: 'Papas, galletas, chocolates y golosinas' },
  ];
  for (const cat of categorias) {
    await prisma.categoria.upsert({ where: { idCat: cat.idCat }, update: {}, create: cat });
  }

  // 7. Marcas
  console.log('🔖 Sembrando marcas...');
  const marcas = [
    { idMarca: 1, nombreMarca: 'Coca-Cola', descripMarca: 'Líder en refrescos y bebidas' },
    { idMarca: 2, nombreMarca: 'Sabritas', descripMarca: 'Botanas y papas saladas' },
    { idMarca: 3, nombreMarca: 'Nivea', descripMarca: 'Cuidado de la piel y desodorantes' },
    { idMarca: 4, nombreMarca: 'Obao / Garnier', descripMarca: 'Desodorantes y cuidado personal' },
    { idMarca: 5, nombreMarca: 'Bimbo', descripMarca: 'Panificación y pastelería' },
  ];
  for (const m of marcas) {
    await prisma.marca.upsert({ where: { idMarca: m.idMarca }, update: {}, create: m });
  }

  // 8. Proveedores
  console.log('🚚 Sembrando proveedores...');
  await prisma.proveedor.upsert({
    where: { idProv: 1 },
    update: {},
    create: {
      idProv: 1,
      nombreProv: 'Distribuidora Femsa México',
      telefonoProv: '7225551122',
      correoProv: 'contacto@femsa.com.mx',
      pagwebProv: 'https://femsa.com',
      redsocialProv: '@femsamx',
      idDir: 1,
    },
  });

  await prisma.proveedor.upsert({
    where: { idProv: 2 },
    update: {},
    create: {
      idProv: 2,
      nombreProv: 'Grupo Bimbo Toluca',
      telefonoProv: '7225553344',
      correoProv: 'ventas@bimbo.com.mx',
      pagwebProv: 'https://bimbo.com.mx',
      redsocialProv: '@bimbomx',
      idDir: 2,
    },
  });

  // 9. Productos
  console.log('📦 Sembrando productos...');
  const productos = [
    {
      idPro: 1,
      nombrePro: 'Coca-Cola Original',
      precioVentaPro: 50.0,
      costoPro: 42.0,
      existenciaPro: 24,
      stockMinimoPro: 5,
      tamanoPro: '3 Litros',
      presentacionPro: 'Botella No Retornable',
      tipoPro: 'Refresco',
      codigoQR: '7501054549864',
      skuPro: 'COCA-3L-NR',
      imagenPro: 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com/productos/coca-cola-3l.png',
      activoPro: true,
      idMarca: 1,
      idCat: 1,
    },
    {
      idPro: 2,
      nombrePro: 'Coca-Cola Sin Azúcar',
      precioVentaPro: 35.0,
      costoPro: 28.0,
      existenciaPro: 18,
      stockMinimoPro: 4,
      tamanoPro: '2 Litros',
      presentacionPro: 'Botella No Retornable',
      tipoPro: 'Refresco',
      codigoQR: '7501054549871',
      skuPro: 'COCA-2L-SA',
      imagenPro: 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com/productos/coca-cola-2l.png',
      activoPro: true,
      idMarca: 1,
      idCat: 1,
    },
    {
      idPro: 3,
      nombrePro: 'Desodorante Obao For Men',
      precioVentaPro: 30.0,
      costoPro: 22.0,
      existenciaPro: 15,
      stockMinimoPro: 3,
      tamanoPro: '65 g',
      presentacionPro: 'Roll-on',
      tipoPro: 'Antitranspirante',
      codigoQR: '7509552876383',
      skuPro: 'OBAO-65G-MEN',
      imagenPro: 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com/productos/obao-men.png',
      activoPro: true,
      idMarca: 4,
      idCat: 3,
    },
    {
      idPro: 4,
      nombrePro: 'Crema Corporal Nivea Milk Nutritiva',
      precioVentaPro: 85.0,
      costoPro: 68.0,
      existenciaPro: 10,
      stockMinimoPro: 2,
      tamanoPro: '400 ml',
      presentacionPro: 'Botella Dosificadora',
      tipoPro: 'Cuidado Personal',
      codigoQR: '7501001150020',
      skuPro: 'NIV-MILK-400',
      imagenPro: 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com/productos/nivea-milk.png',
      activoPro: true,
      idMarca: 3,
      idCat: 3,
    },
    {
      idPro: 5,
      nombrePro: 'Papas Sabritas Original Sal',
      precioVentaPro: 22.0,
      costoPro: 17.5,
      existenciaPro: 30,
      stockMinimoPro: 6,
      tamanoPro: '45 g',
      presentacionPro: 'Bolsa',
      tipoPro: 'Botana',
      codigoQR: '7501011115552',
      skuPro: 'SAB-SAL-45G',
      imagenPro: 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com/productos/sabritas-sal.png',
      activoPro: true,
      idMarca: 2,
      idCat: 4,
    },
  ];
  for (const p of productos) {
    await prisma.producto.upsert({ where: { idPro: p.idPro }, update: {}, create: p });
  }

  // 10. Configuración de Transferencia
  console.log('💳 Sembrando configuración de transferencias...');
  await prisma.configuracionTransferencia.upsert({
    where: { idSuc: 1 },
    update: {},
    create: {
      idConfiguracion: 1,
      idSuc: 1,
      banco: 'BBVA',
      titular: 'Sandra Sánchez García',
      clabe: '012180015250213582',
      numeroCuenta: '1525021358',
      instrucciones: 'Realiza tu transferencia a esta cuenta y sube una foto o captura de tu comprobante de pago.',
      activo: true,
    },
  });

  // 11. Sesiones de Caja
  console.log('💵 Sembrando sesiones de caja...');
  await prisma.sesionCaja.upsert({
    where: { idSesionCaja: 1 },
    update: {},
    create: {
      idSesionCaja: 1,
      uuidSesionCaja: '6486c696-8980-4e97-a52d-a4dc459bfc2c',
      idEmp: 2,
      idSuc: 1,
      fondoInicial: 500.0,
      totalVentas: 0.0,
      totalEfectivo: 0.0,
      totalTarjeta: 0.0,
      totalTransferencia: 0.0,
      totalIngresos: 100.0,
      totalRetiros: 0.0,
      efectivoEsperado: 600.0,
      efectivoContado: 600.0,
      diferencia: 0.0,
      numeroVentas: 0,
      estado: 'CERRADA',
      observaciones: 'Validación automática',
    },
  });

  await prisma.sesionCaja.upsert({
    where: { idSesionCaja: 2 },
    update: {},
    create: {
      idSesionCaja: 2,
      uuidSesionCaja: 'f21925ec-1b32-48f7-a495-74082fb4eb1b',
      idEmp: 2,
      idSuc: 1,
      fondoInicial: 500.0,
      totalVentas: 50.0,
      totalEfectivo: 50.0,
      totalTarjeta: 0.0,
      totalTransferencia: 0.0,
      totalIngresos: 100.0,
      totalRetiros: 50.0,
      efectivoEsperado: 600.0,
      efectivoContado: 600.0,
      diferencia: 0.0,
      numeroVentas: 1,
      estado: 'CERRADA',
      observaciones: 'Cierre final controlado',
    },
  });

  await prisma.sesionCaja.upsert({
    where: { idSesionCaja: 3 },
    update: {},
    create: {
      idSesionCaja: 3,
      uuidSesionCaja: 'ba95303a-6cc8-4d5f-89e3-775b4e94a2c1',
      idEmp: 1,
      idSuc: 1,
      fondoInicial: 500.0,
      totalVentas: 150.0,
      totalEfectivo: 100.0,
      totalTarjeta: 50.0,
      totalTransferencia: 0.0,
      totalIngresos: 50.0,
      totalRetiros: 0.0,
      efectivoEsperado: 650.0,
      numeroVentas: 2,
      estado: 'ABIERTA',
      observaciones: 'Sesión de caja matutina activa',
    },
  });

  const { syncAllSequences } = require('../scripts/sync-sequences');
  await syncAllSequences();

  console.log('🎉 Seeder de Prisma completado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seeder de Prisma:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
