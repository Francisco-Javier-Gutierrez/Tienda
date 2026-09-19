import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import {
  mimeRealComprobante,
  normalizarPedido,
  normalizarPedidoAdmin,
  pedidosService,
  IPedidosService,
  resolverComprobantePrivado,
} from './pedidos.service';
import { idValido, texto } from '../../utils/formatters';
import {
  esUrlS3,
  extraerKeyS3,
  extensionesComprobante,
  generarPresignedDownload,
  limpiarNombreArchivo,
} from '../../config/s3';

export class PedidosController {
  constructor(private service: IPedidosService = pedidosService) {}

  // CLIENTE
  async crearPedido(req: Request, res: Response): Promise<void> {
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    const pedido = await this.service.crearPedidoCliente(req.cliente.idCliente, req.body);
    res.status(201).json(pedido);
  }

  async listarPedidosCliente(req: Request, res: Response): Promise<void> {
    if (!req.cliente) {
      res.status(401).json({ message: 'Sesión no válida' });
      return;
    }
    await this.service.liberarPedidosExpirados(req.cliente.idCliente);
    const pedidos = await this.service.listarPedidosCliente(req.cliente.idCliente);
    res.json(pedidos);
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
    await this.service.liberarPedidosExpirados(req.cliente.idCliente);
    const pedido = await this.service.obtenerPedidoSeguro(idPedido, req.cliente.idCliente);
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
    const pedido = await this.service.cancelarPedidoCliente(idPedido, req.cliente.idCliente);
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
      const pedido = await this.service.confirmarComprobante(
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
    let mimeType = texto(req.body?.mimeType).toLowerCase();
    const extension = texto(req.body?.extension).toLowerCase();
    const filename = texto(req.body?.filename || req.body?.nombreOriginal);

    if (!extensionesComprobante.has(mimeType)) {
      const ext = (extension || (filename ? path.extname(filename) : '')).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.pdf') mimeType = 'application/pdf';
    }

    if (!extensionesComprobante.has(mimeType)) {
      res.status(400).json({ message: 'Solo se permiten imágenes JPEG, PNG, WEBP o documentos PDF.' });
      return;
    }

    const presigned = await this.service.presignComprobante(
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

    const pedido = await this.service.confirmarComprobante(
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
    const pedido = await this.service.obtenerPedidoSeguro(idPedido, req.cliente.idCliente);
    if (!pedido || !pedido.tieneComprobante) {
      res.status(404).json({ message: 'Comprobante no encontrado.' });
      return;
    }
    if (pedido.comprobanteUrl) {
      if (req.query.json === 'true') {
        res.json({
          downloadUrl: pedido.comprobanteUrl,
          key: pedido.comprobante?.url,
          mime: pedido.comprobante?.mime,
          nombre: pedido.comprobante?.nombre,
        });
        return;
      }
      res.redirect(pedido.comprobanteUrl);
      return;
    }
    const rutaFisica = resolverComprobantePrivado(pedido.comprobante?.nombre);
    if (!rutaFisica) {
      res.status(404).json({ message: 'Comprobante no encontrado.' });
      return;
    }
    res.type(pedido.comprobante?.mime || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(pedido.comprobante?.nombre || 'comprobante')}`,
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
    await this.service.liberarPedidosExpirados();
    const pedidos = await this.service.listarPedidosAdmin(idSuc);
    res.json(pedidos);
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
    const pedido = await this.service.obtenerPedidoAdmin(idPedido, idSuc);
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
    const pedido = await this.service.obtenerPedidoAdmin(idPedido, idSuc);
    if (!pedido || !pedido.tieneComprobante) {
      res.status(404).json({ message: 'Comprobante no encontrado.' });
      return;
    }
    if (pedido.comprobanteUrl) {
      if (req.query.json === 'true') {
        res.json({
          downloadUrl: pedido.comprobanteUrl,
          key: pedido.comprobante?.url,
          mime: pedido.comprobante?.mime,
          nombre: pedido.comprobante?.nombre,
        });
        return;
      }
      res.redirect(pedido.comprobanteUrl);
      return;
    }
    const rutaFisica = resolverComprobantePrivado(pedido.comprobante?.nombre);
    if (!rutaFisica) {
      res.status(404).json({ message: 'Comprobante no encontrado.' });
      return;
    }
    res.type(pedido.comprobante?.mime || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(pedido.comprobante?.nombre || 'comprobante')}`,
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
    const pedido = await this.service.rechazarPedidoAdmin(idPedido, idSuc, req.empleado.idEmp, req.body?.motivo);
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
    const pedido = await this.service.aprobarPedidoAdmin(idPedido, idSuc, req.empleado.idEmp);
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
    const pedido = await this.service.cambiarEstadoOperativo(idPedido, idSuc, 'PAGADO', 'LISTO');
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
    const pedido = await this.service.cambiarEstadoOperativo(idPedido, idSuc, 'LISTO', 'ENTREGADO');
    res.json(pedido);
  }
}

export const pedidosController = new PedidosController();
