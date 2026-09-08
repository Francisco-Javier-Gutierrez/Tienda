import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { ClienteSharedModule } from '../cliente-shared/cliente-shared.module';
import { SharedModule } from '../shared/shared.module';
import { CatalogoPage } from './catalogo.page';

@NgModule({
  declarations: [CatalogoPage],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    ClienteSharedModule,
    RouterModule.forChild([{ path: '', component: CatalogoPage }]),
  ],
})
export class CatalogoPageModule {}
