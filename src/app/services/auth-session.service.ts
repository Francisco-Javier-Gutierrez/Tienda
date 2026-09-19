import { inject, Injectable } from '@angular/core';
import { AuthSession } from '../models/auth';
import { BaseSessionStore } from './session/base-session-store';
import { SessionStorageDriver } from './storage/session-storage.driver';

/**
 * =========================================================================
 * Liskov Substitution Principle (LSP) - Auth Session Store
 * =========================================================================
 * Subtipo de BaseSessionStore para empleados/administradores.
 * Puede ser sustituido por cualquier BaseSessionStore sin alterar el sistema.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionStore extends BaseSessionStore<AuthSession> {
  constructor() {
    super('tienda.auth.session', inject(SessionStorageDriver));
  }
}
