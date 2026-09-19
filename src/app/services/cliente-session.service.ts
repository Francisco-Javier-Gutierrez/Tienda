import { inject, Injectable } from '@angular/core';
import { ClienteAuthSession } from '../models/cliente-auth';
import { BaseSessionStore } from './session/base-session-store';
import { SessionStorageDriver } from './storage/session-storage.driver';

/**
 * =========================================================================
 * Liskov Substitution Principle (LSP) - Cliente Session Store
 * =========================================================================
 * Subtipo de BaseSessionStore para clientes de la tienda online.
 * Puede ser sustituido por cualquier BaseSessionStore sin alterar el sistema.
 */
@Injectable({ providedIn: 'root' })
export class ClienteSessionStore extends BaseSessionStore<ClienteAuthSession> {
  constructor() {
    super('tienda.cliente.auth.session', inject(SessionStorageDriver));
  }
}
