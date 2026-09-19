/**
 * =========================================================================
 * Liskov Substitution Principle (LSP) - Storage Driver Interface
 * =========================================================================
 * Contrato formal para controladores de almacenamiento. Todos los subtipos
 * (LocalStorageDriver, SessionStorageDriver, MemoryStorageDriver) deben ser
 * intercambiables sin alterar la corrección ni lanzar excepciones inesperadas.
 */
export interface StorageDriver {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}
