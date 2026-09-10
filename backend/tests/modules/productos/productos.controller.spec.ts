import fs from 'fs';
import { Request, Response } from 'express';
import { productosController } from '../../../src/modules/productos/productos.controller';
import { productosService } from '../../../src/modules/productos/productos.service';
import { prisma } from '../../../src/config/prisma';

describe('ProductosController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = { params: {}, body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.spyOn(fs, 'unlink').mockImplementation(((path: any, cb: any) => {
      if (typeof cb === 'function') cb();
    }) as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('listarAdmin, listarPos y listarPublico', async () => {
    jest.spyOn(productosService, 'listarAdmin').mockResolvedValue([{ idPro: 1 } as any]);
    await productosController.listarAdmin(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith([{ idPro: 1 }]);

    jest.spyOn(productosService, 'listarPos').mockResolvedValue([{ idPro: 2 } as any]);
    await productosController.listarPos(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith([{ idPro: 2 }]);

    jest.spyOn(productosService, 'listarPublico').mockResolvedValue([{ idPro: 3 } as any]);
    await productosController.listarPublico(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith([{ idPro: 3 }]);
  });

  it('buscarPorQR y consultarExterno', async () => {
    mockReq.params = { codigo: 'QR123' };
    jest.spyOn(productosService, 'buscarPorQR').mockResolvedValueOnce(null);
    await productosController.buscarPorQR(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(404);

    jest.spyOn(productosService, 'buscarPorQR').mockResolvedValueOnce({ idPro: 1, nombrePro: 'Test' } as any);
    await productosController.buscarPorQR(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ idPro: 1, nombrePro: 'Test' });

    jest.spyOn(productosService, 'consultarExterno').mockResolvedValue({ encontrado: true } as any);
    await productosController.consultarExterno(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ encontrado: true });
  });

  it('crear debe responder 201 con nuevo producto', async () => {
    mockReq.body = { nombre: 'Nuevo', precio: 10, existencia: 5, idMarca: 1, idCat: 1 };
    jest.spyOn(productosService, 'crear').mockResolvedValue({ idPro: 20 } as any);

    await productosController.crear(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({ idPro: 20 });
  });

  it('subirImagenLocal validaciones, subida y captura de error', async () => {
    mockReq.params = { id: 'invalido' };
    mockReq.file = { path: 'path', filename: 'foto.jpg' } as any;
    await productosController.subirImagenLocal(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '1' };
    mockReq.file = undefined;
    await productosController.subirImagenLocal(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.file = { path: 'path', filename: 'foto.jpg' } as any;
    jest.spyOn(productosService, 'obtenerProducto').mockResolvedValueOnce(null);
    await productosController.subirImagenLocal(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(404);

    // Error en base de datos al guardar imagen
    jest.spyOn(productosService, 'obtenerProducto').mockResolvedValueOnce({ idPro: 1 } as any);
    jest.spyOn(prisma.producto, 'update').mockRejectedValueOnce(new Error('DB Error'));
    await expect(productosController.subirImagenLocal(mockReq as Request, mockRes as Response)).rejects.toThrow('DB Error');

    // Éxito
    jest.spyOn(productosService, 'obtenerProducto')
      .mockResolvedValueOnce({ idPro: 1 } as any)
      .mockResolvedValueOnce({ idPro: 1, imagenPro: '/uploads/productos/foto.jpg' } as any);
    jest.spyOn(prisma.producto, 'update').mockResolvedValue({ idPro: 1 } as any);

    await productosController.subirImagenLocal(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalled();
  });

  it('presignImagen y confirmarImagen', async () => {
    mockReq.params = { id: 'invalido' };
    await productosController.presignImagen(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '1' };
    mockReq.body = {};
    await productosController.presignImagen(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.body = { mimeType: 'image/png', extension: 'png' };
    jest.spyOn(productosService, 'presignImagen').mockResolvedValue({ uploadUrl: 'http://url' } as any);
    await productosController.presignImagen(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ uploadUrl: 'http://url' });

    // Confirmar
    mockReq.params = { id: 'invalido' };
    await productosController.confirmarImagen(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '1' };
    mockReq.body = {};
    await productosController.confirmarImagen(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.body = { key: 'productos/key.png' };
    jest.spyOn(productosService, 'confirmarImagen').mockResolvedValue({ idPro: 1 } as any);
    await productosController.confirmarImagen(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ idPro: 1 });
  });

  it('actualizar y eliminar validaciones y llamadas', async () => {
    mockReq.params = { id: 'invalido' };
    await productosController.actualizar(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '5' };
    mockReq.body = { nombre: 'Actualizado', precio: 15, existencia: 8, idMarca: 1, idCat: 1 };
    jest.spyOn(productosService, 'actualizar').mockResolvedValue({ idPro: 5, nombrePro: 'Actualizado' } as any);

    await productosController.actualizar(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ idPro: 5, nombrePro: 'Actualizado' });

    // Eliminar
    mockReq.params = { id: 'invalido' };
    await productosController.eliminar(mockReq as Request, mockRes as Response);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    mockReq.params = { id: '5' };
    jest.spyOn(productosService, 'eliminar').mockResolvedValue({ message: 'Producto eliminado correctamente' });

    await productosController.eliminar(mockReq as Request, mockRes as Response);
    expect(mockRes.json).toHaveBeenCalledWith({ message: 'Producto eliminado correctamente' });
  });
});
