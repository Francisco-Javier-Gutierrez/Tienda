import { EmpleadoSesion, ClienteSesion } from './auth.types';

declare global {
  namespace Express {
    interface Request {
      empleado?: EmpleadoSesion;
      cliente?: ClienteSesion;
    }
  }
}

export {};
