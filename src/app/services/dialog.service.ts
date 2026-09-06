import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type DialogType = 'danger' | 'warning' | 'success' | 'info';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  type?: DialogType;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
}

export interface PromptDialogOptions extends ConfirmDialogOptions {
  placeholder?: string;
  initialValue?: string;
  minLength?: number;
  maxLength?: number;
  isTextarea?: boolean;
}

export interface DialogState {
  isOpen: boolean;
  isPrompt: boolean;
  title: string;
  message?: string;
  type: DialogType;
  icon: string;
  confirmText: string;
  cancelText: string;
  // Prompt specific
  placeholder?: string;
  inputValue: string;
  minLength: number;
  maxLength: number;
  isTextarea: boolean;
}

const DEFAULT_STATE: DialogState = {
  isOpen: false,
  isPrompt: false,
  title: '',
  message: '',
  type: 'info',
  icon: 'info',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  placeholder: '',
  inputValue: '',
  minLength: 0,
  maxLength: 255,
  isTextarea: false,
};

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  private readonly stateSubject = new BehaviorSubject<DialogState>(DEFAULT_STATE);
  readonly state$: Observable<DialogState> = this.stateSubject.asObservable();

  private confirmResolver?: (value: boolean) => void;
  private promptResolver?: (value: string | null) => void;

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    const type = options.type || 'info';
    const defaultIcon =
      type === 'danger' ? 'delete' : type === 'warning' ? 'warning' : type === 'success' ? 'check_circle' : 'info';

    this.stateSubject.next({
      ...DEFAULT_STATE,
      isOpen: true,
      isPrompt: false,
      title: options.title,
      message: options.message,
      type,
      icon: options.icon || defaultIcon,
      confirmText: options.confirmText || (type === 'danger' ? 'Eliminar' : 'Confirmar'),
      cancelText: options.cancelText || 'Cancelar',
    });

    return new Promise<boolean>((resolve) => {
      this.confirmResolver = resolve;
    });
  }

  prompt(options: PromptDialogOptions): Promise<string | null> {
    const type = options.type || 'info';
    const defaultIcon =
      type === 'danger' ? 'warning' : type === 'warning' ? 'edit_note' : type === 'success' ? 'check_circle' : 'chat';

    this.stateSubject.next({
      isOpen: true,
      isPrompt: true,
      title: options.title,
      message: options.message,
      type,
      icon: options.icon || defaultIcon,
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      placeholder: options.placeholder || 'Escribe aquí...',
      inputValue: options.initialValue || '',
      minLength: options.minLength ?? 0,
      maxLength: options.maxLength ?? 255,
      isTextarea: options.isTextarea ?? true,
    });

    return new Promise<string | null>((resolve) => {
      this.promptResolver = resolve;
    });
  }

  setInputValue(value: string): void {
    const current = this.stateSubject.getValue();
    this.stateSubject.next({ ...current, inputValue: value });
  }

  handleConfirm(): void {
    const current = this.stateSubject.getValue();
    this.close();
    if (current.isPrompt) {
      this.promptResolver?.(current.inputValue);
      this.promptResolver = undefined;
    } else {
      this.confirmResolver?.(true);
      this.confirmResolver = undefined;
    }
  }

  handleCancel(): void {
    const current = this.stateSubject.getValue();
    this.close();
    if (current.isPrompt) {
      this.promptResolver?.(null);
      this.promptResolver = undefined;
    } else {
      this.confirmResolver?.(false);
      this.confirmResolver = undefined;
    }
  }

  private close(): void {
    this.stateSubject.next(DEFAULT_STATE);
  }
}
