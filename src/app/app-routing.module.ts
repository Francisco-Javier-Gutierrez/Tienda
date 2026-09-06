import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { RoleGuard } from './services/auth.guard';
import { ClienteGuard } from './services/cliente.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  { path: 'login', loadChildren: () => import('./login/login.module').then((m) => m.LoginPageModule) },
  { path: 'catalogo', loadChildren: () => import('./catalogo/catalogo.module').then((m) => m.CatalogoPageModule) },
  { path: 'catalogos', redirectTo: 'catalogo', pathMatch: 'full' },
  { path: 'carrito', loadChildren: () => import('./carrito/carrito.module').then((m) => m.CarritoPageModule) },
  {
    path: 'checkout',
    canActivate: [ClienteGuard],
    loadChildren: () => import('./checkout/checkout.module').then((m) => m.CheckoutPageModule),
  },
  {
    path: 'mis-pedidos',
    canActivate: [ClienteGuard],
    loadChildren: () => import('./mis-pedidos/mis-pedidos.module').then((m) => m.MisPedidosPageModule),
  },
  {
    path: 'perfil',
    canActivate: [ClienteGuard],
    loadChildren: () => import('./perfil/perfil.module').then((m) => m.PerfilPageModule),
  },
  {
    path: 'home',
    canActivate: [RoleGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadChildren: () => import('./home/home.module').then((m) => m.HomePageModule),
  },
  {
    path: 'empleados',
    canActivate: [RoleGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadChildren: () => import('./empleados/empleados.module').then((m) => m.EmpleadosPageModule),
  },
  {
    path: 'cajero',
    canActivate: [RoleGuard],
    data: { roles: ['ADMINISTRADOR', 'CAJERO'] },
    loadChildren: () => import('./cajero/cajero.module').then((m) => m.CajeroPageModule),
  },
  {
    path: 'ventas',
    canActivate: [RoleGuard],
    data: { roles: ['ADMINISTRADOR', 'CAJERO'] },
    loadChildren: () => import('./ventas/ventas.module').then((m) => m.VentasPageModule),
  },
  {
    path: 'pedidos-online',
    canActivate: [RoleGuard],
    data: { roles: ['ADMINISTRADOR'] },
    loadChildren: () => import('./pedidos-online/pedidos-online.module').then((m) => m.PedidosOnlinePageModule),
  },
  {
    path: 'categorias',
    loadChildren: () => import('./categorias/categorias.module').then((m) => m.CategoriasPageModule),
  },
  {
    path: 'configuracion',
    loadChildren: () => import('./configuracion/configuracion.module').then((m) => m.ConfiguracionPageModule),
  },
  {
    path: 'marcas',
    loadChildren: () => import('./marcas/marcas.module').then((m) => m.MarcasPageModule),
  },
  {
    path: 'productos',
    loadChildren: () => import('./productos/productos.module').then((m) => m.ProductosPageModule),
  },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
