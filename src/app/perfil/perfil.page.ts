import { Component, inject } from '@angular/core';
import { ClienteAuthService } from '../services/cliente-auth.service';
import { ImagenesService } from '../services/imagenes.service';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: false,
})
export class PerfilPage {
  cargando = true;
  readonly clienteAuth = inject(ClienteAuthService);
  private readonly imagenes = inject(ImagenesService);

  ngOnInit() {
    setTimeout(() => {
      this.cargando = false;
    }, 500);
  }

  foto(ruta: string | null): string | null {
    return this.imagenes.resolver(ruta);
  }
}
