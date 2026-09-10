import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ClienteSharedModule } from '../cliente-shared/cliente-shared.module';
import { SharedModule } from '../shared/shared.module';
import { PerfilPage } from './perfil.page';

@NgModule({
  declarations: [PerfilPage],
  imports: [
    CommonModule,
    IonicModule,
    SharedModule,
    ClienteSharedModule,
    RouterModule.forChild([{ path: '', component: PerfilPage }]),
  ],
})
export class PerfilPageModule {}
