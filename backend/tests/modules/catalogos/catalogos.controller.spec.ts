import { Request, Response } from 'express';
import { catalogosController } from '../../../src/modules/catalogos/catalogos.controller';
import { catalogosService } from '../../../src/modules/catalogos/catalogos.service';
import { prisma } from '../../../src/config/prisma';

describe('CatalogosController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = { params: {}, body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Marcas', () => {
    it('listarMarcas y crearMarca', async () => {
      jest.spyOn(catalogosService, 'listarMarcas').mockResolvedValue([{ idMarca: 1 } as any]);
      await catalogosController.listarMarcas(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith([{ idMarca: 1 }]);

      mockReq.body = { nombre: 'Nueva Marca' };
      jest.spyOn(catalogosService, 'crearMarca').mockResolvedValue({ idMarca: 2, nombreMarca: 'Nueva Marca' } as any);
      await catalogosController.crearMarca(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('actualizarMarca (valido e invalido)', async () => {
      mockReq.params = { id: 'invalido' };
      await catalogosController.actualizarMarca(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.body = { nombre: 'Marca Act' };
      jest.spyOn(catalogosService, 'actualizarMarca').mockResolvedValue({ idMarca: 1 } as any);
      await catalogosController.actualizarMarca(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idMarca: 1 });
    });

    it('eliminarMarca (valido e invalido)', async () => {
      mockReq.params = { id: 'invalido' };
      await catalogosController.eliminarMarca(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      jest.spyOn(catalogosService, 'eliminarMarca').mockResolvedValue({ message: 'ok' } as any);
      await catalogosController.eliminarMarca(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'ok' });
    });
  });

  describe('Categorías', () => {
    it('listarCategorias y crearCategoria', async () => {
      jest.spyOn(catalogosService, 'listarCategorias').mockResolvedValue([{ idCat: 1 } as any]);
      await catalogosController.listarCategorias(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith([{ idCat: 1 }]);

      mockReq.body = { nombre: 'Nueva Cat' };
      jest.spyOn(catalogosService, 'crearCategoria').mockResolvedValue({ idCat: 2, nombreCat: 'Nueva Cat' } as any);
      await catalogosController.crearCategoria(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('actualizarCategoria (valido e invalido)', async () => {
      mockReq.params = { id: 'invalido' };
      await catalogosController.actualizarCategoria(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.body = { nombre: 'Cat Act' };
      jest.spyOn(catalogosService, 'actualizarCategoria').mockResolvedValue({ idCat: 1 } as any);
      await catalogosController.actualizarCategoria(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idCat: 1 });
    });

    it('eliminarCategoria (valido e invalido)', async () => {
      mockReq.params = { id: 'invalido' };
      await catalogosController.eliminarCategoria(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      jest.spyOn(catalogosService, 'eliminarCategoria').mockResolvedValue({ message: 'ok' } as any);
      await catalogosController.eliminarCategoria(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'ok' });
    });
  });

  describe('Sucursales', () => {
    it('listarSucursales y crearSucursal', async () => {
      jest.spyOn(catalogosService, 'listarSucursales').mockResolvedValue([{ idSuc: 1 } as any]);
      await catalogosController.listarSucursales(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith([{ idSuc: 1 }]);

      mockReq.body = { nombreSuc: 'Sucursal 1' };
      jest.spyOn(catalogosService, 'crearSucursal').mockResolvedValue({ idSuc: 1, nombreSuc: 'Sucursal 1' } as any);
      await catalogosController.crearSucursal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('obtenerSucursal (invalido, no encontrado, encontrado)', async () => {
      mockReq.params = { id: 'invalido' };
      await catalogosController.obtenerSucursal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      jest.spyOn(catalogosService, 'obtenerSucursal').mockResolvedValueOnce(null);
      await catalogosController.obtenerSucursal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      jest.spyOn(catalogosService, 'obtenerSucursal').mockResolvedValueOnce({ idSuc: 1 } as any);
      await catalogosController.obtenerSucursal(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idSuc: 1 });
    });

    it('actualizarSucursal (valido e invalido)', async () => {
      mockReq.params = { id: 'invalido' };
      await catalogosController.actualizarSucursal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.body = { nombreSuc: 'Suc Act' };
      jest.spyOn(catalogosService, 'actualizarSucursal').mockResolvedValue({ idSuc: 1 } as any);
      await catalogosController.actualizarSucursal(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idSuc: 1 });
    });

    it('subirLogoLocal (validaciones, sucursal no existe, exito)', async () => {
      mockReq.params = { id: 'invalido' };
      mockReq.file = { path: 'temp/path', filename: 'logo.png' } as any;
      await catalogosController.subirLogoLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.file = undefined;
      await catalogosController.subirLogoLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.file = { path: 'temp/path', filename: 'logo.png' } as any;
      jest.spyOn(catalogosService, 'obtenerSucursal').mockResolvedValueOnce(null);
      await catalogosController.subirLogoLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(404);

      jest.spyOn(catalogosService, 'obtenerSucursal')
        .mockResolvedValueOnce({ idSuc: 1, logoSuc: null } as any)
        .mockResolvedValueOnce({ idSuc: 1, logoSuc: '/uploads/tienda/logo.png' } as any);
      jest.spyOn(prisma.sucursal, 'update').mockResolvedValue({ idSuc: 1 } as any);

      await catalogosController.subirLogoLocal(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('presignLogo (invalido, mimeType no permitido, exito)', async () => {
      mockReq.params = { id: 'invalido' };
      await catalogosController.presignLogo(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.body = { mimeType: 'application/pdf' };
      await catalogosController.presignLogo(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.body = { mimeType: 'image/png', filename: 'logo.png' };
      jest.spyOn(catalogosService, 'presignLogo').mockResolvedValue({ uploadUrl: 'http://upload' } as any);
      await catalogosController.presignLogo(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ uploadUrl: 'http://upload' });
    });

    it('confirmarLogo y eliminarLogo', async () => {
      mockReq.params = { id: 'invalido' };
      await catalogosController.confirmarLogo(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      mockReq.body = {};
      await catalogosController.confirmarLogo(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.body = { logoUrl: 'http://logo.png' };
      jest.spyOn(catalogosService, 'confirmarLogo').mockResolvedValue({ idSuc: 1 } as any);
      await catalogosController.confirmarLogo(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idSuc: 1 });

      mockReq.params = { id: 'invalido' };
      await catalogosController.eliminarLogo(mockReq as Request, mockRes as Response);
      expect(mockRes.status).toHaveBeenCalledWith(400);

      mockReq.params = { id: '1' };
      jest.spyOn(catalogosService, 'eliminarLogo').mockResolvedValue({ idSuc: 1 } as any);
      await catalogosController.eliminarLogo(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith({ idSuc: 1 });
    });

    it('listarCargos y listarTiendaPublica', async () => {
      jest.spyOn(catalogosService, 'listarCargos').mockResolvedValue([{ idCargo: 1 }] as any);
      await catalogosController.listarCargos(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith([{ idCargo: 1 }]);

      jest.spyOn(catalogosService, 'listarTiendaPublica').mockResolvedValue([{ idSuc: 1 }] as any);
      await catalogosController.listarTiendaPublica(mockReq as Request, mockRes as Response);
      expect(mockRes.json).toHaveBeenCalledWith([{ idSuc: 1 }]);
    });
  });
});
