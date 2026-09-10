import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImagenesService {
  readonly AVATAR_GENERICO = 'assets/img/default-avatar.svg';
  private readonly fallidas = new Set<string>();

  constructor() {
    try {
      const guardadas = sessionStorage.getItem('tienda_img_fallidas');
      if (guardadas) {
        const parsed = JSON.parse(guardadas);
        if (Array.isArray(parsed)) {
          parsed.forEach((url) => {
            if (typeof url === 'string') this.fallidas.add(url);
          });
        }
      }
    } catch {
      // Ignorar errores en entornos sin sessionStorage
    }
  }

  resolver(ruta: string | null | undefined): string | null {
    if (!ruta) return null;
    const url = ruta.trim();
    if (!url || this.esFallida(url)) return null;
    if (/^https?:\/\//i.test(url)) return url;
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
