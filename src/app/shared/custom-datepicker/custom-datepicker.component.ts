import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonDatetime, IonModal } from '@ionic/angular';

let nextDatePickerId = 0;

@Component({
  selector: 'app-custom-datepicker',
  templateUrl: './custom-datepicker.component.html',
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomDatepickerComponent),
      multi: true,
    },
  ],
})
export class CustomDatepickerComponent implements ControlValueAccessor {
  @ViewChild('modal') modal?: IonModal;
  @ViewChild('datetime') datetime?: IonDatetime;

  @Input() label = '';
  @Input() placeholder = 'Selecciona una fecha';
  @Input() disabled = false;
  @Input() clearable = true;
  @Input() compact = false;
  @Input() min?: string;
  @Input() max?: string;
  @Input() showShortcuts = true;
  @Input() title = 'Seleccionar fecha';

  @Output() dateChange = new EventEmitter<string | null>();

  readonly triggerId = `custom-datepicker-${++nextDatePickerId}`;

  selectedValue: string | null = null;
  internalIso = '';
  tempSelectedValue: string | null = null;
  isModalOpen = false;

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly elementRef: ElementRef) {}

  writeValue(value: any): void {
    if (!value) {
      this.selectedValue = null;
      this.internalIso = this.getTodayIso();
    } else if (typeof value === 'string') {
      const clean = value.split('T')[0];
      this.selectedValue = clean;
      this.internalIso = this.toFullIso(clean);
    } else if (value instanceof Date && !isNaN(value.getTime())) {
      const clean = this.formatDateToYmd(value);
      this.selectedValue = clean;
      this.internalIso = this.toFullIso(clean);
    } else {
      this.selectedValue = null;
      this.internalIso = this.getTodayIso();
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled && this.isModalOpen) {
      this.closeModal();
    }
  }

  openModal(): void {
    if (this.disabled) return;
    if (this.selectedValue) {
      this.internalIso = this.toFullIso(this.selectedValue);
      this.tempSelectedValue = this.selectedValue;
    } else {
      this.internalIso = this.getTodayIso();
      this.tempSelectedValue = this.formatDateToYmd(new Date());
    }
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.onTouched();
  }

  onModalDismiss(): void {
    this.isModalOpen = false;
    this.onTouched();
  }

  onDatePicked(event: any): void {
    const rawVal = event.detail.value;
    if (!rawVal) return;
    const clean = Array.isArray(rawVal) ? rawVal[0]?.split('T')[0] : rawVal.split('T')[0];
    if (clean) {
      this.tempSelectedValue = clean;
      this.internalIso = this.toFullIso(clean);
    }
  }

  confirmSelection(): void {
    if (this.tempSelectedValue) {
      this.selectedValue = this.tempSelectedValue;
      this.internalIso = this.toFullIso(this.tempSelectedValue);
      this.onChange(this.selectedValue);
      this.dateChange.emit(this.selectedValue);
    }
    this.closeModal();
  }

  setToday(event?: Event): void {
    if (event) event.stopPropagation();
    const today = this.formatDateToYmd(new Date());
    this.selectedValue = today;
    this.tempSelectedValue = today;
    this.internalIso = this.toFullIso(today);
    this.onChange(this.selectedValue);
    this.dateChange.emit(this.selectedValue);
    this.closeModal();
  }

  setYesterday(event?: Event): void {
    if (event) event.stopPropagation();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ymd = this.formatDateToYmd(yesterday);
    this.selectedValue = ymd;
    this.tempSelectedValue = ymd;
    this.internalIso = this.toFullIso(ymd);
    this.onChange(this.selectedValue);
    this.dateChange.emit(this.selectedValue);
    this.closeModal();
  }

  clearSelection(event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedValue = null;
    this.tempSelectedValue = null;
    this.internalIso = this.getTodayIso();
    this.onChange(null);
    this.dateChange.emit(null);
    this.onTouched();
    this.closeModal();
  }

  get selectedLabel(): string {
    if (!this.selectedValue) return '';
    const date = this.parseYmd(this.selectedValue);
    if (!date) return this.selectedValue;

    if (this.compact) {
      return date.toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }

    return date.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private parseYmd(ymd: string): Date | null {
    const parts = ymd.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
    return null;
  }

  private formatDateToYmd(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toFullIso(ymd: string): string {
    return `${ymd}T12:00:00.000Z`;
  }

  private getTodayIso(): string {
    return this.toFullIso(this.formatDateToYmd(new Date()));
  }
}
