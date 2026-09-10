import fs from 'fs';
import { Request, Response } from 'express';
import { catalogosService } from './catalogos.service';
import { idValido, texto } from '../../utils/formatters';
import { prisma } from '../../config/prisma';
import { tiendaUploadDir } from '../../middlewares/upload.middleware';
import { eliminarUploadControlado } from '../productos/productos.service';
import { extensionesImagen } from '../../config/s3';

export class CatalogosController {
  // MARCAS
  async listarMarcas(req: Request, res: Response): Promise<void> {
    const marcas = await catalogosService.listarMarcas();
      res.json(marcas);
  }

  async crearMarca(req: Request, res: Response): Promise<void> {
    const marca = await catalogosService.crearMarca(req.body?.nombre, req.body?.descripcion);
      res.status(201).json(marca);
  }

  async actualizarMarca(req: Request, res: Response): Promise<void> {
    const idMarca = idValido(req.params.id);
    if (!idMarca) {
      res.status(400).json({ message: 'El ID de la marca no es válido' });
      return;
    }
    const marca = await catalogosService.actualizarMarca(idMarca, req.body?.nombre, req.body?.descripcion);
      res.json(marca);
  }

  async eliminarMarca(req: Request, res: Response): Promise<void> {
    const idMarca = idValido(req.params.id);
    if (!idMarca) {
      res.status(400).json({ message: 'El ID de la marca no es válido' });
      return;
    }
    const resultado = await catalogosService.eliminarMarca(idMarca);
      res.json(resultado);
  }

  // CATEGORÍAS
  async listarCategorias(req: Request, res: Response): Promise<void> {
    const categorias = await catalogosService.listarCategorias();
      res.json(categorias);
  }

  async crearCategoria(req: Request, res: Response): Promise<void> {
    const categoria = await catalogosService.crearCategoria(req.body?.nombre, req.body?.descripcion);
      res.status(201).json(categoria);
  }

  async actualizarCategoria(req: Request, res: Response): Promise<void> {
    const idCat = idValido(req.params.id);
    if (!idCat) {
      res.status(400).json({ message: 'El ID de la categoría no es válido' });
      return;
    }
    const categoria = await catalogosService.actualizarCategoria(idCat, req.body?.nombre, req.body?.descripcion);
      res.json(categoria);
  }

  async eliminarCategoria(req: Request, res: Response): Promise<void> {
    const idCat = idValido(req.params.id);
    if (!idCat) {
      res.status(400).json({ message: 'El ID de la categoría no es válido' });
      return;
    }
    const resultado = await catalogosService.eliminarCategoria(idCat);
      res.json(resultado);
  }

  // SUCURSALES
  async listarSucursales(req: Request, res: Response): Promise<void> {
    const sucursales = await catalogosService.listarSucursales();
      res.json(sucursales);
  }

  async obtenerSucursal(req: Request, res: Response): Promise<void> {
    const idSuc = idValido(req.params.id);
    if (!idSuc) {
      res.status(400).json({ message: 'El ID de la sucursal no es válido' });
      return;
    }
    const sucursal = await catalogosService.obtenerSucursal(idSuc);
      if (!sucursal) {
              res.status(404).json({ message: 'Sucursal no encontrada' });
              return;
            }
      res.json(sucursal);
  }

  async crearSucursal(req: Request, res: Response): Promise<void> {
    const sucursal = await catalogosService.crearSucursal(req.body);
      res.status(201).json(sucursal);
  }

  async actualizarSucursal(req: Request, res: Response): Promise<void> {
    const idSuc = idValido(req.params.id);
    if (!idSuc) {
      res.status(400).json({ message: 'El ID de la sucursal no es válido' });
      return;
    }
    const sucursal = await catalogosService.actualizarSucursal(idSuc, req.body);
      res.json(sucursal);
  }

  async subirLogoLocal(req: Request, res: Response): Promise<void> {
    const idSuc = idValido(req.params.id);
    if (!idSuc) {
      if (req.file) fs.unlink(req.file.path, () => undefined);
      res.status(400).json({ message: 'El ID de la sucursal no es válido' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: 'Selecciona un logo para subir' });
      return;
    }
    try {
      const anterior = await catalogosService.obtenerSucursal(idSuc);
      if (!anterior) {
        fs.unlink(req.file.path, () => undefined);
        res.status(404).json({ message: 'Sucursal no encontrada' });
        return;
      }
      const rutaPublica = `/uploads/tienda/${req.file.filename}`;
      await prisma.sucursal.update({ where: { idSuc }, data: { logoSuc: rutaPublica } });
      const sucursal = await catalogosService.obtenerSucursal(idSuc);
      eliminarUploadControlado(anterior.logo, tiendaUploadDir, '/uploads/tienda/');
      res.json(sucursal);
    } catch (error) {
      fs.unlink(req.file.path, () => undefined);
      throw error;
    }
  }

  async presignLogo(req: Request, res: Response): Promise<void> {
    const idSuc = idValido(req.params.id);
    if (!idSuc) {
      res.status(400).json({ message: 'El ID de la sucursal no es válido' });
      return;
    }
    const mimeType = texto(req.body?.mimeType).toLowerCase();
    const nombreOriginal = texto(req.body?.filename || req.body?.nombreOriginal);
    if (!extensionesImagen.has(mimeType)) {
      res.status(400).json({ message: 'Solo se permiten imágenes JPEG, PNG o WEBP' });
      return;
    }
    const presigned = await catalogosService.presignLogo(idSuc, mimeType, nombreOriginal);
      res.json(presigned);
  }

  async confirmarLogo(req: Request, res: Response): Promise<void> {
    const idSuc = idValido(req.params.id);
    if (!idSuc) {
      res.status(400).json({ message: 'El ID de la sucursal no es válido' });
      return;
    }
    const logoUrl = texto(req.body?.logoUrl || req.body?.publicUrl || req.body?.key);
    if (!logoUrl) {
      res.status(400).json({ message: 'La URL o Key del logo es obligatoria' });
      return;
    }
    const sucursal = await catalogosService.confirmarLogo(idSuc, logoUrl);
      res.json(sucursal);
  }

  async eliminarLogo(req: Request, res: Response): Promise<void> {
    const idSuc = idValido(req.params.id);
    if (!idSuc) {
      res.status(400).json({ message: 'El ID de la sucursal no es válido' });
      return;
    }
    const sucursal = await catalogosService.eliminarLogo(idSuc);
      res.json(sucursal);
  }

  // CARGOS
  async listarCargos(req: Request, res: Response): Promise<void> {
    const cargos = await catalogosService.listarCargos();
      res.json(cargos);
  }

  // TIENDA PÚBLICA
  async listarTiendaPublica(req: Request, res: Response): Promise<void> {
    const tiendas = await catalogosService.listarTiendaPublica();
      res.json(tiendas);
  }
}

export const catalogosController = new CatalogosController();


