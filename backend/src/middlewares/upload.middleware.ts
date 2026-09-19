import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import multer from 'multer';
import { extensionesComprobante, extensionesImagen } from '../config/s3';

const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT,
);

export const baseUploadsDir = isServerless
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '../../uploads');

export const productosUploadDir = path.join(baseUploadsDir, 'productos');
export const tiendaUploadDir = path.join(baseUploadsDir, 'tienda');
export const comprobantesUploadDir = path.join(baseUploadsDir, 'comprobantes');

for (const dir of [baseUploadsDir, productosUploadDir, tiendaUploadDir, comprobantesUploadDir]) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // Ignorar en entornos serverless de solo lectura
  }
}

function crearUploadImagen(directorio: string) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        try {
          if (!fs.existsSync(directorio)) {
            fs.mkdirSync(directorio, { recursive: true });
          }
        } catch {
          // Ignorar si falla creación dinámica
        }
        callback(null, directorio);
      },
      filename: (_req, file, callback) =>
        callback(null, `${crypto.randomUUID()}${extensionesImagen.get(file.mimetype) || ''}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
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
    destination: (_req, _file, callback) => {
      try {
        if (!fs.existsSync(comprobantesUploadDir)) {
          fs.mkdirSync(comprobantesUploadDir, { recursive: true });
        }
      } catch {
        // Ignorar si falla creación dinámica
      }
      callback(null, comprobantesUploadDir);
    },
    filename: (_req, file, callback) =>
      callback(null, `${crypto.randomUUID()}${extensionesComprobante.get(file.mimetype) || ''}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!extensionesComprobante.has(file.mimetype)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'comprobante'));
    }
    callback(null, true);
  },
});
