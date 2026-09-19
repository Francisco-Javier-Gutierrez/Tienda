import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { Sucursal, SucursalDto } from '../models/sucursal';
import { ConfiguracionTransferenciaAdmin, ConfiguracionTransferenciaDto } from '../models/pedido-cliente';
import { ConfiguracionTransferenciaService } from '../services/configuracion-transferencia.service';
import { SucursalService } from '../services/sucursal.service';

@Component({
  selector: 'app-configuracion-tienda',
  templateUrl: './configuracion-tienda.component.html',
  styleUrls: ['./configuracion-tienda.component.scss'],
  standalone: false,
})
export class ConfiguracionTiendaComponent implements OnChanges, OnInit {
  @Input() sucursales: Sucursal[] = [];
  @Input() sucursalActual: Sucursal | null = null;
  @Input() cargando = false;
  @Output() sucursalSeleccionada = new EventEmitter<Sucursal>();
  @Output() sucursalGuardada = new EventEmitter<Sucursal>();

  form: SucursalDto = this.vacio();
  errores: Partial<Record<keyof SucursalDto, string>> = {};
  guardando = false;
  logoPendiente: Blob | null = null;
  nombreLogo = '';
  previewLogo: string | null = null;
  transferencia: ConfiguracionTransferenciaDto = this.transferenciaVacia();
  cargandoTransferencia = true;
  guardandoTransferencia = false;

  private readonly api = inject(SucursalService);
  private readonly transferenciaApi = inject(ConfiguracionTransferenciaService);
  private readonly toast = inject(ToastController);

  ngOnInit(): void {
    this.cargarTransferencia();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sucursalActual']) this.cargarFormulario();
  }

  get opcionesSucursales(): { value: any; label: string }[] {
    return this.sucursales.map((s) => ({
      value: s.id,
      label: s.nombre || `Sucursal ${s.id}`,
    }));
  }

  seleccionar(id: number | string): void {
    const seleccionada = this.sucursales.find((sucursal) => String(sucursal.id) === String(id));
    if (seleccionada) this.sucursalSeleccionada.emit(seleccionada);
  }

  async tomarLogo(): Promise<void> {
    await this.prepararLogo(CameraSource.Camera);
  }

  async elegirLogo(): Promise<void> {
    await this.prepararLogo(CameraSource.Photos);
  }

  quitarPreview(): void {
    this.logoPendiente = null;
    this.nombreLogo = '';
    this.previewLogo = null;
  }

  async quitarLogoActual(): Promise<void> {
    if (!this.sucursalActual || this.guardando) return;
    const idSuc = this.sucursalActual.id;
    if (!idSuc) return;
    this.guardando = true;
    try {
      const actualizada = await firstValueFrom(this.api.quitarLogo(idSuc));
      this.sucursalGuardada.emit(actualizada);
      await this.feedback('Logo eliminado correctamente.', 'success');
    } catch (error: unknown) {
      await this.feedback(this.mensajeError(error, 'No pudimos eliminar el logo.'), 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async guardar(): Promise<void> {
    if (this.guardando) return;
    this.errores = this.validar();
    const primerError = Object.values(this.errores)[0];
    if (primerError) {
      await this.feedback(primerError, 'warning');
      return;
    }
    this.guardando = true;
    try {
      const idSucActual = this.sucursalActual ? this.sucursalActual.id : null;
      if (!this.form.nombreSuc?.trim() && this.sucursalActual) {
        this.form.nombreSuc = (this.sucursalActual.nombre || 'Mi Tienda').trim();
      }
      let guardada = idSucActual
        ? await firstValueFrom(this.api.actualizarSucursal(idSucActual, this.form))
        : await firstValueFrom(this.api.crearSucursal(this.form));
      let falloLogo = false;
      if (this.logoPendiente) {
        try {
          const idSucGuardada = guardada.id || idSucActual;
          if (idSucGuardada) {
            guardada = await firstValueFrom(this.api.subirLogo(idSucGuardada, this.logoPendiente, this.nombreLogo));
          }
        } catch (error: unknown) {
          falloLogo = true;
          console.error('La tienda se guardó, pero falló el logo', error);
        }
      }
      this.quitarPreview();
      this.sucursalGuardada.emit(guardada);
      await this.feedback(
        falloLogo
          ? 'La información se guardó, pero no pudimos subir el logo.'
          : 'Configuración guardada correctamente.',
        falloLogo ? 'warning' : 'success',
      );
    } catch (error: unknown) {
      await this.feedback(this.mensajeError(error, 'No pudimos guardar la configuración.'), 'danger');
    } finally {
      this.guardando = false;
    }
  }

  resolverLogo(): string | null {
    return this.previewLogo || this.api.resolverImagen(this.sucursalActual?.logo);
  }

  async guardarTransferencia(): Promise<void> {
    if (this.guardandoTransferencia) return;
    const error = this.validarTransferencia();
    if (error) {
      await this.feedback(error, 'warning');
      return;
    }
    this.guardandoTransferencia = true;
    try {
      const respuesta = await firstValueFrom(this.transferenciaApi.guardar(this.transferencia));
      this.transferencia = this.desdeTransferencia(respuesta.configuracion);
      await this.feedback('Configuración de transferencias guardada.', 'success');
    } catch (error: unknown) {
      await this.feedback(this.mensajeError(error, 'No pudimos guardar la configuración de transferencias.'), 'danger');
    } finally {
      this.guardandoTransferencia = false;
    }
  }

  private cargarFormulario(): void {
    const sucursal = this.sucursalActual;
    this.form = sucursal
      ? {
          nombreSuc: sucursal.nombre || null,
          descripcionSuc: sucursal.descripcion ?? null,
          telefonoSuc: sucursal.telefono ?? null,
          correoSuc: sucursal.correo ?? null,
          paginaWebSuc: sucursal.paginaWeb ?? null,
          redSocialSuc: sucursal.redSocial ?? null,
        }
      : this.vacio();
    this.errores = {};
    this.quitarPreview();
  }

  private vacio(): SucursalDto {
    return {
      nombreSuc: null,
      descripcionSuc: null,
      telefonoSuc: null,
      correoSuc: null,
      paginaWebSuc: null,
      redSocialSuc: null,
    };
  }

  private cargarTransferencia(): void {
    this.transferenciaApi.obtener().subscribe({
      next: (respuesta) => {
        if (respuesta.configuracion) this.transferencia = this.desdeTransferencia(respuesta.configuracion);
        this.cargandoTransferencia = false;
      },
      error: async (error: unknown) => {
        this.cargandoTransferencia = false;
        await this.feedback(
          this.mensajeError(error, 'No pudimos cargar la configuración de transferencias.'),
          'danger',
        );
      },
    });
  }

  private transferenciaVacia(): ConfiguracionTransferenciaDto {
    return { banco: '', titular: '', clabe: '', numeroCuenta: '', instrucciones: '', activo: false };
  }

  private desdeTransferencia(configuracion: ConfiguracionTransferenciaAdmin): ConfiguracionTransferenciaDto {
    return {
      banco: configuracion.banco || '',
      titular: configuracion.titular || '',
      clabe: configuracion.clabe || '',
      numeroCuenta: configuracion.numeroCuenta || '',
      instrucciones: configuracion.instrucciones || '',
      activo: Boolean(configuracion.activo),
    };
  }

  private validarTransferencia(): string | null {
    const datos = this.transferencia;
    if (datos.banco.trim().length > 100) return 'El banco no puede superar 100 caracteres.';
    if (datos.titular.trim().length > 150) return 'El titular no puede superar 150 caracteres.';
    if (datos.clabe.trim() && !/^\d{18}$/.test(datos.clabe.trim()))
      return 'La CLABE debe contener exactamente 18 dígitos.';
    if (datos.numeroCuenta.trim().length > 50) return 'El número de cuenta no puede superar 50 caracteres.';
    if (datos.instrucciones.trim().length > 1000) return 'Las instrucciones no pueden superar 1000 caracteres.';
    if (datos.activo && (!datos.banco.trim() || !datos.titular.trim()))
      return 'Banco y titular son obligatorios para habilitar transferencias.';
    if (datos.activo && !datos.clabe.trim() && !datos.numeroCuenta.trim())
      return 'Configura una CLABE o un número de cuenta.';
    return null;
  }

  private validar(): Partial<Record<keyof SucursalDto, string>> {
    const errores: Partial<Record<keyof SucursalDto, string>> = {};
    const correo = this.form.correoSuc?.trim();
    const web = this.form.paginaWebSuc?.trim();
    if ((this.form.nombreSuc?.length || 0) > 100) errores.nombreSuc = 'El nombre no puede superar 100 caracteres.';
    if ((this.form.descripcionSuc?.length || 0) > 255)
      errores.descripcionSuc = 'La descripción no puede superar 255 caracteres.';
    if ((this.form.telefonoSuc?.length || 0) > 15) errores.telefonoSuc = 'El teléfono no puede superar 15 caracteres.';
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.correoSuc = 'Ingresa un correo válido.';
    if (web) {
      try {
        new URL(web);
      } catch {
        errores.paginaWebSuc = 'Ingresa una URL válida, incluyendo https://.';
      }
    }
    return errores;
  }

  private async prepararLogo(source: CameraSource): Promise<void> {
    try {
      const foto = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.Uri,
        source,
        webUseInput: false,
      });
      const preview = foto.webPath || foto.path;
      if (!preview) throw new Error('No se recibió una imagen');
      const blob = await (await fetch(preview)).blob();
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
        await this.feedback('Selecciona una imagen JPEG, PNG o WEBP.', 'warning');
        return;
      }
      if (blob.size > 10 * 1024 * 1024) {
        await this.feedback('El logo no puede superar 10 MB.', 'warning');
        return;
      }
      this.logoPendiente = blob;
      this.previewLogo = preview;
      this.nombreLogo = `logo.${blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message.toLowerCase() : '';
      if (!mensaje.includes('cancel')) {
        this.abrirInputWebLogo(source);
      }
    }
  }

  private abrirInputWebLogo(source: CameraSource): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    if (source === CameraSource.Camera) {
      input.capture = 'environment';
    }
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        await this.feedback('Selecciona una imagen JPEG, PNG o WEBP.', 'warning');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        await this.feedback('El logo no puede superar 10 MB.', 'warning');
        return;
      }
      this.logoPendiente = file;
      this.previewLogo = URL.createObjectURL(file);
      this.nombreLogo = `logo.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
    };
    input.click();
  }

  private async feedback(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toast.create({
      message,
      color,
      duration: 3200,
      position: 'top',
      cssClass: 'pastel-toast',
    });
    await toast.present();
  }

  private mensajeError(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
      ? error.error.message
      : fallback;
  }
}
