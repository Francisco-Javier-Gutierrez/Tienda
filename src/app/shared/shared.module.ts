import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AdminShellComponent } from './admin-shell/admin-shell.component';
import { CatalogoModalComponent } from './catalogo-modal/catalogo-modal.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { CustomDatepickerComponent } from './custom-datepicker/custom-datepicker.component';
import { CustomSelectComponent } from './custom-select/custom-select.component';
import { ModalShellComponent } from './modal-shell/modal-shell.component';
import { ProductCardComponent } from './product-card/product-card.component';

@NgModule({
  declarations: [
    AdminShellComponent,
    ConfirmDialogComponent,
    CustomDatepickerComponent,
    CustomSelectComponent,
    ModalShellComponent,
    CatalogoModalComponent,
    ProductCardComponent,
  ],
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
  exports: [
    AdminShellComponent,
    ConfirmDialogComponent,
    CustomDatepickerComponent,
    CustomSelectComponent,
    ModalShellComponent,
    CatalogoModalComponent,
    ProductCardComponent,
  ],
})
export class SharedModule {}
