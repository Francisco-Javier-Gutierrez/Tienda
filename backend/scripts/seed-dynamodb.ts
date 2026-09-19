import { PutCommand, BatchWriteCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../src/db/dynamo.client';
import { Keys } from '../src/db/dynamo.keys';

async function seed() {
  console.log(`🌱 Iniciando seeder de DynamoDB en tabla: ${TABLE_NAME}...`);

  // 1. Sucursal
  console.log('🏬 Sembrando sucursal...');
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...Keys.sucursal(1),
        GSI1PK: 'SUCURSALES',
        GSI1SK: 'Doña paty',
        idSuc: 1,
        nombreSuc: 'Doña paty',
        descripcionSuc: 'Tu mejor opción en abarrotes y productos de calidad',
        telefonoSuc: '7298456512',
        correoSuc: 'paty@gmail.com',
        paginaWebSuc: 'https://tienda-donapaty.com',
        redSocialSuc: '@tiendadonapaty',
        logoSuc: 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com/tienda/logo-principal.png',
        direccion: {
          pais: 'México',
          estado: 'México',
          municipio: 'Toluca',
          colonia: 'Centro',
          calle: 'Av. Hidalgo',
          noExt: '101',
          noInt: 'A',
          codPostal: '50000',
        },
        fechaCreacion: new Date().toISOString(),
      },
    }),
  );

  // 2. Cargos
  console.log('💼 Sembrando cargos...');
  const cargos = [
    {
      idCargo: 1,
      idSuc: 1,
      nombreCargo: 'ADMINISTRADOR',
      descripcionCargo: 'Acceso completo a la administración de la tienda',
    },
    {
      idCargo: 2,
      idSuc: 1,
      nombreCargo: 'CAJERO',
      descripcionCargo: 'Acceso al punto de venta y cobro de productos',
    },
  ];
  for (const c of cargos) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.cargo(c.idSuc, c.idCargo),
          GSI1PK: 'CARGOS',
          GSI1SK: c.nombreCargo,
          ...c,
        },
      }),
    );
  }

  // 3. Empleados
  console.log('👥 Sembrando empleados...');
  const empleados = [
    {
      idEmp: 1,
      nombreEmp: 'Administrador',
      apellidoPatEmp: 'Tienda',
      apellidoMatEmp: 'Principal',
      edadPer: 35,
      generoPer: 'Masculino',
      correoEmp: 'admin@gmail.com',
      contrasenaHash: '$2b$10$R/HsmlNRTNeXCmudYcq.v.8K6uxoLXHzOyGEpw3WS23V1auxrXzhW', // Sandy_1234
      estadoEmp: true,
      telefono: '7221234567',
      idCargo: 1,
      idSuc: 1,
      cargoNombre: 'ADMINISTRADOR',
    },
    {
      idEmp: 2,
      nombreEmp: 'Diana Elena',
      apellidoPatEmp: 'Sanchez',
      apellidoMatEmp: 'Garcia',
      edadPer: 28,
      generoPer: 'Femenino',
      correoEmp: 'diana@gmail.com',
      contrasenaHash: '$2b$10$KwXEoSi/WH4f7M/zjCbXe.Ecf/HkZbCB7bCEzPpqf8PeFzrvHnkUq', // admin123
      estadoEmp: true,
      telefono: '7298456578',
      idCargo: 2,
      idSuc: 1,
      cargoNombre: 'CAJERO',
    },
    {
      idEmp: 3,
      nombreEmp: 'Dumb',
      apellidoPatEmp: 'User',
      apellidoMatEmp: 'Test',
      edadPer: 25,
      generoPer: 'Otro',
      correoEmp: 'dumb@user.com',
      contrasenaHash: '$2b$10$KwXEoSi/WH4f7M/zjCbXe.Ecf/HkZbCB7bCEzPpqf8PeFzrvHnkUq', // admin123
      estadoEmp: true,
      telefono: '7220000000',
      idCargo: 2,
      idSuc: 1,
      cargoNombre: 'CAJERO',
    },
  ];
  for (const emp of empleados) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.empleado(emp.idEmp),
          GSI1PK: `SUC#${emp.idSuc}#EMPLEADOS`,
          GSI1SK: `${emp.apellidoPatEmp}#${emp.nombreEmp}`,
          GSI2PK: `EMAIL#${emp.correoEmp.toLowerCase()}`,
          GSI2SK: `EMP#${emp.idEmp}`,
          ...emp,
        },
      }),
    );
    // Unicidad STD para evitar duplicados en transacciones
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `UNIQUE_EMAIL#${emp.correoEmp.toLowerCase()}`,
          SK: 'EMAIL',
          idEmp: emp.idEmp,
          tipo: 'EMPLEADO',
        },
      }),
    );
  }

  // 4. Clientes
  console.log('🛍️ Sembrando clientes...');
  const clientes = [
    {
      idCliente: 1,
      nombreCliente: 'Sandra',
      apellidoPatCliente: 'Sanchez Garcia',
      correoCliente: 'sandisg321@gmail.com',
      googleSub: '112850685949394108985',
      fotoPerfil:
        'https://lh3.googleusercontent.com/a/ACg8ocIJMPP9WjSS1Q24EvkIWBfw2WViU4TmsTmYSiDX6fsI3iew7lhadA=s96-c',
      estadoCliente: true,
    },
    {
      idCliente: 2,
      nombreCliente: 'Sandibell',
      apellidoPatCliente: 'Sánchez',
      correoCliente: 'sanchezsandibell0@gmail.com',
      googleSub: '113116239049522862563',
      fotoPerfil:
        'https://lh3.googleusercontent.com/a/ACg8ocJibMkXat3_rQQN_O4QFu0m5BgRVZ34steAf1Y7l93XZlaCOw=s96-c',
      estadoCliente: true,
    },
    {
      idCliente: 3,
      nombreCliente: 'Consultorios',
      apellidoPatCliente: 'Médicos',
      correoCliente: 'consultorios452@gmail.com',
      googleSub: '105142001509885596007',
      fotoPerfil:
        'https://lh3.googleusercontent.com/a/ACg8ocKkjRmRyBvGMUa8gupz-o0JYVKFLXqw0LjpH50A-MwA_dUT-w=s96-c',
      estadoCliente: true,
    },
  ];
  for (const cli of clientes) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.cliente(cli.idCliente),
          GSI1PK: 'CLIENTES',
          GSI1SK: `${cli.apellidoPatCliente || ''}#${cli.nombreCliente}`,
          GSI2PK: `EMAIL#${cli.correoCliente.toLowerCase()}`,
          GSI2SK: `CLI#${cli.idCliente}`,
          ...cli,
        },
      }),
    );
    // Unicidad STD por Email
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `UNIQUE_EMAIL#${cli.correoCliente.toLowerCase()}`,
          SK: 'EMAIL',
          idCliente: cli.idCliente,
          tipo: 'CLIENTE',
        },
      }),
    );
    // Unicidad STD por Google Sub si existe
    if (cli.googleSub) {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `UNIQUE_GOOGLE#${cli.googleSub}`,
            SK: 'GOOGLE_SUB',
            idCliente: cli.idCliente,
          },
        }),
      );
    }
  }

  // 5. Limpieza preventiva de datos excedentes / pruebas
  console.log('🧹 Limpiando productos, marcas y categorías excedentes...');
  for (let i = 1; i <= 30; i++) {
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: Keys.producto(1, i) })).catch(() => undefined);
  }
  for (let i = 5; i <= 15; i++) {
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: Keys.categoria(1, i) })).catch(() => undefined);
  }
  for (let i = 6; i <= 20; i++) {
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: Keys.marca(1, i) })).catch(() => undefined);
  }
  for (let i = 3; i <= 10; i++) {
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: Keys.proveedor(1, i) })).catch(() => undefined);
  }
  const oldQrs = [
    '7501055300075', '7501055310883', '7501055320509', '7501000111206', '7501000112340',
    '7501000620029', '7501017004454', '7501017001019', '7501020512106', '7501020534207',
    '7509546055176', '7501025400507', '7500435132206', '7501011131033', '7501011142015',
  ];
  for (const qr of oldQrs) {
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `QR#${qr}`, SK: 'CODE' } })).catch(() => undefined);
  }

  // 6. Categorías (4 originales)
  console.log('🏷️ Sembrando categorías originales (4)...');
  const categorias = [
    { idCat: 1, nombreCat: 'Bebidas y Refrescos', descripCat: 'Refrescos carbonatados, jugos, aguas y energéticas' },
    { idCat: 2, nombreCat: 'Abarrotes y Alimentos', descripCat: 'Despensa, latería, pastas, arroz y frijol' },
    { idCat: 3, nombreCat: 'Cuidado Personal', descripCat: 'Desodorantes, jabones y cuidado corporal' },
    { idCat: 4, nombreCat: 'Botanas y Snacks', descripCat: 'Papas, galletas, chocolates y golosinas' },
  ];
  for (const cat of categorias) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.categoria(1, cat.idCat),
          GSI1PK: 'CATEGORIAS',
          GSI1SK: cat.nombreCat,
          idSuc: 1,
          ...cat,
        },
      }),
    );
  }

  // 7. Marcas (5 originales)
  console.log('🔖 Sembrando marcas originales (5)...');
  const marcas = [
    { idMarca: 1, nombreMarca: 'Coca-Cola', descripMarca: 'Líder en refrescos y bebidas' },
    { idMarca: 2, nombreMarca: 'Sabritas', descripMarca: 'Botanas y papas saladas' },
    { idMarca: 3, nombreMarca: 'Nivea', descripMarca: 'Cuidado de la piel y desodorantes' },
    { idMarca: 4, nombreMarca: 'Obao / Garnier', descripMarca: 'Desodorantes y cuidado personal' },
    { idMarca: 5, nombreMarca: 'Bimbo', descripMarca: 'Panificación y pastelería' },
  ];
  for (const m of marcas) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.marca(1, m.idMarca),
          GSI1PK: 'MARCAS',
          GSI1SK: m.nombreMarca,
          idSuc: 1,
          ...m,
        },
      }),
    );
  }

  // 8. Proveedores (2 originales)
  console.log('🚚 Sembrando proveedores originales (2)...');
  const proveedores = [
    {
      idProv: 1,
      idSuc: 1,
      nombreProv: 'Distribuidora Femsa México',
      telefonoProv: '7225551122',
      correoProv: 'contacto@femsa.com.mx',
    },
    {
      idProv: 2,
      idSuc: 1,
      nombreProv: 'Grupo Bimbo Toluca',
      telefonoProv: '7225553344',
      correoProv: 'ventas@bimbo.com.mx',
    },
  ];
  for (const prov of proveedores) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.proveedor(1, prov.idProv),
          GSI1PK: 'PROVEEDORES',
          GSI1SK: prov.nombreProv,
          ...prov,
        },
      }),
    );
  }

  // 9. Productos (5 originales exactos)
  console.log('📦 Sembrando productos originales (5)...');
  const productos = [
    {
      idPro: 1,
      idSuc: 1,
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
      marcaNombre: 'Coca-Cola',
      idCat: 1,
      categoriaNombre: 'Bebidas y Refrescos',
    },
    {
      idPro: 2,
      idSuc: 1,
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
      marcaNombre: 'Coca-Cola',
      idCat: 1,
      categoriaNombre: 'Bebidas y Refrescos',
    },
    {
      idPro: 3,
      idSuc: 1,
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
      marcaNombre: 'Obao / Garnier',
      idCat: 3,
      categoriaNombre: 'Cuidado Personal',
    },
    {
      idPro: 4,
      idSuc: 1,
      nombrePro: 'Crema Corporal Nivea Milk Nutritiva',
      precioVentaPro: 85.0,
      costoPro: 68.0,
      existenciaPro: 10,
      stockMinimoPro: 2,
      tamanoPro: '400 ml',
      presentacionPro: 'Botella dosificadora',
      tipoPro: 'Crema corporal hidratante',
      codigoQR: '7501001150020',
      skuPro: 'NIV-MILK-400',
      imagenPro: 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com/productos/nivea-milk.png',
      activoPro: true,
      idMarca: 3,
      marcaNombre: 'Nivea',
      idCat: 3,
      categoriaNombre: 'Cuidado Personal',
    },
    {
      idPro: 5,
      idSuc: 1,
      nombrePro: 'Papas Sabritas Original Sal',
      precioVentaPro: 22.0,
      costoPro: 17.5,
      existenciaPro: 30,
      stockMinimoPro: 5,
      tamanoPro: '45 g',
      presentacionPro: 'Bolsa',
      tipoPro: 'Botana salada',
      codigoQR: '7501011115552',
      skuPro: 'SAB-SAL-45G',
      imagenPro: 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com/productos/sabritas-sal.png',
      activoPro: true,
      idMarca: 2,
      marcaNombre: 'Sabritas',
      idCat: 4,
      categoriaNombre: 'Botanas y Snacks',
    },
  ];
  for (const prod of productos) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...Keys.producto(prod.idSuc, prod.idPro),
          GSI1PK: `CAT#${prod.idCat}#PRODS`,
          GSI1SK: String(prod.precioVentaPro).padStart(8, '0'),
          GSI2PK: `QR#${prod.codigoQR}`,
          GSI2SK: `PROD#${prod.idPro}`,
          ...prod,
        },
      }),
    );
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `QR#${prod.codigoQR}`,
          SK: 'CODE',
          idPro: prod.idPro,
          idSuc: prod.idSuc,
        },
      }),
    );
  }

  // 10. Configuración de Transferencia
  console.log('💳 Sembrando configuración de transferencia...');
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...Keys.configuracion(1),
        idConfiguracion: 1,
        idSuc: 1,
        banco: 'BBVA',
        titular: 'Sandra Sánchez García',
        clabe: '012180015250213582',
        numeroCuenta: '1525021358',
        instrucciones: 'Realiza tu transferencia a esta cuenta y sube una foto o captura de tu comprobante de pago.',
        activo: true,
        fechaActualizacion: new Date().toISOString(),
      },
    }),
  );

  // 11. Sesión de Caja
  console.log('💵 Sembrando sesión de caja abierta...');
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        ...Keys.sesionCaja(1, 3),
        GSI1PK: 'EMP#1#SESIONES',
        GSI1SK: new Date().toISOString(),
        idSesionCaja: 3,
        idSuc: 1,
        idEmp: 1,
        empleadoNombre: 'Administrador Tienda',
        estado: 'ABIERTA',
        fondoInicial: 500.0,
        totalVentas: 150.0,
        fechaApertura: new Date().toISOString(),
      },
    }),
  );
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: 'SUC#1',
        SK: 'SESION_ACTIVA#1',
        idSesionCaja: 3,
        idEmp: 1,
      },
    }),
  );

  // 12. Inicializar Secuencias / Counters
  console.log('🔢 Sembrando secuencias / contadores atómicos...');
  const counters = [
    { SK: 'sucursal', currentId: 1 },
    { SK: 'cargo', currentId: 2 },
    { SK: 'empleado', currentId: 3 },
    { SK: 'cliente', currentId: 10 },
    { SK: 'categoria', currentId: 4 },
    { SK: 'marca', currentId: 5 },
    { SK: 'proveedor', currentId: 2 },
    { SK: 'producto', currentId: 5 },
    { SK: 'configuracion', currentId: 1 },
    { SK: 'sesionCaja', currentId: 3 },
    { SK: 'venta', currentId: 4 },
    { SK: 'pedidoCliente', currentId: 10 },
  ];
  for (const counter of counters) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: 'COUNTERS',
          SK: counter.SK,
          currentId: counter.currentId,
        },
      }),
    );
  }

  console.log('✅ Seeder de DynamoDB finalizado exitosamente. Todas las entidades relacionales sembradas.');
}

seed().catch((err) => {
  console.error('❌ Error en el seeder de DynamoDB:', err);
  process.exit(1);
});
