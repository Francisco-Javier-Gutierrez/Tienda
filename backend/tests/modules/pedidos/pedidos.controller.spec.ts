import { Request, Response } from 'express';
import { pedidosController } from '../../../src/modules/pedidos/pedidos.controller';
import * as pedidosModule from '../../../src/modules/pedidos/pedidos.service';
import { prisma } from '../../../src/config/prisma';

describe('PedidosController Comprehensive Suite', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      params: {},
      body: {},
      query: {},
      cliente: { idCliente: 1 } as any,
      empleado: { idEmp: 1, idSuc: 1, cargo: 'ADMINISTRADOR' } as any,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      sendFile: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Cliente Endpoints', () => {
    it('crearPedido y listarPedidosCliente', async () => {
      mockReq.cliente = undefined;
      await pedidosController.crearPedido(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.cliente = { idCliente: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'crearPedidoCliente').mockResolvedValue({ idPedido: 10 } as any);
      await pedidosController.crearPedido(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(201);

      mockReq.cliente = undefined;
      await pedidosController.listarPedidosCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.cliente = { idCliente: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'liberarPedidosExpirados').mockResolvedValue(undefined as any);
      jest.spyOn(prisma.pedidoCliente, 'findMany').mockResolvedValue([{ idPedido: 10 }] as any);
      jest.spyOn(pedidosModule.pedidosService, 'obtenerPedidoSeguro').mockResolvedValue({ idPedido: 10 } as any);
      await pedidosController.listarPedidosCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('obtenerPedidoCliente y cancelarPedidoCliente', async () => {
      mockReq.params = { id: 'invalido' };
      await pedidosController.obtenerPedidoCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.cliente = undefined;
      await pedidosController.obtenerPedidoCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.cliente = { idCliente: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'liberarPedidosExpirados').mockResolvedValue(undefined as any);
      jest.spyOn(pedidosModule.pedidosService, 'obtenerPedidoSeguro').mockResolvedValueOnce(null);
      await pedidosController.obtenerPedidoCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      jest.spyOn(pedidosModule.pedidosService, 'obtenerPedidoSeguro').mockResolvedValueOnce({ idPedido: 1 } as any);
      await pedidosController.obtenerPedidoCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idPedido: 1 });

      // Cancelar
      mockReq.params = { id: 'invalido' };
      await pedidosController.cancelarPedidoCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.cliente = undefined;
      await pedidosController.cancelarPedidoCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.cliente = { idCliente: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'cancelarPedidoCliente').mockResolvedValue({ idPedido: 1, estado: 'CANCELADO' } as any);
      await pedidosController.cancelarPedidoCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idPedido: 1, estado: 'CANCELADO' });
    });

    it('subirComprobanteLocal validaciones, error handling y subida', async () => {
      mockReq.params = { id: 'invalido' };
      mockReq.file = { path: 'path' } as any;
      await pedidosController.subirComprobanteLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.cliente = undefined;
      await pedidosController.subirComprobanteLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.cliente = { idCliente: 1 } as any;
      mockReq.file = undefined;
      await pedidosController.subirComprobanteLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      // Formato no permitido
      mockReq.file = { path: 'path', filename: 'f.txt', originalname: 'f.txt' } as any;
      jest.spyOn(pedidosModule, 'mimeRealComprobante').mockReturnValueOnce(null);
      await pedidosController.subirComprobanteLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      // Error con status desde servicio
      jest.spyOn(pedidosModule, 'mimeRealComprobante').mockReturnValue('image/jpeg');
      jest.spyOn(pedidosModule.pedidosService, 'confirmarComprobante').mockRejectedValueOnce({ status: 409, message: 'Conflicto' });
      await pedidosController.subirComprobanteLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(409);

      // Error generico
      jest.spyOn(pedidosModule.pedidosService, 'confirmarComprobante').mockRejectedValueOnce(new Error('Fatal'));
      await expect(pedidosController.subirComprobanteLocal(mockReq as Request, mockRes as Response)).rejects.toThrow('Fatal');

      // Exito
      jest.spyOn(pedidosModule.pedidosService, 'confirmarComprobante').mockResolvedValue({ idPedido: 1 } as any);
      await pedidosController.subirComprobanteLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idPedido: 1 });
    });

    it('presignComprobante y confirmarComprobante', async () => {
      mockReq.params = { id: 'invalido' };
      await pedidosController.presignComprobante(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.cliente = undefined;
      await pedidosController.presignComprobante(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.cliente = { idCliente: 1 } as any;
      mockReq.body = { mimeType: 'audio/mp3' };
      await pedidosController.presignComprobante(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.body = { mimeType: 'image/png' };
      jest.spyOn(pedidosModule.pedidosService, 'presignComprobante').mockResolvedValue({ uploadUrl: 'http://url' } as any);
      await pedidosController.presignComprobante(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();

      // Confirmar
      mockReq.params = { id: 'invalido' };
      await pedidosController.confirmarComprobante(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.cliente = undefined;
      await pedidosController.confirmarComprobante(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.cliente = { idCliente: 1 } as any;
      mockReq.body = {};
      await pedidosController.confirmarComprobante(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.body = { key: 'comprobantes/foto.jpg' };
      jest.spyOn(pedidosModule.pedidosService, 'confirmarComprobante').mockResolvedValue({ idPedido: 1 } as any);
      await pedidosController.confirmarComprobante(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idPedido: 1 });
    });

    it('verComprobanteCliente (s3 y local)', async () => {
      mockReq.params = { id: 'invalido' };
      await pedidosController.verComprobanteCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.cliente = undefined;
      await pedidosController.verComprobanteCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.cliente = { idCliente: 1 } as any;
      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValueOnce(null);
      await pedidosController.verComprobanteCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      // S3 con json y con redirect
      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValue({
        comprobanteRuta: 'https://bucket.s3.amazonaws.com/key.jpg',
        comprobanteMime: 'image/jpeg',
        comprobanteNombre: 'comprobante.jpg',
      } as any);
      mockReq.query = { json: 'true' };
      await pedidosController.verComprobanteCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();

      mockReq.query = {};
      await pedidosController.verComprobanteCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.redirect).toHaveBeenCalled();

      // Local encontrado y no encontrado
      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValue({
        comprobanteRuta: 'local-file.jpg',
        comprobanteMime: 'image/jpeg',
        comprobanteNombre: 'comprobante.jpg',
      } as any);
      jest.spyOn(pedidosModule, 'resolverComprobantePrivado').mockReturnValueOnce(null);
      await pedidosController.verComprobanteCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      jest.spyOn(pedidosModule, 'resolverComprobantePrivado').mockReturnValueOnce('/tmp/local-file.jpg');
      await pedidosController.verComprobanteCliente(mockReq as Request, mockRes as Response);
      expect(mockRes.sendFile).toHaveBeenCalledWith('/tmp/local-file.jpg');
    });
  });

  describe('Admin Endpoints', () => {
    it('listarPedidosAdmin y obtenerPedidoAdmin', async () => {
      mockReq.empleado = { idEmp: 1, idSuc: null } as any;
      await pedidosController.listarPedidosAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(409);

      mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'liberarPedidosExpirados').mockResolvedValue(undefined as any);
      jest.spyOn(prisma.pedidoCliente, 'findMany').mockResolvedValue([]);
      await pedidosController.listarPedidosAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();

      // Obtener
      mockReq.params = { id: 'invalido' };
      await pedidosController.obtenerPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.empleado = { idEmp: 1, idSuc: null } as any;
      await pedidosController.obtenerPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(409);

      mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'obtenerPedidoAdmin').mockResolvedValueOnce(null);
      await pedidosController.obtenerPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      jest.spyOn(pedidosModule.pedidosService, 'obtenerPedidoAdmin').mockResolvedValueOnce({ idPedido: 1 } as any);
      await pedidosController.obtenerPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idPedido: 1 });
    });

    it('verComprobanteAdmin validaciones (s3 y local)', async () => {
      mockReq.params = { id: 'invalido' };
      await pedidosController.verComprobanteAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.empleado = { idEmp: 1, idSuc: null } as any;
      await pedidosController.verComprobanteAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(409);

      mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValueOnce(null);
      await pedidosController.verComprobanteAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValue({
        comprobanteRuta: 'https://bucket.s3.amazonaws.com/key.jpg',
        comprobanteMime: 'image/jpeg',
        comprobanteNombre: 'comprobante.jpg',
      } as any);
      mockReq.query = { json: 'true' };
      await pedidosController.verComprobanteAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();

      mockReq.query = {};
      await pedidosController.verComprobanteAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.redirect).toHaveBeenCalled();

      // Local
      jest.spyOn(prisma.pedidoCliente, 'findFirst').mockResolvedValue({
        comprobanteRuta: 'local-file.jpg',
        comprobanteMime: 'image/jpeg',
        comprobanteNombre: 'comprobante.jpg',
      } as any);
      jest.spyOn(pedidosModule, 'resolverComprobantePrivado').mockReturnValueOnce(null);
      await pedidosController.verComprobanteAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      jest.spyOn(pedidosModule, 'resolverComprobantePrivado').mockReturnValueOnce('/tmp/local-file.jpg');
      await pedidosController.verComprobanteAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.sendFile).toHaveBeenCalledWith('/tmp/local-file.jpg');
    });

    it('rechazarPedidoAdmin, aprobarPedidoAdmin y cambios de estado', async () => {
      mockReq.params = { id: 'invalido' };
      await pedidosController.rechazarPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.empleado = { idEmp: 1, idSuc: null } as any;
      await pedidosController.rechazarPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'rechazarPedidoAdmin').mockResolvedValue({ idPedido: 1, estado: 'RECHAZADO' } as any);
      await pedidosController.rechazarPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();

      // Aprobar
      mockReq.params = { id: 'invalido' };
      await pedidosController.aprobarPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.empleado = { idEmp: 1, idSuc: null } as any;
      await pedidosController.aprobarPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(401);

      mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'aprobarPedidoAdmin').mockResolvedValue({ idPedido: 1, estado: 'PAGADO' } as any);
      await pedidosController.aprobarPedidoAdmin(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();

      // Cambiar estado listo / entregar
      mockReq.params = { id: 'invalido' };
      await pedidosController.cambiarEstadoListo(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.empleado = { idEmp: 1, idSuc: null } as any;
      await pedidosController.cambiarEstadoListo(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(409);

      mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'cambiarEstadoOperativo').mockResolvedValue({ idPedido: 1, estado: 'LISTO' } as any);
      await pedidosController.cambiarEstadoListo(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();

      mockReq.params = { id: 'invalido' };
      await pedidosController.cambiarEstadoEntregar(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.empleado = { idEmp: 1, idSuc: null } as any;
      await pedidosController.cambiarEstadoEntregar(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(409);

      mockReq.empleado = { idEmp: 1, idSuc: 1 } as any;
      jest.spyOn(pedidosModule.pedidosService, 'cambiarEstadoOperativo').mockResolvedValue({ idPedido: 1, estado: 'ENTREGADO' } as any);
      await pedidosController.cambiarEstadoEntregar(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });
});
