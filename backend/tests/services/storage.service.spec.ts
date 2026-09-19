import fs from 'fs';
import { storageService } from '../../src/services/storage.service';
import * as s3Config from '../../src/config/s3';

describe('StorageService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generarPresignedUpload debe llamar a s3Config.generarPresignedUpload', async () => {
    const mockResult: any = { uploadUrl: 'https://s3.test/upload', key: 'test/file.jpg', publicUrl: 'https://s3.test/public', fileName: 'file.jpg' };
    jest.spyOn(s3Config, 'generarPresignedUpload').mockResolvedValue(mockResult);

    const result = await storageService.generarPresignedUpload({
      folder: 'productos',
      mimeType: 'image/jpeg',
    });

    expect(result).toEqual(mockResult);
    expect(s3Config.generarPresignedUpload).toHaveBeenCalled();
  });

  it('generarPresignedDownload debe llamar a s3Config.generarPresignedDownload', async () => {
    jest.spyOn(s3Config, 'generarPresignedDownload').mockResolvedValue('https://s3.test/download');

    const result = await storageService.generarPresignedDownload('test/key.jpg', 'nombre.jpg', 'image/jpeg');
    expect(result).toBe('https://s3.test/download');
    expect(s3Config.generarPresignedDownload).toHaveBeenCalledWith('test/key.jpg', 'nombre.jpg', 'image/jpeg');
  });

  it('eliminarArchivo debe invocar eliminarObjetoS3 si es url de S3', async () => {
    const spy = jest.spyOn(s3Config, 'eliminarObjetoS3').mockResolvedValue();
    await storageService.eliminarArchivo('https://bucket.s3.amazonaws.com/test.jpg');
    expect(spy).toHaveBeenCalledWith('https://bucket.s3.amazonaws.com/test.jpg');
  });

  it('eliminarArchivo no falla si ruta es null o undefined', async () => {
    await expect(storageService.eliminarArchivo(null)).resolves.not.toThrow();
  });

  it('resolverComprobantePrivado rechaza intentos de path traversal', () => {
    expect(storageService.resolverComprobantePrivado('../archivo.jpg')).toBeNull();
    expect(storageService.resolverComprobantePrivado('/etc/passwd')).toBeNull();
    expect(storageService.resolverComprobantePrivado(null)).toBeNull();
  });

  it('detectarMimeReal retorna null si archivo no existe', () => {
    expect(storageService.detectarMimeReal('ruta_inexistente.jpg')).toBeNull();
  });

  it('valida extensiones permitidas', () => {
    expect(storageService.esMimePermitidoImagen('image/png')).toBe(true);
    expect(storageService.esMimePermitidoImagen('application/pdf')).toBe(false);

    expect(storageService.esMimePermitidoComprobante('application/pdf')).toBe(true);
    expect(storageService.esMimePermitidoComprobante('application/zip')).toBe(false);
  });
});
