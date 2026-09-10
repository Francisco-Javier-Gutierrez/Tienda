import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CajaPage } from './caja.page';
import { SharedModule } from '../shared/shared.module';
@NgModule({
  declarations: [CajaPage],
  imports: [CommonModule, FormsModule, IonicModule, SharedModule, RouterModule.forChild([{ path: '', component: CajaPage }])],
})
export class CajaPageModule {}
