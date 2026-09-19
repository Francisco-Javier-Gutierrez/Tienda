import { Component, EventEmitter, Input, Output } from '@angular/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'full' | 'sheet';

@Component({
  selector: 'app-modal-shell',
  templateUrl: './modal-shell.component.html',
  styleUrls: ['./modal-shell.component.scss'],
  standalone: false,
})
export class ModalShellComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() showHeader = true;
  @Input() showFooter = false;
  @Input() showCloseButton = true;
  @Input() closeButtonPosition: 'start' | 'end' = 'start';
  @Input() size: ModalSize = 'md';
  @Input() initialBreakpoint?: number;
  @Input() breakpoints?: number[];
  @Input() backdropDismiss = true;
  @Input() useIonContent = true;
  @Input() focusTrap = true;
  @Input() customClass = '';

  @Output() closed = new EventEmitter<void>();
  @Output() didDismiss = new EventEmitter<void>();
  @Output() didPresent = new EventEmitter<void>();

  get computedClass(): string {
    const sizeClass = `modal-shell-${this.size}`;
    return [sizeClass, this.customClass].filter(Boolean).join(' ');
  }

  onClose(): void {
    this.closed.emit();
  }

  onDismiss(): void {
    this.didDismiss.emit();
    this.closed.emit();
  }

  onDidPresent(): void {
    this.didPresent.emit();
  }
}
