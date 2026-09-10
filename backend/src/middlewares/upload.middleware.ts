import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { extensionesComprobante, extensionesImagen } from '../config/s3';

export const baseUploadsDir = path.join(__dirname, '../../uploads');
export const productosUploadDir = path.join(baseUploadsDir, 'productos');
export const tiendaUploadDir = path.join(baseUploadsDir, 'tienda');
export const comprobantesUploadDir = path.join(baseUploadsDir, 'comprobantes');

for (const dir of [baseUploadsDir, productosUploadDir, tiendaUploadDir, comprobantesUploadDir]) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // Ignorar en entornos serverless de solo lectura (como Vercel/AWS Lambda)
  }
}

function crearUploadImagen(directorio: string) {
  return multer({
    storage: multer.diskStorage({
      destination: directorio,
      filename: (_req, file, callback) =>
        callback(null, `${crypto.randomUUID()}${extensionesImagen.get(file.mimetype) || ''}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
      if (!extensionesImagen.has(file.mimetype)) {
        return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'imagen'));
      }
      callback(null, true);
    },
  });
}

export const uploadImagen = crearUploadImagen(productosUploadDir);
export const uploadLogo = crearUploadImagen(tiendaUploadDir);

export const uploadComprobante = multer({
  storage: multer.diskStorage({
    destination: comprobantesUploadDir,
    filename: (_req, file, callback) =>
      callback(null, `${crypto.randomUUID()}${extensionesComprobante.get(file.mimetype) || ''}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!extensionesComprobante.has(file.mimetype)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'comprobante'));
    }
    callback(null, true);
  },
});
