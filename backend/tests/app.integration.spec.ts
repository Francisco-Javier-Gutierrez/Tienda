import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/prisma';
import { emitirSesionCliente, emitirSesionEmpleado } from '../src/utils/security';
import { pedidosService } from '../src/modules/pedidos/pedidos.service';

describe('App End-to-End Integration Tests', () => {
  const tokenAdmin = emitirSesionEmpleado({ idEmp: 1 });
  const tokenCajero = emitirSesionEmpleado({ idEmp: 2 });
  const tokenCliente = emitirSesionCliente({ idCliente: 10 });

  beforeEach(() => {
    jest.spyOn(prisma.empleado, 'findUnique').mockImplementation(((args: any) => {
      if (args?.where?.idEmp === 1) {
        return Promise.resolve({
          idEmp: 1,
          idCargo: 1,
          estadoEmp: true,
          cargo: { nombreCargo: 'ADMINISTRADOR', idSuc: 1, sucursal: { nombreSuc: 'Central' } },
        });
      }
      return Promise.resolve({
        idEmp: 2,
        idCargo: 2,
        estadoEmp: true,
        cargo: { nombreCargo: 'CAJERO', idSuc: 1, sucursal: { nombreSuc: 'Central' } },
      });
    }) as any);

    jest.spyOn(prisma.cliente, 'findUnique').mockResolvedValue({
      idCliente: 10,
      estadoCliente: true,
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rutas Públicas', () => {
    it('GET /public/tienda debe responder 200 con lista de tiendas', async () => {
      jest.spyOn(prisma.sucursal, 'findMany').mockResolvedValue([
        {
          idSuc: 1,
          nombreSuc: 'Sucursal Matriz',
          descripcionSuc: 'Tienda principal',
          logoSuc: 'https://s3/logo.png',
        } as any,
      ]);

      const res = await request(app).get('/public/tienda');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].nombreSuc).toBe('Sucursal Matriz');
    });

    it('GET /public/productos debe responder 200 con catálogo público activo', async () => {
      jest.spyOn(prisma.producto, 'findMany').mockResolvedValue([
        {
          idPro: 1,
          nombrePro: 'Jugo de Naranja',
          precioVentaPro: 18 as any,
          existenciaPro: 10,
          tamanoPro: '500ml',
          presentacionPro: 'Botella',
          tipoPro: 'Bebida',
          imagenPro: null,
          marca: { nombreMarca: 'Del Valle' },
          categoria: { nombreCat: 'Bebidas' },
        } as any,
      ]);

      const res = await request(app).get('/public/productos');
      expect(res.status).toBe(200);
      expect(res.body[0].nombre).toBe('Jugo de Naranja');
      expect(res.body[0].marca?.nombre || res.body[0].marca).toBe('Del Valle');
    });
  });

  describe('Rutas de Rutas y Middleware', () => {
    it('Catalogos, Productos POS, Caja, Ventas y Empleados routers', async () => {
      jest.spyOn(prisma.marca, 'findMany').mockResolvedValue([]);
      const rMarcas = await request(app).get('/marca').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rMarcas.status).toBe(200);

      jest.spyOn(prisma.categoria, 'findMany').mockResolvedValue([]);
      const rCat = await request(app).get('/categoria').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rCat.status).toBe(200);

      jest.spyOn(prisma.sucursal, 'findMany').mockResolvedValue([]);
      const rSuc = await request(app).get('/sucursal').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rSuc.status).toBe(200);

      jest.spyOn(prisma.cargo, 'findMany').mockResolvedValue([]);
      const rCargos = await request(app).get('/cargos').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rCargos.status).toBe(200);

      jest.spyOn(prisma.producto, 'findMany').mockResolvedValue([]);
      const rPos = await request(app).get('/pos/productos').set('Authorization', `Bearer ${tokenCajero}`);
      expect(rPos.status).toBe(200);

      jest.spyOn(prisma.sesionCaja, 'findFirst').mockResolvedValue(null);
      const rCaja = await request(app).get('/caja/actual').set('Authorization', `Bearer ${tokenCajero}`);
      expect(rCaja.status).toBe(200);

      jest.spyOn(prisma.venta, 'findMany').mockResolvedValue([]);
      const rVentas = await request(app).get('/ventas').set('Authorization', `Bearer ${tokenCajero}`);
      expect(rVentas.status).toBe(200);

      jest.spyOn(prisma.empleado, 'findMany').mockResolvedValue([]);
      const rEmp = await request(app).get('/empleados').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rEmp.status).toBe(200);
    });

    it('Configuracion y Pedidos routers', async () => {
      jest.spyOn(prisma.configuracionTransferencia, 'findUnique').mockResolvedValue(null);
      const rConfAdmin = await request(app)
        .get('/configuracion/transferencia')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rConfAdmin.status).toBe(200);

      jest.spyOn(prisma.sucursal, 'findMany').mockResolvedValue([{ idSuc: 1 }] as any);
      jest.spyOn(prisma.configuracionTransferencia, 'findUnique').mockResolvedValue({
        idConfiguracion: 1,
        idSuc: 1,
        banco: 'BBVA',
        titular: 'Tienda',
        clabe: '012180001234567890',
        activo: true,
      } as any);
      const rConfCli = await request(app)
        .get('/cliente/configuracion-transferencia')
        .set('Authorization', `Bearer ${tokenCliente}`);
      expect(rConfCli.status).toBe(200);

      jest.spyOn(prisma.pedidoCliente, 'findMany').mockResolvedValue([]);
      const rPedCli = await request(app).get('/cliente/pedidos').set('Authorization', `Bearer ${tokenCliente}`);
      expect(rPedCli.status).toBe(200);

      jest.spyOn(pedidosService, 'obtenerPedidoSeguro').mockResolvedValue({ idPedido: 1 } as any);
      const rPedCliId = await request(app).get('/cliente/pedidos/1').set('Authorization', `Bearer ${tokenCliente}`);
      expect(rPedCliId.status).toBe(200);

      jest.spyOn(pedidosService, 'cancelarPedidoCliente').mockResolvedValue({ idPedido: 1, estado: 'CANCELADO' } as any);
      const rPedCliCanc = await request(app).post('/cliente/pedidos/1/cancelar').set('Authorization', `Bearer ${tokenCliente}`);
      expect(rPedCliCanc.status).toBe(200);

      const rPedAdmin = await request(app).get('/admin/pedidos').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rPedAdmin.status).toBe(200);

      jest.spyOn(pedidosService, 'obtenerPedidoAdmin').mockResolvedValue({ idPedido: 1 } as any);
      const rPedAdminId = await request(app).get('/admin/pedidos/1').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rPedAdminId.status).toBe(200);

      jest.spyOn(pedidosService, 'aprobarPedidoAdmin').mockResolvedValue({ idPedido: 1, estado: 'PAGADO' } as any);
      const rPedApprove = await request(app).post('/admin/pedidos/1/aprobar').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rPedApprove.status).toBe(200);

      jest.spyOn(pedidosService, 'rechazarPedidoAdmin').mockResolvedValue({ idPedido: 1, estado: 'RECHAZADO' } as any);
      const rPedReject = await request(app).post('/admin/pedidos/1/rechazar').set('Authorization', `Bearer ${tokenAdmin}`).send({ motivo: 'Invalido' });
      expect(rPedReject.status).toBe(200);

      jest.spyOn(pedidosService, 'cambiarEstadoOperativo').mockResolvedValue({ idPedido: 1, estado: 'LISTO' } as any);
      const rPedListo = await request(app).post('/admin/pedidos/1/listo').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rPedListo.status).toBe(200);

      jest.spyOn(pedidosService, 'cambiarEstadoOperativo').mockResolvedValue({ idPedido: 1, estado: 'ENTREGADO' } as any);
      const rPedEntr = await request(app).post('/admin/pedidos/1/entregar').set('Authorization', `Bearer ${tokenAdmin}`);
      expect(rPedEntr.status).toBe(200);
    });
  });

  describe('Control de Acceso y Errores 404', () => {
    it('GET /productos debe rechazar sin token con 401', async () => {
      const res = await request(app).get('/productos');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Sesión no válida');
    });

    it('GET /ruta-inexistente debe responder 404 con notFoundHandler', async () => {
      const res = await request(app).get('/api/ruta-que-no-existe');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Ruta no encontrada');
    });
  });
});
