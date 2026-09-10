import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { verificarToken } from '../../utils/security';
import { idValido, texto } from '../../utils/formatters';
import { errorServidor } from '../../middlewares/error.middleware';
import { extensionesComprobante, extensionesImagen, generarPresignedUpload } from '../../config/s3';

const router = Router();

router.post('/presign', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization || '';
  const token = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];
  if (!token) {
    res.status(401).json({ message: 'Sesión no válida' });
    return;
  }

  let payload: any;
  try {
    payload = verificarToken(token);
  } catch {
    res.status(401).json({ message: 'Sesión no válida' });
    return;
  }

  const tipo = texto(req.body?.tipo).toUpperCase();
  const mimeType = texto(req.body?.mimeType).toLowerCase();
  const extension = texto(req.body?.extension).toLowerCase();

  const carpetasPorTipo: Record<string, string> = {
    PRODUCTO: 'productos',
    TIENDA: 'tienda',
    COMPROBANTE: 'comprobantes',
  };

  const carpeta = carpetasPorTipo[tipo];
  if (!carpeta) {
    res.status(400).json({ message: 'Tipo de upload no válido. Usa PRODUCTO, TIENDA o COMPROBANTE.' });
    return;
  }

  if (tipo === 'COMPROBANTE') {
    if (payload.tipo !== 'CLIENTE' && payload.tipo !== 'EMPLEADO') {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }
    if (!extensionesComprobante.has(mimeType)) {
      res.status(400).json({ message: 'MIME type no permitido para comprobante (JPG, PNG, WEBP, PDF).' });
      return;
    }
  } else {
    if (payload.tipo !== 'EMPLEADO') {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }
    const idEmp = idValido(payload.sub);
    const emp = idEmp
      ? await prisma.empleado.findUnique({
          where: { idEmp },
          include: { cargo: true },
        })
      : null;
    if (!emp || !emp.estadoEmp || emp.cargo?.nombreCargo !== 'ADMINISTRADOR') {
      res.status(403).json({ message: 'Solo los administradores pueden subir imágenes de productos o tienda' });
      return;
    }
    if (!extensionesImagen.has(mimeType)) {
      res.status(400).json({ message: 'MIME type no permitido para imagen (JPG, PNG, WEBP).' });
      return;
    }
  }

  const nombreOriginal = texto(req.body?.filename || req.body?.nombreOriginal || req.body?.nombre);

  try {
    const data = await generarPresignedUpload({
      folder: carpeta,
      mimeType,
      extensionOriginal: extension || undefined,
      nombreArchivoOriginal: nombreOriginal || undefined,
    });
    res.json({
      ...data,
      rutaPublica: data.publicUrl,
      expiresIn: 900,
    });
  } catch (error) {
    errorServidor(res, error);
  }
});

export const uploadsRoutes = router;
