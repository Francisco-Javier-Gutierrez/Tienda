import crypto from 'crypto';
import path from 'path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

export const s3Bucket = env.AWS_BUCKET_NAME;
export const s3Region = env.AWS_REGION;

export const extensionesImagen = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

export const extensionesComprobante = new Map<string, string>([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['application/pdf', '.pdf'],
]);

export function esUrlS3(ruta?: string | null): boolean {
  if (!ruta || typeof ruta !== 'string') return false;
  return (
    ruta.includes('.amazonaws.com/') ||
    ruta.startsWith('s3://') ||
    ruta.startsWith('productos/') ||
    ruta.startsWith('tienda/') ||
    ruta.startsWith('comprobantes/')
  );
}

export function extraerKeyS3(ruta?: string | null): string | null {
  if (!ruta || typeof ruta !== 'string') return null;
  if (ruta.includes('.amazonaws.com/')) {
    return ruta.split('.amazonaws.com/')[1]?.split('?')[0] || null;
  }
  if (ruta.startsWith('productos/') || ruta.startsWith('tienda/') || ruta.startsWith('comprobantes/')) {
    return ruta;
  }
  return null;
}

export async function eliminarObjetoS3(rutaOKey?: string | null): Promise<void> {
  const key = extraerKeyS3(rutaOKey);
  if (!key || !s3Bucket) return;
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }));
  } catch (err: any) {
    console.error('Error al eliminar objeto de S3:', err?.message || err);
  }
}

export function limpiarNombreArchivo(nombreOriginal?: string | null, fallback = 'archivo'): string {
  if (!nombreOriginal || typeof nombreOriginal !== 'string') return fallback;

  const nombre = path.basename(nombreOriginal.trim());
  const parsedExt = path.extname(nombre);
  let base = parsedExt ? nombre.slice(0, nombre.length - parsedExt.length) : nombre;

  base = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  base = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+/, '')
    .replace(/[-_.]+$/, '');

  if (!base) base = fallback;
  base = base.slice(0, 80);

  const extLimpia = parsedExt.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();
  return `${base}${extLimpia}`;
}

export interface PresignedUploadOptions {
  folder: 'productos' | 'tienda' | 'comprobantes' | string;
  mimeType: string;
  extensionOriginal?: string;
  nombreArchivoOriginal?: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  fileName: string;
}

export async function generarPresignedUpload({
  folder,
  mimeType,
  extensionOriginal,
  nombreArchivoOriginal,
}: PresignedUploadOptions): Promise<PresignedUploadResult> {
  let ext = extensionOriginal || extensionesComprobante.get(mimeType) || extensionesImagen.get(mimeType) || '';
  if (ext && !ext.startsWith('.')) ext = `.${ext}`;
  ext = ext.toLowerCase().replace(/[^a-z0-9.]/g, '');

  let nombreLimpio = '';
  if (nombreArchivoOriginal) {
    const seguro = limpiarNombreArchivo(nombreArchivoOriginal);
    nombreLimpio = path.basename(seguro, path.extname(seguro)).slice(0, 40);
  }

  const nombreFichero = nombreLimpio ? `${crypto.randomUUID()}-${nombreLimpio}${ext}` : `${crypto.randomUUID()}${ext}`;
  const key = `${folder}/${nombreFichero}`;

  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  const publicUrl = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;

  return { uploadUrl, key, publicUrl, fileName: nombreFichero };
}

export async function generarPresignedDownload(
  key: string,
  filename?: string | null,
  mimeType?: string | null,
): Promise<string> {
  const nombreLimpio = limpiarNombreArchivo(filename || path.basename(key) || 'comprobante');
  const command = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ResponseContentType: mimeType || undefined,
    ResponseContentDisposition: `inline; filename="${nombreLimpio}"; filename*=UTF-8''${encodeURIComponent(nombreLimpio)}`,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: 900 });
}
