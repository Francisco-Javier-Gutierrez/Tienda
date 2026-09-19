import {
  BaseStorageDriver,
  LocalStorageDriver,
  StorageService,
} from '../../src/services/storage.service';
import { PresignedUploadOptions, PresignedUploadResult } from '../../src/config/s3';

class MemoryStorageDriver extends BaseStorageDriver {
  readonly tipo = 'MEMORY';
  public files = new Map<string, string>();

  override puedeManejar(rutaOKey?: string | null): boolean {
    return Boolean(rutaOKey && rutaOKey.startsWith('memory://'));
  }

  async generarPresignedUpload(opciones: PresignedUploadOptions): Promise<PresignedUploadResult> {
    const key = `${opciones.folder}/test.png`;
    return {
      uploadUrl: `memory://upload/${key}`,
      key,
      publicUrl: `memory://${key}`,
      fileName: 'test.png',
    };
  }

  async generarPresignedDownload(key: string): Promise<string> {
    return `memory://download/${key}`;
  }

  async eliminarObjeto(rutaOKey: string): Promise<void> {
    this.files.delete(rutaOKey);
  }
}

describe('Liskov Substitution Principle (LSP) - Storage Drivers', () => {
  it('LocalStorageDriver sustituye a S3CloudStorageDriver en StorageService', async () => {
    const localDriver = new LocalStorageDriver();
    const service = new StorageService(localDriver);

    const upload = await service.generarPresignedUpload({
      folder: 'comprobantes',
      mimeType: 'image/jpeg',
      nombreArchivoOriginal: 'test.jpg',
    });

    expect(upload.uploadUrl).toContain('/uploads/local/comprobantes/');
    expect(upload.key).toContain('comprobantes/');
    expect(upload.publicUrl).toContain('/uploads/local/comprobantes/');

    const download = await service.generarPresignedDownload(upload.key);
    expect(download).toBe(`/uploads/local/${upload.key}`);

    // Debe ejecutar eliminación sin arrojar errores
    await expect(service.eliminarArchivo(`/uploads/local/${upload.key}`)).resolves.not.toThrow();
  });

  it('Cualquier subtipo de BaseStorageDriver (ej. MemoryStorageDriver) es sustituible', async () => {
    const memDriver = new MemoryStorageDriver();
    memDriver.files.set('memory://test-file.png', 'binary-content');

    const service = new StorageService();
    service.setDriver(memDriver);

    const upload = await service.generarPresignedUpload({
      folder: 'productos',
      mimeType: 'image/png',
      nombreArchivoOriginal: 'test.png',
    });

    expect(upload.uploadUrl).toBe('memory://upload/productos/test.png');
    expect(upload.key).toBe('productos/test.png');

    await service.eliminarArchivo('memory://test-file.png');
    expect(memDriver.files.has('memory://test-file.png')).toBe(false);
  });

  it('preserva compatibilidad con drivers tradicionales que implementen ICloudStorageDriver', async () => {
    const legacyDriver = {
      generarPresignedUpload: jest.fn().mockResolvedValue({
        uploadUrl: 'https://s3.legacy/up',
        key: 'k',
        publicUrl: 'https://s3.legacy/pub',
        fileName: 'k.txt',
      }),
      generarPresignedDownload: jest.fn().mockResolvedValue('https://s3.legacy/down'),
      eliminarObjeto: jest.fn().mockResolvedValue(undefined),
    };

    const service = new StorageService();
    service.setCloudDriver(legacyDriver);

    const up = await service.generarPresignedUpload({
      folder: 'tienda',
      mimeType: 'text/plain',
      nombreArchivoOriginal: 'doc.txt',
    });
    expect(up.uploadUrl).toBe('https://s3.legacy/up');

    const down = await service.generarPresignedDownload('k');
    expect(down).toBe('https://s3.legacy/down');
  });
});
