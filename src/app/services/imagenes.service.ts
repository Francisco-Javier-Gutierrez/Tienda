import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImagenesService {
  readonly AVATAR_GENERICO = 'assets/img/default-avatar.svg';
  private readonly fallidas = new Set<string>();

  private readonly S3_BASE_URL = 'https://tienda-donapaty-uploads.s3.us-east-1.amazonaws.com';

  constructor() {
    try {
      // Limpiar URLs fallidas guardadas anteriormente para permitir recarga de imágenes ahora activas
      sessionStorage.removeItem('tienda_img_fallidas');
    } catch {
      // Ignorar errores en entornos sin sessionStorage
    }
  }

  resolver(ruta: string | null | undefined): string | null {
    if (!ruta) return null;
    const url = ruta.trim();
    if (!url || this.esFallida(url)) return null;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('tienda/') || url.startsWith('productos/') || url.startsWith('comprobantes/')) {
      return `${this.S3_BASE_URL}/${url}`;
    }
    return url.startsWith('/') ? `${environment.API_BASE_URL}${url}` : url;
  }

  resolverAvatar(ruta: string | null | undefined): string {
    const res = this.resolver(ruta);
    return res || this.AVATAR_GENERICO;
  }

  marcarFallida(ruta: string | null | undefined): void {
    if (!ruta) return;
    const url = ruta.trim();
    if (!url) return;
    this.fallidas.add(url);
    try {
      sessionStorage.setItem('tienda_img_fallidas', JSON.stringify([...this.fallidas]));
    } catch {
      // Ignorar
    }
  }

  esFallida(ruta: string | null | undefined): boolean {
    if (!ruta) return false;
    return this.fallidas.has(ruta.trim());
  }

  limpiarFallida(ruta: string | null | undefined): void {
    if (!ruta) return;
    const url = ruta.trim();
    this.fallidas.delete(url);
    try {
      sessionStorage.setItem('tienda_img_fallidas', JSON.stringify([...this.fallidas]));
    } catch {
      // Ignorar
    }
  }
}
