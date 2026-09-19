import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: any;
  label: string;
  icon?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-custom-select',
  templateUrl: './custom-select.component.html',
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true,
    },
  ],
})
export class CustomSelectComponent implements ControlValueAccessor, OnChanges {
  @Input() options: any[] = [];
  @Input() valueKey = 'value';
  @Input() labelKey = 'label';
  @Input() placeholder = 'Selecciona una opción';
  @Input() disabled = false;
  @Input() searchable = false;
  @Input() clearable = false;
  @Input() compact = false;
  @Input() allowCreate = false;
  @Input() createLabel = 'Crear nuevo';

  @Output() createOption = new EventEmitter<string>();

  selectedValue: any = null;
  isOpen = false;
  searchQuery = '';
  normalizedOptions: SelectOption[] = [];

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly elementRef: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options'] || changes['valueKey'] || changes['labelKey']) {
      this.normalizeOptions();
    }
  }

  writeValue(value: any): void {
    this.selectedValue = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) this.isOpen = false;
  }

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  toggleDropdown(): void {
    if (this.disabled) return;
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchQuery = '';
      setTimeout(() => {
        this.searchInput?.nativeElement?.focus();
      }, 120);
    } else {
      this.onTouched();
    }
  }

  selectOption(option: SelectOption): void {
    if (option.disabled) return;
    this.selectedValue = option.value;
    this.onChange(this.selectedValue);
    this.onTouched();
    this.isOpen = false;
  }

  clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    this.selectedValue = null;
    this.onChange(null);
    this.onTouched();
  }

  handleCreate(event: MouseEvent): void {
    event.stopPropagation();
    const query = this.searchQuery.trim();
    this.createOption.emit(query);
    this.isOpen = false;
    this.onTouched();
  }

  get selectedLabel(): string {
    const found = this.normalizedOptions.find((opt) => this.areValuesEqual(opt.value, this.selectedValue));
    return found ? found.label : '';
  }

  isSelected(option: SelectOption): boolean {
    return this.areValuesEqual(option.value, this.selectedValue);
  }

  get filteredOptions(): SelectOption[] {
    if (!this.searchQuery.trim()) return this.normalizedOptions;
    const query = this.searchQuery.toLowerCase().trim();
    return this.normalizedOptions.filter((opt) => opt.label.toLowerCase().includes(query));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      if (this.isOpen) {
        this.isOpen = false;
        this.onTouched();
      }
    }
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.onTouched();
    }
  }

  private areValuesEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    // Handle string/number comparison (e.g., '1' == 1)
    return String(a) === String(b);
  }

  private normalizeOptions(): void {
    if (!Array.isArray(this.options)) {
      this.normalizedOptions = [];
      return;
    }

    this.normalizedOptions = this.options.map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return { value: item, label: String(item) };
      }
      if (typeof item === 'object' && item !== null) {
        const val = this.valueKey in item ? item[this.valueKey] : item['value'] ?? item['id'] ?? item;
        const lbl = this.labelKey in item ? item[this.labelKey] : item['label'] ?? item['nombre'] ?? String(val);
        const icon = item.icon || undefined;
        const disabled = item.disabled || false;
        return { value: val, label: String(lbl), icon, disabled };
      }
      return { value: item, label: String(item) };
    });
  }
}
