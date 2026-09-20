export type TipoMerma = 'CADUCADO' | 'DANADO' | 'DEVOLUCION_PROVEEDOR' | 'CONSUMO_INTERNO' | 'OTRO';
export type EstadoMerma = 'APLICADO' | 'PENDIENTE_REPOSICION' | 'DEVUELTO_PROVEEDOR';

export interface Merma {
  id: string;
  idMerma?: number;
  uuidMerma?: string | null;
  sucursalId: string;
  empleadoId: string;
  empleadoNombre: string;
  productoId: string;
  idPro?: number;
  productoNombre: string;
  codigoQR?: string | null;
  cantidad: number;
  tipo: TipoMerma;
  motivo: string;
  costoUnitario: number;
  costoTotal: number;
  precioVentaUnitario: number;
  proveedorId?: string | null;
  proveedorNombre?: string | null;
  estado: EstadoMerma;
  fecha: string;
  fechaHora: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegistrarMermaDto {
  uuidMerma?: string;
  idPro: string | number;
  cantidad: number;
  tipo: TipoMerma;
  motivo: string;
  idProv?: string | number | null;
  estado?: EstadoMerma;
}

export interface MermaResumen {
  totalPerdida: number;
  totalPiezas: number;
  totalDevolucionesPendientes: number;
  piezasDevolucionesPendientes: number;
  porTipo: Record<TipoMerma, { conteo: number; piezas: number; costoTotal: number }>;
  topProductos: Array<{
    idPro: number;
    nombre: string;
    cantidad: number;
    costoTotal: number;
  }>;
  totalRegistros: number;
}
