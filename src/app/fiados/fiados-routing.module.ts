import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FiadosPage } from './fiados.page';

const routes: Routes = [
  {
    path: '',
    component: FiadosPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FiadosPageRoutingModule {}
