import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { AuthSessionStore } from './auth-session.service';
import { environment } from 'src/environments/environment';
import { ClienteSessionStore } from './cliente-session.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly auth = inject(AuthSessionStore);
  private readonly clienteAuth = inject(ClienteSessionStore);
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const esApiLocal =
      req.url.startsWith(environment.API_BASE_URL) ||
      (!req.url.startsWith('http://') && !req.url.startsWith('https://'));
    if (!esApiLocal) {
      return next.handle(req);
    }

    const esFlujoCliente =
      req.url.includes('/auth/google/cliente') || req.url.includes('/auth/cliente/') || req.url.includes('/cliente/');
    const esInicioSesion = req.url.includes('/auth/login') || req.url.includes('/auth/google');
    const rawToken = esInicioSesion ? null : esFlujoCliente ? this.clienteAuth.token : this.auth.token;
    const tokenValido = rawToken && !rawToken.startsWith('offline-token-') ? rawToken : null;
    const autenticada = tokenValido ? req.clone({ setHeaders: { Authorization: `Bearer ${tokenValido}` } }) : req;
    return next.handle(autenticada).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401 && !esInicioSesion) {
          if (esFlujoCliente) this.clienteAuth.limpiar();
          else if (rawToken && !rawToken.startsWith('offline-token-')) this.auth.limpiar();
        }
        return throwError(() => error);
      }),
    );
  }
}
