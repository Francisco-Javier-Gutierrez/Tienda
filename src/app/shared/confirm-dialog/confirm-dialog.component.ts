import { Component, inject } from '@angular/core';
import { DialogService, DialogState } from '../../services/dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  standalone: false,
})
export class ConfirmDialogComponent {
  readonly dialog = inject(DialogService);
  readonly state$ = this.dialog.state$;

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.dialog.setInputValue(value);
  }

  isValid(state: DialogState): boolean {
    if (!state.isPrompt) return true;
    const len = (state.inputValue || '').trim().length;
    return len >= state.minLength && len <= state.maxLength;
  }
}
