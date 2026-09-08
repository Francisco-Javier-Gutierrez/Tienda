import { inject, Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { ClienteAuthService } from './cliente-auth.service';

@Injectable({ providedIn: 'root' })
export class ClienteGuard implements CanActivate {
  private readonly clienteAuth = inject(ClienteAuthService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const estaAutenticado = this.clienteAuth.estaAutenticado() || this.auth.estaAutenticado();
    return estaAutenticado
      ? true
      : this.router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
}
