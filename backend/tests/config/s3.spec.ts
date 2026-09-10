import {
  eliminarObjetoS3,
  esUrlS3,
  extraerKeyS3,
  generarPresignedDownload,
  generarPresignedUpload,
  limpiarNombreArchivo,
  s3Client,
} from '../../src/config/s3';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/mock-signed-url'),
}));

describe('S3 Configuration & Helper Utilities', () => {
  describe('esUrlS3', () => {
    it('debe detectar URLs y claves S3 válidas', () => {
      expect(esUrlS3('https://mi-bucket.s3.us-east-1.amazonaws.com/productos/foto.jpg')).toBe(true);
      expect(esUrlS3('s3://mi-bucket/tienda/logo.png')).toBe(true);
      expect(esUrlS3('productos/123-arroz.webp')).toBe(true);
      expect(esUrlS3('comprobantes/uuid-comprobante.pdf')).toBe(true);
      expect(esUrlS3('tienda/logo.png')).toBe(true);
    });

    it('debe rechazar rutas locales o nulas', () => {
      expect(esUrlS3('/uploads/productos/foto.jpg')).toBe(false);
      expect(esUrlS3(null)).toBe(false);
      expect(esUrlS3('')).toBe(false);
      expect(esUrlS3(123 as any)).toBe(false);
    });
  });

  describe('extraerKeyS3', () => {
    it('debe extraer la key relativa desde URLs completas de S3', () => {
      expect(
        extraerKeyS3('https://mi-bucket.s3.us-east-1.amazonaws.com/productos/foto.jpg?param=1'),
      ).toBe('productos/foto.jpg');
      expect(extraerKeyS3('comprobantes/abc.pdf')).toBe('comprobantes/abc.pdf');
      expect(extraerKeyS3('tienda/logo.png')).toBe('tienda/logo.png');
    });

    it('debe retornar null para rutas inválidas', () => {
      expect(extraerKeyS3('/uploads/local.jpg')).toBeNull();
      expect(extraerKeyS3(null)).toBeNull();
      expect(extraerKeyS3(123 as any)).toBeNull();
    });
  });

  describe('limpiarNombreArchivo', () => {
    it('debe normalizar nombres de archivo eliminando acentos y caracteres especiales', () => {
      expect(limpiarNombreArchivo('Foto de Café & Azúcar!.PNG')).toBe('foto-de-cafe-azucar.png');
      expect(limpiarNombreArchivo('comprobante___bbva...pdf')).toBe('comprobante_bbva.pdf');
      expect(limpiarNombreArchivo(null, 'fallback-default')).toBe('fallback-default');
      expect(limpiarNombreArchivo('---')).toBe('archivo');
      expect(limpiarNombreArchivo(123 as any)).toBe('archivo');
    });
  });

  describe('generarPresignedUpload y generarPresignedDownload', () => {
    it('debe generar objeto con URL pre-firmada de subida con y sin nombre original', async () => {
      const result1 = await generarPresignedUpload({
        folder: 'productos',
        mimeType: 'image/jpeg',
        nombreArchivoOriginal: 'Galletas Chocochips',
        extensionOriginal: 'jpeg',
      });

      expect(result1.uploadUrl).toBe('https://s3.amazonaws.com/mock-signed-url');
      expect(result1.key).toContain('productos/');
      expect(result1.publicUrl).toBeDefined();

      const result2 = await generarPresignedUpload({
        folder: 'comprobantes',
        mimeType: 'application/pdf',
        extensionOriginal: '.pdf',
      });
      expect(result2.key).toContain('comprobantes/');
    });

    it('debe generar URL pre-firmada de descarga con y sin opciones', async () => {
      const url1 = await generarPresignedDownload('comprobantes/comprobante-1.pdf', 'comprobante.pdf', 'application/pdf');
      expect(url1).toBe('https://s3.amazonaws.com/mock-signed-url');

      const url2 = await generarPresignedDownload('comprobantes/comprobante-2.pdf');
      expect(url2).toBe('https://s3.amazonaws.com/mock-signed-url');
    });
  });

  describe('eliminarObjetoS3', () => {
    it('debe enviar comando de eliminación a S3 sin lanzar excepciones', async () => {
      const sendSpy = jest.spyOn(s3Client, 'send').mockImplementation((() => Promise.resolve({})) as any);
      await eliminarObjetoS3('productos/item-1.jpg');
      expect(sendSpy).toHaveBeenCalled();

      // Cuando ruta no es válida
      await eliminarObjetoS3(null);

      // Cuando falla el envio a s3
      sendSpy.mockImplementation((() => Promise.reject(new Error('S3 error'))) as any);
      await eliminarObjetoS3('productos/item-2.jpg');
      sendSpy.mockRestore();
    });
  });
});
