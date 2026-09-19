import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';

export interface CatalogoItem {
  id?: string | number | null;
  nombre?: string;
  descripcion?: string;
}

export interface CatalogoFormData {
  nombre: string;
  descripcion: string;
}

@Component({
  selector: 'app-catalogo-modal',
  templateUrl: './catalogo-modal.component.html',
  styleUrls: ['./catalogo-modal.component.scss'],
  standalone: false,
})
export class CatalogoModalComponent implements OnChanges {
  @ViewChild('nombreInput') nombreInput?: ElementRef<HTMLInputElement>;
  @ViewChild('descInput') descInput?: ElementRef<HTMLTextAreaElement>;

  @Input() isOpen = false;
  @Input() tipo = 'categoría';
  @Input() item: CatalogoItem | null = null;
  @Input() saving = false;

  @Output() saved = new EventEmitter<CatalogoFormData>();
  @Output() cancelled = new EventEmitter<void>();

  nombre = '';
  descripcion = '';
  errorNombre = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['item'] || (changes['isOpen'] && this.isOpen)) {
      this.nombre = this.item?.nombre || '';
      this.descripcion = this.item?.descripcion || '';
      this.errorNombre = '';
    }
  }

  onModalPresented(): void {
    setTimeout(() => {
      this.enfocarInput();
    }, 60);
  }

  enfocarInput(): void {
    const input = this.nombreInput?.nativeElement;
    if (input) {
      input.focus();
    }
  }

  enfocarTextarea(): void {
    const textarea = this.descInput?.nativeElement;
    if (textarea) {
      textarea.focus();
    }
  }

  get esEdicion(): boolean {
    return !!(this.item && this.item.id !== null && this.item.id !== undefined);
  }

  get tituloModal(): string {
    const accion = this.esEdicion ? 'Editar' : 'Registrar';
    return `${accion} ${this.tipo}`;
  }

  onSave(): void {
    if (this.saving) return;

    const nombreLimpio = this.nombre.trim();
    if (!nombreLimpio) {
      this.errorNombre = `El nombre de la ${this.tipo} es obligatorio.`;
      return;
    }

    this.errorNombre = '';
    this.saved.emit({
      nombre: nombreLimpio,
      descripcion: (this.descripcion || '').trim(),
    });
  }

  onCancel(): void {
    if (this.saving) return;
    this.cancelled.emit();
  }
}
