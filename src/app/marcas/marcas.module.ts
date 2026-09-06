import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MarcasPageRoutingModule } from './marcas-routing.module';
import { MarcasPage } from './marcas.page';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MarcasPageRoutingModule,
    SharedModule
  ],
  declarations: [MarcasPage]
})
export class MarcasPageModule {}
