import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { API_BASE_URL, AUTH_SESSION_STORE, CLIENTE_SESSION_STORE } from './tokens';

/**
 * =========================================================================
 * Dependency Inversion Principle (DIP) - Auth Interceptor
 * =========================================================================
 * Depende exclusivamente de abstracciones (API_BASE_URL, AUTH_SESSION_STORE,
 * CLIENTE_SESSION_STORE) inyectadas mediante tokens, en lugar de clases concretas
 * o el fichero estático environment.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly auth = inject(AUTH_SESSION_STORE);
  private readonly clienteAuth = inject(CLIENTE_SESSION_STORE);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const esApiLocal =
      req.url.startsWith(this.apiBaseUrl) ||
      (!req.url.startsWith('http://') && !req.url.startsWith('https://'));
    if (!esApiLocal) {
      return next.handle(req);
    }

    const esFlujoCliente =
      req.url.includes('/auth/google/cliente') ||
      req.url.includes('/auth/cliente/') ||
      req.url.includes('/cliente/') ||
      (req.url.includes('/notificaciones') && Boolean(this.clienteAuth.token));
    const esInicioSesion = req.url.includes('/auth/login') || req.url.includes('/auth/google');
    const rawToken = esInicioSesion
      ? null
      : esFlujoCliente
        ? this.clienteAuth.token
        : (this.auth.token || this.clienteAuth.token);
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
