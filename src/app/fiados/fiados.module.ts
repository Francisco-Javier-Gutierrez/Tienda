import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FiadosPageRoutingModule } from './fiados-routing.module';
import { FiadosPage } from './fiados.page';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, FiadosPageRoutingModule, SharedModule],
  declarations: [FiadosPage],
})
export class FiadosPageModule {}
