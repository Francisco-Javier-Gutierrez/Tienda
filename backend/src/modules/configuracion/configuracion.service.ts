import { prisma } from '../../config/prisma';
import { texto, errorFuncional } from '../../utils/formatters';
import { normalizarConfiguracionTransferencia, pedidosService } from '../pedidos/pedidos.service';

function booleanoEstricto(value: unknown): boolean | null {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return null;
}

export function validarConfiguracionTransferencia(body: any) {
  const activo = booleanoEstricto(body.activo);
  const banco = texto(body.banco);
  const titular = texto(body.titular);
  const clabe = texto(body.clabe);
  const numeroCuenta = texto(body.numeroCuenta);
  const instrucciones = texto(body.instrucciones);

  if (activo === null) return { error: 'El estado de transferencias no es válido.' };
  if (banco.length > 100) return { error: 'El banco no puede superar 100 caracteres.' };
  if (titular.length > 150) return { error: 'El titular no puede superar 150 caracteres.' };
  if (clabe && !/^\d{18}$/.test(clabe)) return { error: 'La CLABE debe contener exactamente 18 dígitos.' };
  if (numeroCuenta.length > 50) return { error: 'El número de cuenta no puede superar 50 caracteres.' };
  if (instrucciones.length > 1000) return { error: 'Las instrucciones no pueden superar 1000 caracteres.' };
  if (activo && (!banco || !titular)) return { error: 'Banco y titular son obligatorios al habilitar transferencias.' };
  if (activo && !clabe && !numeroCuenta) return { error: 'Configura una CLABE o un número de cuenta.' };

  return {
    valores: {
      banco,
      titular,
      clabe: clabe || null,
      numeroCuenta: numeroCuenta || null,
      instrucciones: instrucciones || null,
      activo,
    },
  };
}

export class ConfiguracionService {
  async obtenerAdmin(idSuc: number) {
    const configuracion = await prisma.configuracionTransferencia.findUnique({
      where: { idSuc },
    });
    return normalizarConfiguracionTransferencia(configuracion, true);
  }

  async actualizarAdmin(idSuc: number, body: any) {
    const validacion = validarConfiguracionTransferencia(body || {});
    if (validacion.error) {
      throw errorFuncional(validacion.error, 400);
    }
    const datos = validacion.valores!;
    const configuracion = await prisma.configuracionTransferencia.upsert({
      where: { idSuc },
      update: {
        banco: datos.banco,
        titular: datos.titular,
        clabe: datos.clabe,
        numeroCuenta: datos.numeroCuenta,
        instrucciones: datos.instrucciones,
        activo: datos.activo,
        fechaActualizacion: new Date(),
      },
      create: {
        idSuc,
        banco: datos.banco,
        titular: datos.titular,
        clabe: datos.clabe,
        numeroCuenta: datos.numeroCuenta,
        instrucciones: datos.instrucciones,
        activo: datos.activo,
      },
    });
    return normalizarConfiguracionTransferencia(configuracion, true);
  }

  async obtenerCliente() {
    const idSuc = await pedidosService.obtenerSucursalDisponibleCliente();
    const configuracion = await pedidosService.obtenerConfiguracionTransferencia(idSuc, true);
    return normalizarConfiguracionTransferencia(configuracion);
  }
}

export const configuracionService = new ConfiguracionService();
