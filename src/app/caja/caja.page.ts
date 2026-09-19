import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-caja',
  template: '<div class="flex items-center justify-center h-screen"><ion-spinner></ion-spinner></div>',
  standalone: false,
})
export class CajaPage implements OnInit {
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.router.navigate(['/ventas'], { queryParams: { tab: 'cortes' }, replaceUrl: true });
  }
}
