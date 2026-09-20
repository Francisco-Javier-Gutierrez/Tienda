import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { CrearClienteRapidoDto } from '../../models/fiado';

@Component({
  selector: 'app-cliente-modal',
  templateUrl: './cliente-modal.component.html',
  styleUrls: ['./cliente-modal.component.scss'],
  standalone: false,
})
export class ClienteModalComponent implements OnChanges {
  @ViewChild('nombreInput') nombreInput?: ElementRef<HTMLInputElement>;

  @Input() isOpen = false;
  @Input() sugerenciaNombre = '';
  @Input() saving = false;

  @Output() saved = new EventEmitter<CrearClienteRapidoDto>();
  @Output() cancelled = new EventEmitter<void>();

  form: CrearClienteRapidoDto = {
    nombreCliente: '',
    apellidoPatCliente: '',
    apellidoMatCliente: '',
    telefono: '',
    correoCliente: '',
    limiteCredito: null,
    direccion: '',
    notas: '',
  };

  errorNombre = '';
  errorTelefono = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.resetForm();
    }
  }

  private resetForm(): void {
    let nombreSugerido = (this.sugerenciaNombre || '').trim();
    let apPaterno = '';
    let apMaterno = '';

    if (nombreSugerido) {
      const partes = nombreSugerido.split(' ').filter(Boolean);
      if (partes.length === 1) {
        nombreSugerido = partes[0];
      } else if (partes.length === 2) {
        nombreSugerido = partes[0];
        apPaterno = partes[1];
      } else if (partes.length >= 3) {
        nombreSugerido = partes.slice(0, partes.length - 2).join(' ');
        apPaterno = partes[partes.length - 2];
        apMaterno = partes[partes.length - 1];
      }
    }

    this.form = {
      nombreCliente: nombreSugerido,
      apellidoPatCliente: apPaterno,
      apellidoMatCliente: apMaterno,
      telefono: '',
      correoCliente: '',
      limiteCredito: null,
      direccion: '',
      notas: '',
    };
    this.errorNombre = '';
    this.errorTelefono = '';
  }

  onModalPresented(): void {
    setTimeout(() => {
      this.nombreInput?.nativeElement?.focus();
    }, 80);
  }

  onSave(): void {
    if (this.saving) return;

    const nombreLimpio = (this.form.nombreCliente || '').trim();
    const telLimpio = (this.form.telefono || '').replace(/[^0-9]/g, '');

    let valido = true;

    if (nombreLimpio.length < 2) {
      this.errorNombre = 'El nombre debe tener al menos 2 letras.';
      valido = false;
    } else {
      this.errorNombre = '';
    }

    if (telLimpio.length < 10) {
      this.errorTelefono = 'El teléfono / WhatsApp debe tener 10 dígitos.';
      valido = false;
    } else {
      this.errorTelefono = '';
    }

    if (!valido) return;

    this.saved.emit({
      nombreCliente: nombreLimpio,
      apellidoPatCliente: (this.form.apellidoPatCliente || '').trim() || undefined,
      apellidoMatCliente: (this.form.apellidoMatCliente || '').trim() || undefined,
      telefono: telLimpio,
      correoCliente: (this.form.correoCliente || '').trim() || undefined,
      limiteCredito: this.form.limiteCredito ? Number(this.form.limiteCredito) : undefined,
      direccion: (this.form.direccion || '').trim() || undefined,
      notas: (this.form.notas || '').trim() || undefined,
    });
  }

  onCancel(): void {
    if (this.saving) return;
    this.cancelled.emit();
  }
}
