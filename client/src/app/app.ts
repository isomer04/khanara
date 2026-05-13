import { Component, inject } from '@angular/core';
import { Nav } from '../core/layout/nav/nav';
import { Router, RouterOutlet } from '@angular/router';
import { ConfirmDialog } from '../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [Nav, RouterOutlet, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected router = inject(Router);
}
