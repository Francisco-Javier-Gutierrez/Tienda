import { BehaviorSubject, Observable } from 'rxjs';
import { StorageDriver } from '../storage/storage-driver.interface';

export interface SessionPrincipal {
  token?: string | null;
  [key: string]: any;
}

/**
 * =========================================================================
 * Liskov Substitution Principle (LSP) - Base Session Store
 * =========================================================================
 * Contrato y comportamiento base para almacenamiento de sesiones.
 * Cualquier implementación (AuthSessionStore, ClienteSessionStore, etc.)
 * respeta las invariantes y pre/post-condiciones, permitiendo sustituir
 * una sesión por otra sin alterar la corrección del sistema.
 */
export abstract class BaseSessionStore<T extends SessionPrincipal> {
  protected readonly subject: BehaviorSubject<T | null>;
  readonly sesion$: Observable<T | null>;

  constructor(
    protected readonly clave: string,
    protected readonly storage: StorageDriver,
  ) {
    this.subject = new BehaviorSubject<T | null>(this.leer());
    this.sesion$ = this.subject.asObservable();
  }

  get sesion(): T | null {
    return this.subject.value;
  }

  get token(): string | null {
    return this.sesion?.token ?? null;
  }

  guardar(sesion: T): void {
    try {
      this.storage.setItem(this.clave, JSON.stringify(sesion));
      this.subject.next(sesion);
    } catch {
      this.subject.next(sesion);
    }
  }

  limpiar(): void {
    try {
      this.storage.removeItem(this.clave);
    } catch {
      // Ignorar errores de almacenamiento
    }
    this.subject.next(null);
  }

  protected leer(): T | null {
    try {
      const v = this.storage.getItem(this.clave);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  }
}
