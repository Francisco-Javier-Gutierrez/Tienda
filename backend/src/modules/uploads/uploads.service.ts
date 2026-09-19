import { authRepository } from '../../db/repositories/auth.repository';
import { idValido, texto, errorFuncional } from '../../utils/formatters';
import { storageService, IStorageService } from '../../services/storage.service';

export interface PresignUploadDto {
  tipo: string;
  mimeType: string;
  extension?: string;
  nombreOriginal?: string;
}

/**
 * =========================================================================
 * Dependency Inversion Principle (DIP) - Uploads
 * =========================================================================
 * - IUploadsService: Abstracción consumida por UploadsController
 * - Inyección de dependencias de IStorageService en UploadsService
 */
export interface IUploadsService {
  solicitarPresign(payload: any, dto: PresignUploadDto): Promise<any>;
}

export class UploadsService implements IUploadsService {
  constructor(
    private storage: IStorageService = storageService,
    private authRepo: any = authRepository,
  ) {}

  async solicitarPresign(payload: any, dto: PresignUploadDto) {
    const tipo = texto(dto.tipo).toUpperCase();
    const mimeType = texto(dto.mimeType).toLowerCase();
    const extension = texto(dto.extension).toLowerCase();

    const carpetasPorTipo: Record<string, string> = {
      PRODUCTO: 'productos',
      TIENDA: 'tienda',
      COMPROBANTE: 'comprobantes',
    };

    const carpeta = carpetasPorTipo[tipo];
    if (!carpeta) {
      throw errorFuncional('Tipo de upload no válido. Usa PRODUCTO, TIENDA o COMPROBANTE.', 400);
    }

    if (tipo === 'COMPROBANTE') {
      if (payload.tipo !== 'CLIENTE' && payload.tipo !== 'EMPLEADO') {
        throw errorFuncional('No autorizado', 403);
      }
      if (!this.storage.esMimePermitidoComprobante(mimeType)) {
        throw errorFuncional('MIME type no permitido para comprobante (JPG, PNG, WEBP, PDF).', 400);
      }
    } else {
      if (payload.tipo !== 'EMPLEADO') {
        throw errorFuncional('No autorizado', 403);
      }
      const idEmp = idValido(payload.sub);
      const emp = idEmp ? await this.authRepo.findEmpleadoById(idEmp) : null;
      const esAdmin = Boolean(emp && emp.estadoEmp && (emp.cargoNombre === 'ADMINISTRADOR' || emp.cargo === 'ADMINISTRADOR'));

      if (!esAdmin) {
        throw errorFuncional('Solo los administradores pueden subir imágenes de productos o tienda', 403);
      }
      if (!this.storage.esMimePermitidoImagen(mimeType)) {
        throw errorFuncional('MIME type no permitido para imagen (JPG, PNG, WEBP).', 400);
      }
    }

    const nombreLimpio = texto(dto.nombreOriginal);
    const data = await this.storage.generarPresignedUpload({
      folder: carpeta,
      mimeType,
      extensionOriginal: extension || undefined,
      nombreArchivoOriginal: nombreLimpio || undefined,
    });

    return {
      ...data,
      rutaPublica: data.publicUrl,
      expiresIn: 900,
    };
  }
}

export const uploadsService = new UploadsService();
