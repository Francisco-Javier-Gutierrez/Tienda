import fs from 'fs';
import { Request, Response } from 'express';
import {
  mimeRealComprobante,
  normalizarPedido,
  normalizarPedidoAdmin,
  pedidosService,
  resolverComprobantePrivado,
} from './pedidos.service';
import { idValido, texto } from '../../utils/formatters';
import { prisma } from '../../config/prisma';
import {
  esUrlS3,
  extraerKeyS3,
  extensionesComprobante,
  generarPresignedDownload,
  limpiarNombreArchivo,
} from '../../config/s3';

export class PedidosController {
  // CLIENTE
  async crearPedido(req: Request, res: Response): Promise<void> {
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const pedido = await pedidosService.crearPedidoCliente(req.cliente.idCliente, req.body);
      res.status(201).json(pedido);
  }

  async listarPedidosCliente(req: Request, res: Response): Promise<void> {
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    await pedidosService.liberarPedidosExpirados(req.cliente.idCliente);
    const pedidos = await prisma.pedidoCliente.findMany({
      where: { idCliente: req.cliente.idCliente },
      orderBy: [{ fechaPedido: 'desc' }, { idPedido: 'desc' }],
    });
    res.json(pedidos.map(normalizarPedido));
  }

  async obtenerPedidoCliente(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    await pedidosService.liberarPedidosExpirados(req.cliente.idCliente);
      const pedido = await pedidosService.obtenerPedidoSeguro(idPedido, req.cliente.idCliente);
      if (!pedido) {
              res.status(404).json({ message: 'Pedido no encontrado.' });
              return;
            }
      res.json(pedido);
  }

  async cancelarPedidoCliente(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const pedido = await pedidosService.cancelarPedidoCliente(idPedido, req.cliente.idCliente);
      res.json(pedido);
  }

  async subirComprobanteLocal(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      if (req.file) fs.unlink(req.file.path, () => undefined);
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    if (!req.cliente) {
      if (req.file) fs.unlink(req.file.path, () => undefined);
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: 'Selecciona un archivo para el comprobante.' });
      return;
    }

    const mime = mimeRealComprobante(req.file.path);
    if (!mime || !extensionesComprobante.has(mime)) {
      fs.unlink(req.file.path, () => undefined);
      res.status(400).json({ message: 'El archivo no tiene un formato permitido.' });
      return;
    }

    try {
      const pedido = await pedidosService.confirmarComprobante(
        idPedido,
        req.cliente.idCliente,
        req.file.filename,
        req.file.originalname,
        mime,
      );
      res.json(pedido);
    } catch (error: any) {
      fs.unlink(req.file.path, () => undefined);
      if (error.status) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      throw error;
    }
  }

  async presignComprobante(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const mimeType = texto(req.body?.mimeType).toLowerCase();
    const extension = texto(req.body?.extension).toLowerCase();
    const filename = texto(req.body?.filename || req.body?.nombreOriginal);

    if (!extensionesComprobante.has(mimeType)) {
      res.status(400).json({ message: 'Solo se permiten imágenes JPEG, PNG, WEBP o documentos PDF.' });
      return;
    }

    const presigned = await pedidosService.presignComprobante(
              idPedido,
              req.cliente.idCliente,
              mimeType,
              extension,
              filename,
            );
      res.json({ ...presigned, idPedido, expiresIn: 900 });
  }

  async confirmarComprobante(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const key = texto(req.body?.key || req.body?.comprobanteUrl || req.body?.publicUrl);
    const filename = texto(req.body?.filename || req.body?.nombreOriginal);
    const mimeType = texto(req.body?.mimeType || req.body?.mime);

    if (!key) {
      res.status(400).json({ message: 'La clave o URL del comprobante es obligatoria.' });
      return;
    }

    const pedido = await pedidosService.confirmarComprobante(
              idPedido,
              req.cliente.idCliente,
              key,
              filename,
              mimeType,
            );
      res.json(pedido);
  }

  async verComprobanteCliente(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const pedido = await prisma.pedidoCliente.findFirst({
              where: {
                idPedido,
                idCliente: req.cliente.idCliente,
                comprobanteRuta: { not: null },
              },
              select: {
                comprobanteRuta: true,
                comprobanteMime: true,
                comprobanteNombre: true,
              },
            });
      if (!pedido || !pedido.comprobanteRuta) {
              res.status(404).json({ message: 'Comprobante no encontrado.' });
              return;
            }
      if (esUrlS3(pedido.comprobanteRuta)) {
              const key = extraerKeyS3(pedido.comprobanteRuta) || pedido.comprobanteRuta;
              const downloadUrl = await generarPresignedDownload(key, pedido.comprobanteNombre, pedido.comprobanteMime);
              if (req.query.json === 'true') {
                res.json({
                  downloadUrl,
                  key,
                  mime: pedido.comprobanteMime,
                  nombre: pedido.comprobanteNombre,
                });
                return;
              }
              res.redirect(downloadUrl);
              return;
            }
      const rutaFisica = resolverComprobantePrivado(pedido.comprobanteRuta);
      if (!rutaFisica) {
              res.status(404).json({ message: 'Comprobante no encontrado.' });
              return;
            }
      res.type(pedido.comprobanteMime || 'application/octet-stream');
      res.setHeader(
              'Content-Disposition',
              `inline; filename*=UTF-8''${encodeURIComponent(pedido.comprobanteNombre || 'comprobante')}`,
            );
      res.sendFile(rutaFisica);
  }

  // ADMIN
  async listarPedidosAdmin(req: Request, res: Response): Promise<void> {
    const idSuc = idValido(req.empleado?.idSuc);
    if (!idSuc) {
      res.status(409).json({ message: 'El administrador no tiene una sucursal asignada.' });
      return;
    }
    await pedidosService.liberarPedidosExpirados();
      const pedidos = await prisma.pedidoCliente.findMany({
              where: { idSuc },
              orderBy: [{ fechaPedido: 'desc' }, { idPedido: 'desc' }],
              include: {
                cliente: true,
                empleadoRevisa: true,
              },
            });
      res.json(pedidos.map(normalizarPedidoAdmin));
  }

  async obtenerPedidoAdmin(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    const idSuc = idValido(req.empleado?.idSuc);
    if (!idSuc) {
      res.status(409).json({ message: 'El administrador no tiene una sucursal asignada.' });
      return;
    }
    const pedido = await pedidosService.obtenerPedidoAdmin(idPedido, idSuc);
      if (!pedido) {
              res.status(404).json({ message: 'Pedido no encontrado.' });
              return;
            }
      res.json(pedido);
  }

  async verComprobanteAdmin(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    const idSuc = idValido(req.empleado?.idSuc);
    if (!idSuc) {
      res.status(409).json({ message: 'El administrador no tiene una sucursal asignada.' });
      return;
    }
    const pedido = await prisma.pedidoCliente.findFirst({
              where: {
                idPedido,
                idSuc,
                comprobanteRuta: { not: null },
              },
              select: {
                comprobanteRuta: true,
                comprobanteMime: true,
                comprobanteNombre: true,
              },
            });
      if (!pedido || !pedido.comprobanteRuta) {
              res.status(404).json({ message: 'Comprobante no encontrado.' });
              return;
            }
      if (esUrlS3(pedido.comprobanteRuta)) {
              const key = extraerKeyS3(pedido.comprobanteRuta) || pedido.comprobanteRuta;
              const downloadUrl = await generarPresignedDownload(key, pedido.comprobanteNombre, pedido.comprobanteMime);
              if (req.query.json === 'true') {
                res.json({
                  downloadUrl,
                  key,
                  mime: pedido.comprobanteMime,
                  nombre: pedido.comprobanteNombre,
                });
                return;
              }
              res.redirect(downloadUrl);
              return;
            }
      const rutaFisica = resolverComprobantePrivado(pedido.comprobanteRuta);
      if (!rutaFisica) {
              res.status(404).json({ message: 'Comprobante no encontrado.' });
              return;
            }
      res.type(pedido.comprobanteMime || 'application/octet-stream');
      res.setHeader(
              'Content-Disposition',
              `inline; filename*=UTF-8''${encodeURIComponent(pedido.comprobanteNombre || 'comprobante')}`,
            );
      res.sendFile(rutaFisica);
  }

  async rechazarPedidoAdmin(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    const idSuc = idValido(req.empleado?.idSuc);
    if (!idSuc || !req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const pedido = await pedidosService.rechazarPedidoAdmin(idPedido, idSuc, req.empleado.idEmp, req.body?.motivo);
      res.json(pedido);
  }

  async aprobarPedidoAdmin(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    const idSuc = idValido(req.empleado?.idSuc);
    if (!idSuc || !req.empleado) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const pedido = await pedidosService.aprobarPedidoAdmin(idPedido, idSuc, req.empleado.idEmp);
      res.json(pedido);
  }

  async cambiarEstadoListo(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    const idSuc = idValido(req.empleado?.idSuc);
    if (!idSuc) {
      res.status(409).json({ message: 'El administrador no tiene una sucursal asignada.' });
      return;
    }
    const pedido = await pedidosService.cambiarEstadoOperativo(idPedido, idSuc, 'PAGADO', 'LISTO');
      res.json(pedido);
  }

  async cambiarEstadoEntregar(req: Request, res: Response): Promise<void> {
    const idPedido = idValido(req.params.id);
    if (!idPedido) {
      res.status(400).json({ message: 'El pedido no es válido.' });
      return;
    }
    const idSuc = idValido(req.empleado?.idSuc);
    if (!idSuc) {
      res.status(409).json({ message: 'El administrador no tiene una sucursal asignada.' });
      return;
    }
    const pedido = await pedidosService.cambiarEstadoOperativo(idPedido, idSuc, 'LISTO', 'ENTREGADO');
      res.json(pedido);
  }
}

export const pedidosController = new PedidosController();
