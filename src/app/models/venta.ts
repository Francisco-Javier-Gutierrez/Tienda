export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
export type EstadoVenta = 'COMPLETADA' | 'CANCELADA';

export interface ProductoPos {
  id: string;
  nombre: string;
  precioVenta: number;
  existencia: number;
  codigoQR: string | null;
  sku: string | null;
  imagen: string | null;
  tamano: string | null;
  presentacion: string | null;
  marca: string | null;
  categoria: string | null;
}

export interface ItemVenta {
  id: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  existenciaDisponible: number;
  subtotal: number;
  imagen: string | null;
}

export interface VentaResumen {
  id: string;
  uuid: string;
  sesionCajaId: string;
  fecha: string;
  hora: string;
  total: number;
  metodoPago: MetodoPago;
  estado: EstadoVenta;
  origen: 'ONLINE' | 'POS';
  cajero: string | null;
}

export interface VentaDetalle {
  id: string;
  uuid: string;
  sesionCajaId: string;
  fecha: string;
  hora: string;
  total: number;
  metodoPago: MetodoPago;
  montoRecibido: number | null;
  cambio: number;
  estado: EstadoVenta;
  fechaCancelacion: string | null;
  motivoCancelacion: string | null;
  cajeroCancela: string | null;
  sucursal?: string | null;
  nombreSuc?: string | null;
  descripcionSuc?: string | null;
  telefonoSuc?: string | null;
  correoSuc?: string | null;
  logoSuc?: string | null;
  origen: 'ONLINE' | 'POS';
  cajero: { id: string; nombre: string | null } | string | null;
  items: Array<{
    idDetalle?: string;
    productoId?: string;
    id?: string;
    nombre: string;
    codigoQR?: string | null;
    sku?: string | null;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
}

export interface VentaRegistrada {
  id: string;
  uuid: string;
  sesionCajaId: string;
  fecha: string;
  hora: string;
  total: number;
  metodoPago: MetodoPago;
  montoRecibido: number | null;
  cambio: number;
  estado: EstadoVenta;
  cajero: { id: string; nombre: string | null };
  items: Array<{
    id: string;
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
}

export interface CrearVentaDto {
  uuidVenta: string;
  items: Array<{ id: string; cantidad: number }>;
  metodoPago: MetodoPago;
  montoRecibido: number | null;
}

export interface VentaCancelada {
  id: string;
  estado: 'CANCELADA';
  fechaCancelacion: string | null;
  motivoCancelacion: string | null;
  cajeroCancelaId?: string | null;
}
