import fs from 'fs';
import path from 'path';
import Hashids from 'hashids';
import { env } from '../config/env';

const primarySalt = env.HASHIDS_SALT || 'TiendaHashidsSaltSecret2026';
const hashids = new Hashids(primarySalt, 8);
const fallbackHashids = env.JWT_SECRET ? new Hashids(env.JWT_SECRET, 8) : null;

export function encodeId(id: number | null | undefined): string | null {
  if (id === null || id === undefined) return null;
  return hashids.encode(id);
}

export function idValido(id: unknown): number | null {
  if (typeof id === 'string' && isNaN(Number(id))) {
    const decoded = hashids.decode(id);
    if (decoded.length > 0) return Number(decoded[0]);
    if (fallbackHashids) {
      const fallbackDecoded = fallbackHashids.decode(id);
      if (fallbackDecoded.length > 0) return Number(fallbackDecoded[0]);
    }
  }
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

export function textoNullable(valor: unknown): string | null {
  const normalizado = texto(valor);
  return normalizado ? normalizado : null;
}

export function numero(valor: unknown, fallback = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

export function formatearFechaVenta(fecha: unknown): string | null {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha.toISOString().split('T')[0];
  return String(fecha).slice(0, 10);
}

export function formatearHoraVenta(hora: unknown): string | null {
  if (!hora) return null;
  if (hora instanceof Date) return hora.toISOString().slice(11, 19);
  return String(hora).slice(0, 8);
}

export function eliminarUploadControlado(
  rutaRelativa: string | null | undefined,
  uploadDir: string,
  prefijo: string,
): void {
  if (!rutaRelativa || typeof rutaRelativa !== 'string') return;
  if (rutaRelativa.startsWith(prefijo)) {
    const nombreArchivo = path.basename(rutaRelativa);
    const rutaFisica = path.join(uploadDir, nombreArchivo);
    fs.unlink(rutaFisica, () => undefined);
  }
}

export function uuidValido(value: unknown): string | null {
  const uuid = texto(value).toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid) ? uuid : null;
}

export function dineroCentavos(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export interface AppError extends Error {
  status?: number;
  payload?: any;
}

export function errorFuncional(message: string, status = 400, payload?: any): AppError {
  const error: AppError = new Error(message);
  error.status = status;
  if (payload !== undefined) error.payload = payload;
  return error;
}
