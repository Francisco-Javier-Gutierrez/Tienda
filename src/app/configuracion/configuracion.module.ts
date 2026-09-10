import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ConfiguracionPageRoutingModule } from './configuracion-routing.module';
import { ConfiguracionPage } from './configuracion.page';
import { SharedModule } from '../shared/shared.module';
import { ConfiguracionTiendaComponent } from './configuracion-tienda.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ConfiguracionPageRoutingModule,
    SharedModule
  ],
  declarations: [ConfiguracionPage, ConfiguracionTiendaComponent]
})
export class ConfiguracionPageModule {}
