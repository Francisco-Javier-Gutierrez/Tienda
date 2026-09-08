export type EstadoPedidoCliente =
  'PENDIENTE_PAGO' | 'EN_REVISION' | 'PAGADO' | 'RECHAZADO' | 'CANCELADO' | 'EXPIRADO' | 'LISTO' | 'ENTREGADO';

export interface ConfiguracionTransferencia {
  banco: string;
  titular: string;
  clabe: string | null;
  numeroCuenta: string | null;
  instrucciones: string | null;
}

export interface ConfiguracionTransferenciaAdmin extends ConfiguracionTransferencia {
  idConfiguracion: string;
  idSuc: string;
  activo: boolean;
  fechaActualizacion: string;
}

export interface ConfiguracionTransferenciaDto {
  banco: string;
  titular: string;
  clabe: string;
  numeroCuenta: string;
  instrucciones: string;
  activo: boolean;
}

export interface DetallePedidoCliente {
  id?: string;
  productoId?: string;
  idPro?: string | number;
  nombre: string;
  imagen: string | null;
  presentacion: string | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface PedidoClienteResumen {
  id: string;
  idPedido?: string | number;
  folio: string;
  uuidPedido: string;
  fechaPedido: string;
  fechaLimitePago: string | null;
  estado: EstadoPedidoCliente;
  total: number;
  tieneComprobante: boolean;
  fechaComprobante: string | null;
  motivoRechazo: string | null;
  idVenta?: string | number | null;
  ventaId?: string | number | null;
  fechaRevision: string | null;
}

export interface ComprobantePedidoInfo {
  nombre: string;
  mime: string;
  fecha: string | null;
  url?: string | null;
}

export interface PedidoCliente extends PedidoClienteResumen {
  items: DetallePedidoCliente[];
  configuracionTransferencia: ConfiguracionTransferencia | null;
  comprobanteUrl?: string | null;
  comprobante?: ComprobantePedidoInfo | null;
}

export interface CrearPedidoRequest {
  uuidPedido: string;
  items: Array<{ id?: string; productoId?: string; idPro?: string | number; cantidad: number }>;
}

export interface ClientePedidoAdmin {
  id: string;
  idCliente?: string | number;
  nombre: string;
  correo: string;
  foto: string | null;
}

export interface ComprobantePedidoAdmin {
  nombre: string;
  mime: string;
  fecha: string | null;
  url?: string | null;
}

export interface PedidoAdminResumen {
  id: string;
  idPedido?: string | number;
  folio: string;
  uuidPedido: string;
  fechaPedido: string;
  fechaLimitePago: string | null;
  total: number;
  estado: EstadoPedidoCliente;
  fechaComprobante: string | null;
  comprobante: ComprobantePedidoAdmin | null;
  comprobanteUrl?: string | null;
  fechaRevision: string | null;
  motivoRechazo: string | null;
  idVenta?: string | number | null;
  ventaId?: string | number | null;
  cliente: ClientePedidoAdmin;
}

export interface PedidoAdminDetalle extends PedidoAdminResumen {
  empleadoRevisa: string | null;
  configuracionTransferencia: ConfiguracionTransferencia | null;
  items: DetallePedidoCliente[];
}
