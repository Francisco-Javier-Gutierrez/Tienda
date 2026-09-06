import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { ImagenesService } from '../../services/imagenes.service';

export type ProductCardMode = 'admin' | 'cajero' | 'catalogo';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
  standalone: false,
})
export class ProductCardComponent {
  @Input() producto: any;
  @Input() mode: ProductCardMode = 'catalogo';

  @Output() cardClick = new EventEmitter<any>();
  @Output() add = new EventEmitter<any>();
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();

  private readonly imagenes = inject(ImagenesService);

  imageError = false;
  private prevImagen: string | null = null;

  get imagenUrl(): string | null {
    const actual = this.producto?.imagen;
    if (actual !== this.prevImagen) {
      this.prevImagen = actual;
      this.imageError = false;
    }
    if (this.imageError) return null;
    return this.imagenes.resolver(actual);
  }

  onImageError(): void {
    this.imageError = true;
  }

  get stock(): number {
    return Number(this.producto?.existencia ?? 0);
  }

  get disponible(): boolean {
    return this.stock > 0;
  }

  get stockBajo(): boolean {
    const stockMin = this.producto?.stockMinimo;
    if (stockMin !== null && stockMin !== undefined) {
      return this.stock <= Number(stockMin);
    }
    return this.stock <= 3;
  }

  get categoriaNombre(): string {
    if (!this.producto) return '';
    if (typeof this.producto.categoria === 'string') return this.producto.categoria;
    if (this.producto.categoria && typeof this.producto.categoria === 'object') {
      return this.producto.categoria.nombre || '';
    }
    return '';
  }

  get marcaNombre(): string {
    if (!this.producto) return '';
    if (typeof this.producto.marca === 'string') return this.producto.marca;
    if (this.producto.marca && typeof this.producto.marca === 'object') {
      return this.producto.marca.nombre || '';
    }
    return '';
  }

  onCardClick(): void {
    if (this.mode === 'cajero') {
      if (this.disponible) {
        this.add.emit(this.producto);
      }
    } else if (this.mode === 'admin') {
      this.edit.emit(this.producto);
    }
    this.cardClick.emit(this.producto);
  }

  onAdd(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disponible) {
      this.add.emit(this.producto);
    }
  }

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.edit.emit(this.producto);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.delete.emit(this.producto);
  }
}
